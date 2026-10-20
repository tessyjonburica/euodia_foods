const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const crypto = require("node:crypto");
const swc = require("next/dist/build/swc");

// Compile the actual application modules without loading any live credentials or
// network clients. Unknown dependencies fail rather than silently hitting Sanity.
async function load(file, dependencies, extra = {}) {
  const { code } = await swc.transform(
    fs.readFileSync(path.join(__dirname, "..", file), "utf8"),
    {
      filename: file,
      jsc: { parser: { syntax: "ecmascript" }, target: "es2022" },
      module: { type: "commonjs" },
    },
  );
  const module = { exports: {} };
  vm.runInNewContext(
    code,
    {
      module,
      exports: module.exports,
      Response,
      URL,
      Buffer,
      TextEncoder,
      Uint8Array,
      SyntaxError,
      crypto: crypto.webcrypto,
      console: { error() {}, log() {} },
      process: {
        env: {
          SANITY_API_TOKEN: "fixture",
          NEXT_PRIVATE_EMAIL: "sender@example.test",
          NEXT_PRIVATE_PASS: "fixture",
          NEXT_PRIVATE_PAYSTACK_SECRET_KEY: "fixture",
          NEXT_PRIVATE_JWT_SECRET_KEY: "fixture",
          NEXT_PUBLIC_BASE_URL: "https://example.test",
        },
      },
      require(id) {
        if (!(id in dependencies))
          throw new Error(`Unexpected dependency: ${id}`);
        return dependencies[id];
      },
      ...extra,
    },
    { filename: file },
  );
  return module.exports;
}

function database() {
  let revision = 0;
  let docs = new Map([
    [
      "admin-1",
      {
        _id: "admin-1",
        _type: "admin",
        email: "admin@example.test",
        password: "old-admin-hash",
      },
    ],
    [
      "meal-1",
      {
        _id: "meal-1",
        _type: "dish",
        price: 1000,
        title: "Rice",
        status: true,
      },
    ],
    ["fee-1", { _id: "fee-1", _type: "serviceFee", fee: 500 }],
    [
      "account-1",
      {
        _id: "account-1",
        _type: "customer",
        email: "guest@example.test",
        password: "hash",
      },
    ],
  ]);
  const clone = (value) =>
    value == null ? value : JSON.parse(JSON.stringify(value));
  function builder(id) {
    const op = { id };
    return {
      op,
      ifRevisionId(value) {
        op.revision = value;
        return this;
      },
      set(value) {
        op.set = value;
        return this;
      },
      setIfMissing(value) {
        op.defaults = value;
        return this;
      },
      unset(value) {
        op.unset = value;
        return this;
      },
      append(field, items) {
        (op.append ||= []).push({ field, items });
        return this;
      },
      inc(value) {
        op.inc = value;
        return this;
      },
      async commit() {
        commit([op]);
        return clone(docs.get(id));
      },
    };
  }
  function commit(operations) {
    if (db.failCache && operations.some((op) => op.set?.authorizationUrl))
      throw new Error("Cache write failed");
    if (db.failAll) throw db.failure || new Error("Storage unavailable");
    const working = new Map(
      [...docs].map(([key, value]) => [key, clone(value)]),
    );
    for (const op of operations) {
      if (op.create) {
        if (!working.has(op.create._id))
          working.set(op.create._id, {
            ...clone(op.create),
            _rev: String(++revision),
          });
        continue;
      }
      const doc = working.get(op.id);
      if (!doc) throw new Error("Document missing");
      if (op.revision !== undefined && doc._rev !== op.revision)
        throw Object.assign(new Error("Revision conflict"), {
          statusCode: 409,
        });
      for (const [key, value] of Object.entries(op.defaults || {}))
        if (doc[key] == null) doc[key] = clone(value);
      Object.assign(doc, clone(op.set || {}));
      for (const key of op.unset || []) delete doc[key];
      for (const { field, items } of op.append || []) {
        if (!Array.isArray(doc[field])) throw new Error("Missing array");
        doc[field].push(...clone(items));
      }
      for (const [key, value] of Object.entries(op.inc || {}))
        doc[key] += value;
      doc._rev = String(++revision);
    }
    docs = working;
  }
  const db = {
    all: () => [...docs.values()].map(clone),
    getDocument: async (id) => clone(docs.get(id)),
    async fetch(query, params) {
      if (query.includes('_type == "dish"'))
        return db
          .all()
          .filter(
            (doc) => doc._type === "dish" && params.ids.includes(doc._id),
          );
      if (query.includes("resetTokenHash"))
        return (
          db
            .all()
            .find(
              (doc) =>
                doc._type ===
                  (query.includes('_type == "admin"') ? "admin" : "customer") &&
                doc.resetTokenHash === params.tokenHash &&
                Date.parse(doc.resetTokenExpiry) > Date.now(),
            ) || null
        );
      if (query.includes('_type == "transaction"'))
        return (
          db
            .all()
            .find(
              (doc) =>
                doc._type === "transaction" &&
                doc.transactionRef === params.reference,
            ) || null
        );
      if (query.includes('_type == "admin"'))
        return (
          db
            .all()
            .find(
              (doc) =>
                doc._type === "admin" &&
                doc.email.toLowerCase() === params.email,
            ) || null
        );
      throw new Error(`Unexpected query: ${query}`);
    },
    patch: builder,
    transaction() {
      const ops = [];
      return {
        createIfNotExists(doc) {
          ops.push({ create: doc });
          return this;
        },
        patch(id, update) {
          ops.push(update(builder(id)).op);
          return this;
        },
        async commit() {
          commit(ops);
        },
      };
    },
  };
  return db;
}

