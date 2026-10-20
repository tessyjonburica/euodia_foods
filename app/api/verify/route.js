import { finalizePayment } from "@/utils/lib/finalizePayment";
import { CheckoutError } from "@/utils/lib/checkout";

export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    const params = new URL(req.url).searchParams;
    const result = await finalizePayment(
      params.get("trxref") || params.get("reference"),
    );
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof CheckoutError) {
      return Response.json(
        { message: error.message },
        { status: error.status },
      );
    }
    console.error("Payment verification unavailable:", error.name);
    return Response.json(
      {
        message:
          "We couldn't confirm your payment yet. Please retry verification or contact support.",
      },
      { status: 503 },
    );
  }
}
