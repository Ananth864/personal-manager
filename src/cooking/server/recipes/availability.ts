import type { InventoryItem } from '../inventory/types'
import type { Availability, RecipeIngredient } from './types'

/**
 * Cookability rule (CONTEXT.md → Shopping List / Cook).
 *
 * A required ingredient is available when its Inventory state is Endless, or
 * Tracked with a quantity greater than or equal to the amount the recipe
 * requires. Unavailable, insufficient Tracked, and not-in-inventory all count
 * as missing. Endless is always available regardless of required quantity.
 *
 * Pure and allocation-free over the given inputs; reused by the catalog badge,
 * the detail view, the Schedule (T04), and the Shopping List (T07).
 */
export function computeAvailability(
  ingredients: RecipeIngredient[],
  inventory: InventoryItem[],
): Availability {
  const byId = new Map(inventory.map((i) => [i.ingredient.id, i]))
  let missingCount = 0
  for (const line of ingredients) {
    const item = byId.get(line.ingredient.id)
    if (!item) {
      missingCount++
      continue
    }
    if (item.state === 'endless') continue
    if (item.state === 'tracked' && (item.quantity ?? 0) >= line.quantity) continue
    missingCount++
  }
  return { ok: missingCount === 0, missingCount }
}
