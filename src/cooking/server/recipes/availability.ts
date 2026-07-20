import type { InventoryItem } from '../inventory/types'
import type { Availability } from './types'

/**
 * A required-ingredient line, reduced to just what availability depends on:
 * which ingredient and how much. Decoupled from RecipeIngredient so ad-hoc
 * recipes (T04) and the Shopping List (T07) feed it directly without building
 * full Ingredient objects.
 */
export interface AvailabilityLine {
  ingredientId: string
  quantity: number
}

/**
 * Cookability rule (CONTEXT.md → Shopping List / Cook).
 *
 * A required ingredient is available when its Inventory state is Endless, or
 * Tracked with a quantity greater than or equal to the amount required.
 * Unavailable, insufficient Tracked, and not-in-inventory all count as missing.
 * Endless is always available regardless of required quantity.
 *
 * Pure and allocation-free over the given inputs; reused by the recipe catalog
 * badge, the Schedule slot flag (T04), and the Shopping List (T07).
 */
export function computeAvailability(
  lines: AvailabilityLine[],
  inventory: InventoryItem[],
): Availability {
  const byId = new Map(inventory.map((i) => [i.ingredient.id, i]))
  let missingCount = 0
  for (const line of lines) {
    const item = byId.get(line.ingredientId)
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
