/** Formats a numeric quantity for display. Number→String already trims trailing zeros. */
export function formatQuantity(quantity: number | null): string | null {
  if (quantity == null) return null
  return String(Math.round(quantity * 1000) / 1000)
}