function payload() {
  return {
    idempotencyKey: "fixture-checkout-key-0001",
    cartItems: [{ _id: "meal-1", quantity: 3 }],
    email: " Guest@Example.test ",
    fullName: "Guest",
    phoneNumber: "08000000000",
    streetAddress: "Test street",
    townCity: "Lagos",
    serviceFee: "fee-1",
    amount: 1,
    userId: "account-1",
  };
}

async function setup(checkoutGlobals = {}) {
  const db = database();
  let calls = 0;
  const gateway = {
    isPaystackUrl: (value) =>
      typeof value === "string" &&
      value.startsWith("https://checkout.paystack.com/"),
    async initializePaystack(email, amount, reference) {
      calls += 1;
      if (gateway.fail)
        throw gateway.failure || new Error("Gateway unavailable");
      gateway.last = { email, amount, reference };
      return {
        reference,
        authorization_url: "https://checkout.paystack.com/fixture",
      };
    },
    async verifyPaystack(reference) {
      if (gateway.failVerify) throw new Error("Gateway unavailable");
      return {
        reference,
        currency: "NGN",
        amount: 372500,
        status: "success",
        ...gateway.verification,
      };
    },
  };
  const checkout = await load(
    "utils/lib/checkout.js",
    {
      "node:crypto": crypto,
      "@/utils/sanity/client": { client: db },
      "@/utils/lib/paystack": gateway,
      "@/utils/money": await load("utils/money.js", {}),
    },
    checkoutGlobals,
  );
  const payment = await load("utils/lib/finalizePayment.js", {
    "@/utils/sanity/client": { client: db },
    "@/utils/lib/paystack": gateway,
    "@/utils/lib/checkout": checkout,
  });
  return { db, gateway, checkout, payment, calls: () => calls };
}

test("guest checkout ignores submitted price/identity, stores snapshots, and retries the same order", async () => {
  const { db, gateway, checkout, calls } = await setup();
  const result = await checkout.startCheckout(payload());
  assert.equal(result.success, true);
  assert.equal(gateway.last.amount, 372500);
  const order = db.all().find((doc) => doc._type === "order");
  const guest = db.all().find((doc) => doc.isAnonymous);
  assert.equal(order.customer._ref, guest._id);
  assert.notEqual(guest._id, "account-1");
  assert.equal(guest.totalSpent, 0);
  assert.equal(guest.transactions.length, 0);
  assert.equal(order.lineItems[0].quantity, 3);
  assert.equal(order.lineItems[0].unitPrice, 1000);
  assert.equal(order.lineItems[0].lineTotal, 3000);
  assert.equal(order.serviceFee._ref, "fee-1");
  assert.equal(result.order.email, undefined);
  await checkout.startCheckout(payload());
  assert.equal(calls(), 1);
  assert.equal(db.all().filter((doc) => doc._type === "order").length, 1);
});

