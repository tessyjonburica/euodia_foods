import { createHmac, timingSafeEqual } from "node:crypto";
import { finalizePayment } from "@/utils/lib/finalizePayment";

export const runtime = "nodejs";

export async function POST(req) {
  const secret = process.env.NEXT_PRIVATE_PAYSTACK_SECRET_KEY;
  if (!secret)
    return Response.json(
      { message: "Payment service unavailable" },
      { status: 503 },
    );
  const raw = await req.text();
  const signature = req.headers.get("x-paystack-signature") || "";
  if (!/^[a-f0-9]{128}$/i.test(signature))
    return new Response(null, { status: 401 });
  const expected = createHmac("sha512", secret).update(raw).digest();
  if (!timingSafeEqual(expected, Buffer.from(signature, "hex")))
    return new Response(null, { status: 401 });
  try {
    const event = JSON.parse(raw);
    if (
      event.event === "charge.success" &&
      event.data?.reference?.startsWith("Euodia-")
    ) {
      await finalizePayment(event.data.reference);
    }
    return Response.json({ received: true });
  } catch (error) {
    console.error("Payment webhook processing failed:", error.name);
    // A non-200 response asks Paystack to redeliver; no detached background work.
    return Response.json({ message: "Please retry delivery" }, { status: 503 });
  }
}
