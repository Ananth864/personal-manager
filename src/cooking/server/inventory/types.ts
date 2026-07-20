/**
 * Inventory state machine (CONTEXT.md → Ingredients & Inventory).
 *
 * - Endless: available, unquantified, never decremented. quantity is null.
 * - Tracked: available with quantity > 0; decremented when a Recipe that
 *   requires it is cooked.
 * - Unavailable: not available (quantity 0, or explicitly marked out).
 */
export type InventoryState = 'endless' | 'tracked' | 'unavailable'

/** The allowed canonical units for an Ingredient. */
export const UNITS = ['piece', 'g', 'kg', 'ml', 'L'] as const
export type Unit = (typeof UNITS)[number]

export interface Ingredient {
  id: string
  name: string
  /** Canonical unit — every quantity for this ingredient is expressed in it. */
  unit: Unit
  createdAt: Date
}

export interface InventoryItem {
  ingredient: Ingredient
  state: InventoryState
  /** null for Endless; 0 for Unavailable; >0 for Tracked. */
  quantity: number | null
  updatedAt: Date
}
