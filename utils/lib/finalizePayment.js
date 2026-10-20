import { client } from "@/utils/sanity/client";
import { verifyPaystack } from "@/utils/lib/paystack";
import { CheckoutError } from "@/utils/lib/checkout";

export async function finalizePayment(reference) {
  if (
    typeof reference !== "string" ||
    !/^[a-zA-Z0-9_-]{1,100}$/.test(reference)
  ) {
    throw new CheckoutError("A valid payment reference is required.");
  }
  // A gateway/network error must remain retryable, never become a failed payment.
  const payment = await verifyPaystack(reference);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const transaction = await client.fetch(
      '*[_type == "transaction" && transactionRef == $reference][0]',
      { reference },
    );
    const order = transaction?.order?._ref
      ? await client.getDocument(transaction.order._ref)
      : null;
    if (!transaction || !order)
      throw new CheckoutError(
        "Order not found. Please contact support with your payment reference.",
        404,
      );
    const expectedAmount = order.amountInKobo ?? Math.round(order.total * 100);
    if (
      payment.reference !== reference ||
      payment.currency !== "NGN" ||
      !Number.isSafeInteger(payment.amount) ||
      payment.amount !== expectedAmount
    ) {
      throw new CheckoutError(
        "Payment details do not match this order. Please contact support.",
        409,
      );
    }
    if (payment.status !== "success") {
      throw new CheckoutError(
        "Payment has not been confirmed. Your cart is saved; please check your payment before retrying.",
        409,
      );
    }
    if (order.paymentStatus === "paid") return { success: true, reference };
    const now = new Date().toISOString();
    let mutation = client
      .transaction()
      .patch(order._id, (patch) =>
        patch
          .ifRevisionId(order._rev)
          .set({ paymentStatus: "paid", paidAt: now }),
      )
      .patch(transaction._id, (patch) =>
        patch.set({ status: "success", paidAt: now }),
      );
    // Older checkout already incremented these figures before payment. Do not
    // increment them again or attempt an automatic migration of historical data.
    if (order.checkoutVersion === 2) {
      mutation = mutation.patch(order.customer._ref, (patch) =>
        patch
          .setIfMissing({
            orders: [],
            transactions: [],
            orderCount: 0,
            totalSpent: 0,
          })
          .append("orders", [
            { _key: order._id, _type: "reference", _ref: order._id },
          ])
          .append("transactions", [
            {
              _key: transaction._id,
              _type: "reference",
              _ref: transaction._id,
            },
          ])
          .inc({ orderCount: 1, totalSpent: order.total }),
      );
    }
    try {
      // The revision guard and all accounting writes commit atomically. A
      // callback/webhook race retries and observes the already-paid order.
      await mutation.commit();
      return { success: true, reference };
    } catch (error) {
      if (error.statusCode !== 409 || attempt === 2) throw error;
    }
  }
}