test("guest checkout accepts legacy text fees and matches the displayed 5725 naira total", async () => {
  const { db, gateway, checkout } = await setup();
  await db.patch("fee-1").set({ fee: "2500" }).commit();
  await db.patch("meal-1").set({ price: "3000" }).commit();
  const result = await checkout.startCheckout({
    ...payload(),
    cartItems: [{ _id: "meal-1", quantity: 1 }],
  });
  assert.equal(result.order.total, 5725);
  assert.equal(gateway.last.amount, 572500);
  const order = db.all().find((doc) => doc._type === "order");
  assert.equal(order.deliveryFee, 2500);
  assert.equal(order.lineItems[0].unitPrice, 3000);
});

test("money normalization rejects invalid values instead of silently treating them as free", async () => {
  const { parseNairaPrice } = await load("utils/money.js", {});
  for (const value of [
    null,
    undefined,
    true,
    false,
    "",
    " ",
    "2500x",
    "1,500",
    "0x10",
    "1e3",
    "-1",
    -1,
    NaN,
    Infinity,
    {},
    [],
    "10.123",
    Number.MAX_SAFE_INTEGER,
  ]) {
    assert.equal(
      parseNairaPrice(value),
      null,
      `Invalid money: ${String(value)}`,
    );
  }
  assert.equal(parseNairaPrice(" 2500 "), 2500);
  assert.equal(parseNairaPrice("0"), 0);
  assert.equal(parseNairaPrice("10.50"), 10.5);
  const { db, checkout, calls } = await setup();
  await db.patch("fee-1").set({ fee: "not a price" }).commit();
  await assert.rejects(
    checkout.startCheckout(payload()),
    (error) => error.status === 409,
  );
  assert.equal(calls(), 0);
  assert.equal(
    db.all().some((doc) => doc._type === "order"),
    false,
  );
});

test("admin fee create/update store numbers and reject invalid fees before writing", async () => {
  const money = await load("utils/money.js", {});
  let saved;
  let writes = 0;
  const db = {
    fetch: async () => null,
    create: async (doc) => {
      writes += 1;
      saved = doc;
      return doc;
    },
    patch: () => ({
      set(doc) {
        saved = doc;
        return this;
      },
      async commit() {
        writes += 1;
        return saved;
      },
    }),
  };
  const deps = {
    "@/utils/money": money,
    "@/utils/lib/auth": { isAdmin: () => true },
    "@/utils/sanity/client": { client: db },
    "next/server": { NextResponse: Response },
  };
  const create = await load("app/api/admin/servicefee/route.js", deps);
  const update = await load("app/api/admin/servicefee/[id]/route.js", deps);
  const request = (fee) => ({
    headers: new Headers(),
    json: async () => ({ location: "Fixture area", fee }),
  });
  assert.equal((await create.POST(request("2500"))).status, 200);
  assert.equal(saved.fee, 2500);
  assert.equal(
    (await update.PATCH(request("0"), { params: { id: "fee-1" } })).status,
    200,
  );
  assert.equal(saved.fee, 0);
  assert.equal((await create.POST(request(""))).status, 400);
  assert.equal(
    (await update.PATCH(request("bad"), { params: { id: "fee-1" } })).status,
    400,
  );
  assert.equal(writes, 2);
});

test("signed-in customer comes from verified session, never body userId", async () => {
  const { db, checkout } = await setup();
  await checkout.startCheckout({ ...payload(), userId: "victim" }, "account-1");
  assert.equal(
    db.all().find((doc) => doc._type === "order").customer._ref,
    "account-1",
  );
  assert.equal(db.all().filter((doc) => doc.isAnonymous).length, 0);
});

