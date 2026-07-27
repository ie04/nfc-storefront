export function formatMoney(cents: number | undefined) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    style: "currency",
  }).format((cents ?? 0) / 100);
}

export function formatDate(value: string | undefined) {
  if (!value) return "Not yet";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Not yet"
    : new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(date);
}
