import { createHash } from "node:crypto";
import { client } from "@/utils/sanity/client";
import { initializePaystack, isPaystackUrl } from "@/utils/lib/paystack";
import { parseNairaPrice } from "@/utils/money";

export class CheckoutError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

function infrastructureError(error, stage, service) {
  const status = Number(error.statusCode || error.response?.status) || null;
  // Use an explicit allowlist. SDK/Axios errors can include credentials and PII.
  console.error("Checkout dependency failed", { stage, service, status });
  const storage = service === "storage";
  const failure = new CheckoutError(
    storage
      ? "We couldn't save your order. Your cart is saved. Please contact support if this continues."
      : "We couldn't connect to the payment service. Your cart is saved. Please try again shortly.",
    503,
  );
  failure.code = storage
    ? [401, 403].includes(status)
      ? "CHECKOUT_STORAGE_PERMISSIONS"
      : "CHECKOUT_STORAGE_UNAVAILABLE"
    : [401, 403].includes(status)
      ? "CHECKOUT_PAYMENT_CONFIGURATION"
      : "CHECKOUT_PAYMENT_UNAVAILABLE";
  return failure;
}

function checkConfiguration() {
  const missing = [
    "NEXT_PRIVATE_PAYSTACK_SECRET_KEY",
    "NEXT_PUBLIC_BASE_URL",
  ].filter((name) => !process.env[name]?.trim());
  if (
    !(
      process.env.SANITY_API_TOKEN?.trim() ||
      process.env.NEXT_SANITY_API_TOKEN?.trim()
    )
  ) {
    missing.push("SANITY_API_TOKEN or NEXT_SANITY_API_TOKEN");
  }
  let validBaseUrl = false;
  try {
    validBaseUrl = ["http:", "https:"].includes(
      new URL(process.env.NEXT_PUBLIC_BASE_URL).protocol,
    );
  } catch {
    /* invalid configuration */
  }
  if (!missing.length && validBaseUrl) return;
  console.error("Checkout configuration incomplete", { missing, validBaseUrl });
  const error = new CheckoutError(
    "Ordering is temporarily unavailable. Your cart is saved. Please contact support.",
    503,
  );
  error.code = "CHECKOUT_CONFIGURATION";
  throw error;
}

const hash = (value) => createHash("sha256").update(value).digest("hex");
const reference = (id) => ({ _type: "reference", _ref: id });

function text(value, label, max = 250, required = true) {
  if (value == null && !required) return "";
  if (
    typeof value !== "string" ||
    value.trim().length > max ||
    (required && !value.trim())
  ) {
    throw new CheckoutError(`Please enter a valid ${label}.`);
  }
  return value.trim();
}

function kobo(value) {
  const price = parseNairaPrice(value);
  if (price === null) {
    throw new CheckoutError(
      "An item or delivery fee has an invalid price. Please contact support.",
      409,
    );
  }
  return Math.round(price * 100);
}

