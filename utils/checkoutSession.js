const STORAGE_KEY = "euodia_checkout";

export function cartSignature(items) {
  return JSON.stringify(
    items
      .map(({ _id, quantity }) => ({ _id, quantity }))
      .sort((a, b) => a._id.localeCompare(b._id)),
  );
}

export async function getCheckoutAttempt(payload, userId) {
  const fingerprintBytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(
      JSON.stringify({ ...payload, identity: userId || null }),
    ),
  );
  const fingerprint = Array.from(new Uint8Array(fingerprintBytes), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  let previous;
  try {
    previous = JSON.parse(sessionStorage.getItem(STORAGE_KEY));
  } catch {
    /* expired/invalid entry */
  }
  if (previous?.fingerprint === fingerprint && previous.key) return previous;
  const attempt = {
    key: crypto.randomUUID(),
    fingerprint,
    cart: cartSignature(payload.cartItems),
  };
  // If storage is unavailable, stop before checkout rather than lose retry identity.
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(attempt));
  return attempt;
}

export function rememberPayment(attempt, reference) {
  sessionStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ ...attempt, reference }),
  );
}

export function clearPaidCart(reference, items, clear) {
  let attempt;
  try {
    attempt = JSON.parse(sessionStorage.getItem(STORAGE_KEY));
  } catch {
    return;
  }
  if (attempt?.reference !== reference) return;
  // Do not erase a different cart the customer built after leaving for payment.
  if (attempt.cart === cartSignature(items)) clear();
  sessionStorage.removeItem(STORAGE_KEY);
}
