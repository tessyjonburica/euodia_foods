const currency = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const date = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export function formatOrderAmount(value) {
  if (value == null || value === "" || !Number.isFinite(Number(value)))
    return "—";
  return currency.format(Number(value));
}

export function formatOrderDate(value) {
  if (!value) return "Date unavailable";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? "Date unavailable"
    : date.format(parsed);
}

export function getPaymentStatus(value) {
  const status = String(value ?? "")
    .trim()
    .toLowerCase();
  if (["success", "successful", "paid", "completed"].includes(status)) {
    return { label: "Paid", tone: "green" };
  }
  if (["failed", "failure"].includes(status))
    return { label: "Failed", tone: "red" };
  if (["cancelled", "canceled", "abandoned"].includes(status)) {
    return { label: "Not completed", tone: "gray" };
  }
  if (status === "processing") return { label: "Processing", tone: "blue" };
  if (status === "pending") return { label: "Pending", tone: "amber" };
  return { label: "Unknown", tone: "gray" };
}

export function getOrderReference(transaction) {
  return (
    transaction.transactionRef || transaction._id || "Reference unavailable"
  );
}