test("malformed checkout, unavailable meals, and changed replay fail before payment", async () => {
  const { db, checkout, calls } = await setup();
  for (const body of [
    null,
    { ...payload(), email: null },
    { ...payload(), cartItems: [] },
    { ...payload(), cartItems: [{ _id: "meal-1", quantity: -1 }] },
    { ...payload(), serviceFee: "missing" },
  ]) {
    await assert.rejects(
      checkout.startCheckout(body),
      (error) => error.status === 400,
    );
  }
  await db.patch("meal-1").set({ status: false }).commit();
  await assert.rejects(
    checkout.startCheckout(payload()),
    (error) => error.status === 409,
  );
  assert.equal(calls(), 0);
  await db.patch("meal-1").set({ status: true }).commit();
  await checkout.startCheckout(payload());
  await assert.rejects(
    checkout.startCheckout({ ...payload(), fullName: "Changed" }),
    (error) => error.status === 409,
  );
  assert.equal(calls(), 1);
});

test("simultaneous guest submissions initialize only once", async () => {
  const { checkout, calls, db } = await setup();
  const results = await Promise.allSettled([
    checkout.startCheckout(payload()),
    checkout.startCheckout(payload()),
  ]);
  assert.ok(results.some((result) => result.status === "fulfilled"));
  assert.equal(calls(), 1);
  assert.equal(db.all().filter((doc) => doc._type === "transaction").length, 1);
});

test("gateway/storage failures preserve pending order without counting unpaid spending", async () => {
  const { checkout, gateway, db } = await setup();
  gateway.fail = true;
  await assert.rejects(checkout.startCheckout(payload()));
  const pending = db.all().find((doc) => doc._type === "order");
  assert.equal(pending.paymentStatus, "pending");
  assert.equal(db.all().find((doc) => doc.isAnonymous).orderCount, 0);
  gateway.fail = false;
  db.failCache = true;
  assert.equal((await checkout.startCheckout(payload())).success, true);
  assert.equal(db.all().filter((doc) => doc._type === "order").length, 1);
  const isolated = await setup();
  isolated.db.failAll = true;
  await assert.rejects(isolated.checkout.startCheckout(payload()));
  assert.equal(isolated.calls(), 0);
  assert.equal(
    isolated.db.all().some((doc) => doc._type === "order"),
    false,
  );
});

test("payment callbacks and webhook races finalize/count exactly once, including missing arrays", async () => {
  const { checkout, payment, db, gateway } = await setup();
  await checkout.startCheckout(payload(), "account-1");
  await Promise.all([
    payment.finalizePayment(gateway.last.reference),
    payment.finalizePayment(gateway.last.reference),
  ]);
  await payment.finalizePayment(gateway.last.reference);
  const customer = await db.getDocument("account-1");
  assert.equal(customer.totalSpent, 3725);
  assert.equal(customer.orderCount, 1);
  assert.equal(customer.orders.length, 1);
  assert.equal(customer.transactions.length, 1);
  assert.equal(
    db.all().find((doc) => doc._type === "transaction").status,
    "success",
  );
  assert.equal(
    db.all().find((doc) => doc._type === "order").paymentStatus,
    "paid",
  );
});

test("amount/currency mismatch, unpaid status, and gateway outage never finalize", async () => {
  const { checkout, payment, db, gateway } = await setup();
  await checkout.startCheckout(payload());
  for (const mismatch of [
    { amount: 1 },
    { currency: "USD" },
    { status: "abandoned" },
    { reference: "wrong" },
  ]) {
    gateway.verification = mismatch;
    await assert.rejects(
      payment.finalizePayment(gateway.last.reference),
      (error) => error.status === 409,
    );
  }
  gateway.failVerify = true;
  await assert.rejects(payment.finalizePayment(gateway.last.reference));
  assert.equal(
    db.all().find((doc) => doc._type === "transaction").status,
    "pending",
  );
  assert.equal(db.all().find((doc) => doc.isAnonymous).totalSpent, 0);
});

