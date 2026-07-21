import type { InventoryItem, InventoryState } from './types'

/**
 * Pure inventory state transitions — the domain rules, free of I/O.
 * These encode the Endless / Tracked / Unavailable machine from CONTEXT.md
 * and are the stable seam the service-layer tests target.
 */

export function applyRestock(item: InventoryItem, qtyAdded: number): InventoryItem {
  if (qtyAdded <= 0) {
    throw new Error('Restock amount must be positive.')
  }
  // Only Tracked carries forward; Endless/Unavailable start from zero.
  const base = item.state === 'tracked' && item.quantity != null ? item.quantity : 0
  return {
    ...item,
    state: 'tracked',
    quantity: base + qtyAdded,
    updatedAt: new Date(),
  }
}

export function applySetState(
  item: InventoryItem,
  state: InventoryState,
  quantity?: number,
): InventoryItem {
  if (state === 'endless') {
    return { ...item, state: 'endless', quantity: null, updatedAt: new Date() }
  }
  if (state === 'unavailable') {
    return { ...item, state: 'unavailable', quantity: 0, updatedAt: new Date() }
  }
  if (quantity == null) {
    throw new Error('Tracked state requires a quantity.')
  }
  if (quantity <= 0) {
    throw new Error('Tracked quantity must be positive.')
  }
  return { ...item, state: 'tracked', quantity, updatedAt: new Date() }
}

/**
 * The Cook decrement (CONTEXT.md → Cook). The only rule that lowers a Tracked
 * quantity. Tracked ingredients drop by `required`, clamping at zero; reaching
 * zero transitions the ingredient to Unavailable. Endless ingredients are
 * unaffected (staples you never count). Unavailable ingredients stay
 * Unavailable — never negative, even when the recipe calls for more than is on
 * hand. Cook is warn-only (never blocks), so this never throws.
 */
export function applyCookDecrement(item: InventoryItem, required: number): InventoryItem {
  if (item.state === 'endless') return item
  if (item.state === 'unavailable') return item
  const current = item.quantity ?? 0
  const next = Math.max(0, current - required)
  return {
    ...item,
    state: next === 0 ? 'unavailable' : 'tracked',
    quantity: next,
    updatedAt: new Date(),
  }
}
