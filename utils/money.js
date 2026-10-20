// Older catalogue records store prices as decimal text. Accept those without
// treating empty values, booleans, or partially numeric strings as money.
export function parseNairaPrice(value) {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!/^\d+(?:\.\d{1,2})?$/.test(trimmed)) return null;
    value = Number(trimmed);
  }
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0 ||
    !Number.isSafeInteger(Math.round(value * 100))
  )
    return null;
  return value;
}
