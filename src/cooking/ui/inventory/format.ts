/** Formats a numeric quantity for display, trimming trailing zeros. */
export function formatQuantity(quantity: number | null): string | null {
  if (quantity == null) return null
  const rounded = Math.round(quantity * 1000) / 1000
  return Number.isInteger(rounded) ? String(rounded) : String(rounded)
}