test("finalization is atomic on storage failure; legacy totals are not counted twice", async () => {
  const { checkout, payment, db, gateway } = await setup();
  await checkout.startCheckout(payload());
  db.failAll = true;
  await assert.rejects(payment.finalizePayment(gateway.last.reference));
  assert.equal(
    db.all().find((doc) => doc._type === "order").paymentStatus,
    "pending",
  );
  db.failAll = false;
  const order = db.all().find((doc) => doc._type === "order");
  await db.patch(order._id).unset(["checkoutVersion"]).commit();
  await payment.finalizePayment(gateway.last.reference);
  assert.equal(db.all().find((doc) => doc.isAnonymous).totalSpent, 0);
});

test("webhook accepts signed events only and returns retryable failure", async () => {
  let finalized = 0;
  let fail = false;
  const route = await load("app/api/paystack/webhook/route.js", {
    "node:crypto": crypto,
    "@/utils/lib/finalizePayment": {
      async finalizePayment() {
        if (fail) throw new Error("Unavailable");
        finalized += 1;
      },
    },
  });
  const raw = JSON.stringify({
    event: "charge.success",
    data: { reference: "Euodia-fixture" },
  });
  const signature = crypto
    .createHmac("sha512", "fixture")
    .update(raw)
    .digest("hex");
  const request = (sig) => ({
    text: async () => raw,
    headers: new Headers({ "x-paystack-signature": sig }),
  });
  assert.equal((await route.POST(request("invalid"))).status, 401);
  assert.equal((await route.POST(request("0".repeat(128)))).status, 401);
  assert.equal(finalized, 0);
  assert.equal((await route.POST(request(signature))).status, 200);
  assert.equal(finalized, 1);
  fail = true;
  assert.equal((await route.POST(request(signature))).status, 503);
});

test("checkout and verification routes return useful validation/retry errors", async () => {
  const { checkout, payment } = await setup();
  const order = await load("app/api/order/route.js", {
    "@/utils/lib/auth/getSession": { getSession: async () => null },
    "@/utils/lib/checkout": checkout,
  });
  assert.equal((await order.POST({ json: async () => payload() })).status, 200);
  assert.equal((await order.POST({ json: async () => ({}) })).status, 400);
  assert.equal(
    (
      await order.POST({
        json: async () => {
          throw new SyntaxError();
        },
      })
    ).status,
    400,
  );
  const verify = await load("app/api/verify/route.js", {
    "@/utils/lib/finalizePayment": payment,
    "@/utils/lib/checkout": checkout,
  });
  assert.equal(
    (await verify.GET({ url: "https://example.test/api/verify" })).status,
    400,
  );
});

test("existing NEXT_SANITY_API_TOKEN works server-side and neither token reaches the browser client", async () => {
  const configurations = [];
  const dependencies = {
    "@sanity/client": {
      createClient: (config) => {
        configurations.push(config);
        return {};
      },
    },
    "../lib/checkUser": { ensureUserExists: async () => {} },
    uuid: { v4: () => "fixture" },
  };
  await load("utils/sanity/client.js", dependencies, {
    process: { env: { NEXT_SANITY_API_TOKEN: "legacy-fixture" } },
  });
  assert.equal(configurations.at(-1).token, "legacy-fixture");
  await load("utils/sanity/client.js", dependencies, {
    process: {
      env: {
        SANITY_API_TOKEN: "canonical-fixture",
        NEXT_SANITY_API_TOKEN: "legacy-fixture",
      },
    },
  });
  assert.equal(configurations.at(-1).token, "canonical-fixture");
  await load("utils/sanity/client.js", dependencies, {
    window: {},
    process: {
      env: {
        SANITY_API_TOKEN: "canonical-fixture",
        NEXT_SANITY_API_TOKEN: "legacy-fixture",
      },
    },
  });
  assert.equal(configurations.at(-1).token, undefined);
});

