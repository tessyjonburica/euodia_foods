import { getSession } from "@/utils/lib/auth/getSession";
import { startCheckout, CheckoutError } from "@/utils/lib/checkout";

export async function POST(req) {
  try {
    const body = await req.json();
    const session = await getSession(req);
    const result = await startCheckout(body, session?.user?.userId);
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return Response.json(
        { message: "Invalid checkout request." },
        { status: 400 },
      );
    }
    if (error instanceof CheckoutError) {
      return Response.json(
        { message: error.message, ...(error.code ? { code: error.code } : {}) },
        { status: error.status },
      );
    }
    // Never log Axios request objects: they can contain payment credentials.
    console.error("Checkout failed:", error.name);
    return Response.json(
      {
        message:
          "We couldn't start your payment. Your cart is saved. Please try again.",
      },
      { status: 503 },
    );
  }
}
