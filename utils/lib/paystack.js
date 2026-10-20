import axios from "axios";

function config() {
  if (!process.env.NEXT_PRIVATE_PAYSTACK_SECRET_KEY) {
    throw new Error("Payment service is not configured");
  }
  return {
    headers: {
      Authorization: `Bearer ${process.env.NEXT_PRIVATE_PAYSTACK_SECRET_KEY}`,
    },
    timeout: 15000,
  };
}

export async function initializePaystack(email, amountInKobo, reference) {
  const baseUrl = new URL(process.env.NEXT_PUBLIC_BASE_URL);
  if (!["http:", "https:"].includes(baseUrl.protocol))
    throw new Error("Invalid callback URL");
  if (!Number.isSafeInteger(amountInKobo) || amountInKobo <= 0)
    throw new Error("Invalid payment amount");
  const response = await axios.post(
    "https://api.paystack.co/transaction/initialize",
    {
      email,
      amount: amountInKobo,
      currency: "NGN",
      reference,
      callback_url: new URL("/success", baseUrl).href,
    },
    config(),
  );
  const data = response.data?.data;
  if (
    !response.data?.status ||
    data?.reference !== reference ||
    !isPaystackUrl(data?.authorization_url)
  )
    throw new Error("Invalid payment response");
  return data;
}

export function isPaystackUrl(value) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" && url.hostname === "checkout.paystack.com"
    );
  } catch {
    return false;
  }
}

export async function verifyPaystack(reference) {
  const response = await axios.get(
    `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
    config(),
  );
  if (!response.data?.status || !response.data?.data)
    throw new Error("Payment verification unavailable");
  return response.data.data;
}