export function validateCheckout(body, userId) {
  if (!body || typeof body !== "object")
    throw new CheckoutError("Invalid checkout request.");
  const key = text(body.idempotencyKey, "checkout reference", 100);
  if (!/^[a-zA-Z0-9_-]{16,100}$/.test(key))
    throw new CheckoutError("Please refresh checkout and try again.");
  const email = text(body.email, "email address", 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new CheckoutError("Please enter a valid email address.");
  if (
    !Array.isArray(body.cartItems) ||
    !body.cartItems.length ||
    body.cartItems.length > 100
  ) {
    throw new CheckoutError("Please add meals to your cart.");
  }
  const seen = new Set();
  const items = body.cartItems
    .map((item) => {
      const id = text(item?._id, "meal", 128);
      if (
        !/^[a-zA-Z0-9_-]+$/.test(id) ||
        seen.has(id) ||
        !Number.isSafeInteger(item.quantity) ||
        item.quantity < 1 ||
        item.quantity > 100
      ) {
        throw new CheckoutError(
          "Please check the meals and quantities in your cart.",
        );
      }
      seen.add(id);
      return { id, quantity: item.quantity };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
  const feeId = text(
    typeof body.serviceFee === "string"
      ? body.serviceFee
      : body.serviceFee?._ref,
    "delivery area",
    128,
  );
  if (!/^[a-zA-Z0-9_-]+$/.test(feeId))
    throw new CheckoutError("Please select a delivery area.");
  const details = {
    name: text(body.fullName, "full name"),
    email,
    phone: text(body.phoneNumber, "phone number", 40),
    streetAddress: text(body.streetAddress, "street address"),
    townCity: text(body.townCity, "town/city", 100),
    apartment: text(body.apartment, "apartment", 250, false),
    notes: text(body.orderNotes, "order notes", 2000, false),
  };
  const identity = userId || null;
  return {
    key,
    items,
    feeId,
    details,
    identity,
    fingerprint: hash(JSON.stringify({ items, feeId, details, identity })),
  };
}

async function createPendingOrder(
  input,
  orderId,
  transactionId,
  paymentReference,
) {
  const [dishes, fee, account] = await Promise.all([
    client.fetch(
      '*[_type == "dish" && _id in $ids && !(_id in path("drafts.*"))]{_id,title,price,status,"imageUrl":image.asset->url}',
      { ids: input.items.map((item) => item.id) },
    ),
    client.getDocument(input.feeId),
    input.identity ? client.getDocument(input.identity) : Promise.resolve(null),
  ]);
  if (
    input.identity &&
    (!account || account._type !== "customer" || account.isAnonymous === true)
  ) {
    throw new CheckoutError(
      "Please sign in again or continue as a guest.",
      401,
    );
  }
  if (!fee || fee._type !== "serviceFee")
    throw new CheckoutError("Please select an available delivery area.");
  const lineItems = input.items.map((item, index) => {
    const dish = dishes.find((row) => row._id === item.id);
    if (!dish || dish.status === false)
      throw new CheckoutError(
        "A meal is no longer available. Please update your cart.",
        409,
      );
    const unitPriceInKobo = kobo(dish.price);
    return {
      _key: `item-${index}`,
      _type: "orderItem",
      product: reference(dish._id),
      title: dish.title,
      imageUrl: dish.imageUrl || null,
      quantity: item.quantity,
      unitPrice: unitPriceInKobo / 100,
      lineTotal: (unitPriceInKobo * item.quantity) / 100,
    };
  });
  const subtotalInKobo = lineItems.reduce(
    (sum, item) => sum + Math.round(item.lineTotal * 100),
    0,
  );
  const vatInKobo = Math.round(subtotalInKobo * 0.075);
  const deliveryInKobo = kobo(fee.fee);
  // Preserve the storefront's existing whole-naira rounding policy.
  const amountInKobo =
    Math.round((subtotalInKobo + vatInKobo + deliveryInKobo) / 100) * 100;
  if (!Number.isSafeInteger(amountInKobo) || amountInKobo <= 0)
    throw new CheckoutError("Invalid order total.");
  const customerId = input.identity || `guest-${hash(input.key)}`;
  const now = new Date().toISOString();
  const order = {
    _id: orderId,
    _type: "order",
    orderId,
    checkoutVersion: 2,
    checkoutFingerprint: input.fingerprint,
    transactionRef: paymentReference,
    transactionDate: now,
    customer: reference(customerId),
    ...input.details,
    products: lineItems.map((item) => ({ ...item.product, _key: item._key })),
    lineItems,
    serviceFee: reference(fee._id),
    deliveryFee: deliveryInKobo / 100,
    subtotal: subtotalInKobo / 100,
    vat: vatInKobo / 100,
    total: amountInKobo / 100,
    amountInKobo,
    currency: "NGN",
    status: "pending",
    paymentStatus: "pending",
  };
  let mutation = client.transaction();
  if (!input.identity) {
    // Each guest checkout is independent. Email alone never identifies an account.
    mutation = mutation.createIfNotExists({
      _id: customerId,
      _type: "customer",
      isAnonymous: true,
      email: input.details.email,
      name: input.details.name,
      createdAt: now,
      orders: [],
      transactions: [],
      orderCount: 0,
      totalSpent: 0,
    });
  }
  await mutation
    .createIfNotExists(order)
    .createIfNotExists({
      _id: transactionId,
      _type: "transaction",
      order: reference(orderId),
      userId: reference(customerId),
      transactionRef: paymentReference,
      amount: order.total,
      currency: "NGN",
      status: "pending",
      method: "paystack",
      transactionDate: now,
    })
    .commit();
  return client.getDocument(orderId);
}

function checkoutResponse(order, authorizationUrl) {
  // Do not return customer documents, addresses, or credentials.
  return {
    success: true,
    order: { _id: order._id, total: order.total },
    paymentResponse: {
      data: {
        reference: order.transactionRef,
        authorization_url: authorizationUrl,
      },
    },
  };
}

export async function startCheckout(body, userId) {
  const input = validateCheckout(body, userId);
  checkConfiguration();
  const digest = hash(input.key);
  const orderId = `order-${digest}`;
  const transactionId = `transaction-${digest}`;
  const paymentReference = `Euodia-${digest.slice(0, 32)}`;
  let order;
  let storageStage = "order_lookup";
  try {
    order = await client.getDocument(orderId);
    if (!order) {
      storageStage = "pending_order_creation";
      order = await createPendingOrder(
        input,
        orderId,
        transactionId,
        paymentReference,
      );
      if (!order) throw new Error("Pending order unavailable");
    }
  } catch (error) {
    if (error instanceof CheckoutError) throw error;
    throw infrastructureError(error, storageStage, "storage");
  }
  if (order.checkoutFingerprint !== input.fingerprint) {
    throw new CheckoutError(
      "Checkout details changed. Please refresh and try again.",
      409,
    );
  }
  if (order.paymentStatus === "paid") {
    return checkoutResponse(
      order,
      `/success?trxref=${encodeURIComponent(order.transactionRef)}`,
    );
  }
  if (isPaystackUrl(order.authorizationUrl))
    return checkoutResponse(order, order.authorizationUrl);
  if (
    order.initializingUntil &&
    Date.parse(order.initializingUntil) > Date.now()
  ) {
    throw new CheckoutError(
      "Your payment is being prepared. Please try again in a moment.",
      409,
    );
  }
  try {
    // A lease prevents two simultaneous submissions from initializing payment twice.
    await client
      .patch(orderId)
      .ifRevisionId(order._rev)
      .set({ initializingUntil: new Date(Date.now() + 60000).toISOString() })
      .commit();
  } catch (error) {
    if (error.statusCode === 409)
      throw new CheckoutError(
        "Your payment is being prepared. Please try again in a moment.",
        409,
      );
    throw infrastructureError(error, "payment_lease", "storage");
  }
  let payment;
  try {
    payment = await initializePaystack(
      order.email,
      order.amountInKobo,
      order.transactionRef,
    );
  } catch (error) {
    // Keep the same reference after an ambiguous timeout. Never initialize a new
    // payment merely because the response was lost.
    try {
      await client.patch(orderId).unset(["initializingUntil"]).commit();
    } catch {
      /* lease expires */
    }
    if (/duplicate|already exists/i.test(error.response?.data?.message || "")) {
      throw new CheckoutError(
        "A payment already exists for this order. Check your payment reference or contact support before retrying.",
        409,
      );
    }
    throw infrastructureError(error, "payment_initialization", "payment");
  }
  try {
    await client
      .patch(orderId)
      .set({ authorizationUrl: payment.authorization_url })
      .unset(["initializingUntil"])
      .commit();
  } catch {
    // Order + transaction already exist. Payment can safely continue and be
    // finalized by the signed webhook even if caching the checkout URL failed.
    console.error("Unable to cache checkout URL:", orderId);
  }
  return checkoutResponse(order, payment.authorization_url);
}