test("checkout accepts the existing Vercel token name and stops before writes when configuration is missing", async () => {
  const base = {
    NEXT_PRIVATE_PAYSTACK_SECRET_KEY: "fixture",
    NEXT_PUBLIC_BASE_URL: "https://example.test",
  };
  const alias = await setup({
    process: { env: { ...base, NEXT_SANITY_API_TOKEN: "fixture" } },
  });
  assert.equal((await alias.checkout.startCheckout(payload())).success, true);
  for (const env of [
    base,
    {
      ...base,
      SANITY_API_TOKEN: "fixture",
      NEXT_PRIVATE_PAYSTACK_SECRET_KEY: "",
    },
    {
      ...base,
      SANITY_API_TOKEN: "fixture",
      NEXT_PUBLIC_BASE_URL: "invalid-url",
    },
  ]) {
    const context = await setup({ process: { env } });
    await assert.rejects(
      context.checkout.startCheckout(payload()),
      (error) =>
        error.code === "CHECKOUT_CONFIGURATION" && error.status === 503,
    );
    assert.equal(context.calls(), 0);
    assert.equal(
      context.db.all().some((doc) => doc._type === "order"),
      false,
    );
  }
});

test("permission and gateway failures have actionable codes without leaking SDK credentials or customer data", async () => {
  const logged = [];
  const { checkout, gateway, db } = await setup({
    console: { error: (...args) => logged.push(args) },
  });
  db.failAll = true;
  db.failure = Object.assign(new Error("sensitive-fixture-value"), {
    statusCode: 403,
    response: { headers: { Authorization: "sensitive-fixture-value" } },
  });
  await assert.rejects(
    checkout.startCheckout(payload()),
    (error) => error.code === "CHECKOUT_STORAGE_PERMISSIONS",
  );
  db.failAll = false;
  gateway.fail = true;
  gateway.failure = Object.assign(new Error("sensitive-fixture-value"), {
    response: { status: 401, data: { message: "sensitive-fixture-value" } },
  });
  await assert.rejects(
    checkout.startCheckout(payload()),
    (error) => error.code === "CHECKOUT_PAYMENT_CONFIGURATION",
  );
  const serialized = JSON.stringify(logged);
  assert.ok(serialized.includes("pending_order_creation"));
  assert.ok(serialized.includes("payment_initialization"));
  assert.equal(serialized.includes("sensitive-fixture-value"), false);
  assert.equal(serialized.includes("guest@example.test"), false);
});

test("guest signup requires emailed activation rather than claiming purchases by password", async () => {
  let created = false;
  const route = await load("app/api/signup/route.js", {
    bcryptjs: { hash: async () => "hash" },
    jsonwebtoken: {},
    uuid: { v4: () => "fixture" },
    "@/utils/sanity/client": {
      getUserByEmail: async () => ({ _id: "guest", isAnonymous: true }),
      createUser: async () => {
        created = true;
      },
    },
  });
  const response = await route.POST({
    json: async () => ({
      name: "Guest",
      email: "guest@example.test",
      password: "fixture-password",
    }),
  });
  assert.equal(response.status, 409);
  assert.equal((await response.json()).code, "GUEST_ACCOUNT");
  assert.equal(created, false);
});

test("emailed activation stores hashed, expiring tokens; activation consumes token and enables login", async () => {
  const db = database();
  let emailed;
  const send = await load("app/api/password-reset/route.js", {
    "node:crypto": crypto,
    "@/utils/lib/sendResetMailToUser": async (email, token) => {
      emailed = { email, token };
    },
    "@/utils/sanity/client": {
      client: db,
      getUserByEmail: async () => db.getDocument("account-1"),
    },
  });
  assert.equal(
    (await send.POST({ json: async () => ({ email: "guest@example.test" }) }))
      .status,
    200,
  );
  const account = await db.getDocument("account-1");
  assert.notEqual(account.resetTokenHash, emailed.token);
  assert.equal(account.resetToken, undefined);
  await db
    .patch("account-1")
    .set({ isAnonymous: true })
    .unset(["password"])
    .commit();
  const change = await load("app/api/password-change/route.js", {
    "node:crypto": crypto,
    bcryptjs: { hash: async () => "new-hash" },
    "@/utils/sanity/client": { client: db },
  });
  const request = {
    json: async () => ({ token: emailed.token, newPassword: "new-password" }),
  };
  assert.equal((await change.POST(request)).status, 200);
  assert.equal((await db.getDocument("account-1")).isAnonymous, false);
  assert.equal((await db.getDocument("account-1")).password, "new-hash");
  assert.equal((await change.POST(request)).status, 400);
  assert.equal(
    (
      await change.POST({
        json: async () => ({ token: emailed.token, newPassword: "short" }),
      })
    ).status,
    400,
  );
});

test("cart survives failed/cancelled payments and only matching verified purchase clears it", async () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
  const session = await load(
    "utils/checkoutSession.js",
    {},
    { sessionStorage: storage },
  );
  const body = payload();
  const attempt = await session.getCheckoutAttempt(body, null);
  assert.equal((await session.getCheckoutAttempt(body, null)).key, attempt.key);
  session.rememberPayment(attempt, "Euodia-fixture");
  let cleared = 0;
  session.clearPaidCart(
    "wrong-reference",
    body.cartItems,
    () => (cleared += 1),
  );
  assert.equal(cleared, 0);
  session.clearPaidCart("Euodia-fixture", body.cartItems, () => (cleared += 1));
  assert.equal(cleared, 1);
  assert.equal(values.size, 0);
  const next = await session.getCheckoutAttempt(body, null);
  assert.notEqual(next.key, attempt.key);
  session.rememberPayment(next, "Euodia-next");
  session.clearPaidCart(
    "Euodia-next",
    [{ _id: "meal-1", quantity: 4 }],
    () => (cleared += 1),
  );
  assert.equal(cleared, 1);
});

test("admin reset normalizes email, hashes its emailed token, and permits only one password change", async () => {
  const db = database();
  let emailedToken;
  let messages = 0;
  const reset = await load("app/api/admin/password-reset/route.js", {
    "node:crypto": crypto,
    "@/utils/lib/sendResetMail": async (email, token) => {
      assert.equal(email, "admin@example.test");
      emailedToken = token;
      messages += 1;
    },
    "@/utils/sanity/client": { client: db },
  });
  const response = await reset.POST({
    json: async () => ({ email: " ADMIN@EXAMPLE.TEST " }),
  });
  assert.equal(response.status, 200);
  assert.equal(messages, 1);
  const admin = await db.getDocument("admin-1");
  assert.match(emailedToken, /^[a-f0-9]{64}$/);
  assert.equal(
    admin.resetTokenHash,
    crypto.createHash("sha256").update(emailedToken).digest("hex"),
  );
  assert.equal(admin.resetToken, undefined);
  assert.equal(admin.password, "old-admin-hash");
  const missing = await reset.POST({
    json: async () => ({ email: "unknown@example.test" }),
  });
  assert.equal(missing.status, 200);
  assert.equal((await missing.json()).message, (await response.json()).message);
  assert.equal(messages, 1);
  const change = await load("app/api/admin/password-change/route.js", {
    "node:crypto": crypto,
    bcryptjs: { hash: async () => "new-admin-hash" },
    "@/utils/sanity/client": { client: db },
  });
  const request = {
    json: async () => ({ token: emailedToken, newPassword: "new-password" }),
  };
  const responses = await Promise.all([
    change.POST(request),
    change.POST(request),
  ]);
  assert.deepEqual(responses.map((item) => item.status).sort(), [200, 400]);
  const updated = await db.getDocument("admin-1");
  assert.equal(updated.password, "new-admin-hash");
  assert.equal(updated.isVerified, true);
  assert.equal(updated.resetTokenHash, undefined);
  assert.equal(updated.resetTokenExpiry, undefined);
  assert.equal((await change.POST(request)).status, 400);
  assert.equal(
    (
      await change.POST({
        json: async () => ({ token: emailedToken, newPassword: "short" }),
      })
    ).status,
    400,
  );
  await reset.POST({ json: async () => ({ email: "admin@example.test" }) });
  await db
    .patch("admin-1")
    .set({ resetTokenExpiry: new Date(Date.now() - 1000).toISOString() })
    .commit();
  assert.equal((await change.POST(request)).status, 400);
});

test("admin reset checks configuration before writes and reports permission failures safely", async () => {
  const db = database();
  let messages = 0;
  const logged = [];
  const deps = {
    "node:crypto": crypto,
    "@/utils/lib/sendResetMail": async () => {
      messages += 1;
    },
    "@/utils/sanity/client": { client: db },
  };
  const missing = await load("app/api/admin/password-reset/route.js", deps, {
    process: { env: {} },
    console: { error: (...args) => logged.push(args) },
  });
  const request = { json: async () => ({ email: "admin@example.test" }) };
  assert.equal(
    (await (await missing.POST(request)).json()).code,
    "ADMIN_RESET_CONFIGURATION",
  );
  assert.equal((await db.getDocument("admin-1")).resetTokenHash, undefined);
  const reset = await load("app/api/admin/password-reset/route.js", deps, {
    console: { error: (...args) => logged.push(args) },
  });
  db.failAll = true;
  db.failure = Object.assign(new Error("secret-fixture"), { statusCode: 403 });
  const failed = await reset.POST(request);
  assert.equal(failed.status, 503);
  assert.equal((await failed.json()).code, "ADMIN_RESET_STORAGE_PERMISSIONS");
  assert.equal(messages, 0);
  assert.ok(JSON.stringify(logged).includes("reset_token_save"));
  assert.equal(JSON.stringify(logged).includes("secret-fixture"), false);
  assert.equal(JSON.stringify(logged).includes("admin@example.test"), false);
});

test("admin email authentication failure is distinct from storage failure and malformed input", async () => {
  const db = database();
  const logged = [];
  const reset = await load(
    "app/api/admin/password-reset/route.js",
    {
      "node:crypto": crypto,
      "@/utils/lib/sendResetMail": async () => {
        throw Object.assign(new Error("secret-fixture"), {
          code: "EAUTH",
          responseCode: 535,
        });
      },
      "@/utils/sanity/client": { client: db },
    },
    { console: { error: (...args) => logged.push(args) } },
  );
  assert.equal(
    (await reset.POST({ json: async () => ({ email: "invalid" }) })).status,
    400,
  );
  const response = await reset.POST({
    json: async () => ({ email: "admin@example.test" }),
  });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).code, "ADMIN_RESET_EMAIL_AUTH");
  const serialized = JSON.stringify(logged);
  assert.ok(serialized.includes("email_delivery"));
  assert.ok(serialized.includes("535"));
  assert.equal(serialized.includes("secret-fixture"), false);
  assert.equal((await db.getDocument("admin-1")).password, "old-admin-hash");
});

test("admin reset mail uses the public reset route and bounded SMTP timeouts", async () => {
  let options;
  let message;
  const mail = await load("utils/lib/sendResetMail.js", {
    nodemailer: {
      createTransport: (config) => {
        options = config;
        return {
          sendMail: async (data) => {
            message = data;
            return { accepted: [data.to] };
          },
        };
      },
    },
  });
  await mail.default("admin@example.test", "a".repeat(64));
  assert.equal(options.socketTimeout, 15000);
  assert.equal(options.connectionTimeout, 10000);
  assert.equal(options.debug, false);
  assert.ok(
    message.html.includes("https://example.test/auth/reset-password?token="),
  );
  assert.equal(message.from, "sender@example.test");
});

test("Paystack initialization uses kobo, NGN and callback URL; verification errors propagate", async () => {
  let sent;
  const api = await load("utils/lib/paystack.js", {
    axios: {
      async post(url, body) {
        sent = body;
        return {
          data: {
            status: true,
            data: {
              reference: body.reference,
              authorization_url: "https://checkout.paystack.com/fixture",
            },
          },
        };
      },
      async get() {
        throw new Error("Offline");
      },
    },
  });
  await api.initializePaystack("guest@example.test", 372500, "Euodia-fixture");
  assert.equal(sent.amount, 372500);
  assert.equal(sent.currency, "NGN");
  assert.equal(sent.callback_url, "https://example.test/success");
  assert.equal(api.isPaystackUrl("https://evil.test/"), false);
  await assert.rejects(api.verifyPaystack("Euodia-fixture"), /Offline/);
});
