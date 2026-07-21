import type { PlannedCook } from '../food-bank/availability'
import type { RecipeDetail } from '../recipes/types'
import type { InventoryItem, Unit } from '../inventory/types'
import { resolveRequiredLines } from '../schedule/service'

export interface ShoppingListItem {
  ingredientId: string
  name: string
  unit: Unit
  /** Total required across planned fresh cooks. */
  needed: number
  /** Currently on hand (Tracked quantity; 0 for Unavailable / not in inventory). */
  have: number
  /** `needed − have`, floored at 0 — the amount to buy. */
  buy: number
}

/**
 * The Shopping List (CONTEXT.md → Shopping List). A derived view — not stored —
 * of ingredients required by planned fresh Cooks (uncooked Recipe/Ad-hoc slots
 * in the plannable horizon, today onward) that aren't fully available.
 *
 * Aggregates the required quantity per ingredient across all such cooks, then
 * subtracts what's currently on hand:
 *   - Endless ingredients never appear (always available).
 *   - Tracked-with-surplus and fully-met ingredients don't appear (nothing to buy).
 *   - Unavailable and not-in-inventory count as zero on hand (buy the full amount).
 *
 * Food Bank withdrawal slots don't contribute — their ingredients were consumed
 * at Cook time, and `plannedCooks` only covers Recipe/Ad-hoc slots. Cooked slots
 * are excluded too (their ingredients are already gone). Pure over its inputs.
 *
 * The aggregation (total required − current on hand) gives the same cumulative
 * buy-quantity as a sequential consumption simulation, since the total needed is
 * independent of cook order — only the per-slot *warning* needs the sequential
 * walk (handled by the Schedule shortfall flag, T04).
 */
export function buildShoppingList(
  plannedCooks: PlannedCook[],
  recipes: RecipeDetail[],
  inventory: InventoryItem[],
  today: string,
  horizonEnd: string,
): ShoppingListItem[] {
  const recipeById = new Map(recipes.map((r) => [r.id, r]))
  const invById = new Map(inventory.map((i) => [i.ingredient.id, i]))

  // name/unit resolution: inventory holds every ingredient (created via
  // addIngredient); recipe lines are a fallback in case one is missing.
  const infoById = new Map<string, { name: string; unit: Unit }>()
  for (const r of recipes) {
    for (const ri of r.ingredients) {
      infoById.set(ri.ingredient.id, { name: ri.ingredient.name, unit: ri.ingredient.unit })
    }
  }
  for (const i of inventory) {
    infoById.set(i.ingredient.id, { name: i.ingredient.name, unit: i.ingredient.unit })
  }

  const needed = new Map<string, number>()
  for (const cook of plannedCooks) {
    if (cook.slotDate < today || cook.slotDate >= horizonEnd) continue
    const lines = resolveRequiredLines(cook, recipeById)
    if (!lines) continue
    for (const line of lines) {
      needed.set(line.ingredientId, (needed.get(line.ingredientId) ?? 0) + line.quantity)
    }
  }

  const items: ShoppingListItem[] = []
  for (const [ingredientId, total] of needed) {
    const item = invById.get(ingredientId)
    if (item?.state === 'endless') continue
    const have = item?.state === 'tracked' ? (item.quantity ?? 0) : 0
    const buy = Math.max(0, total - have)
    if (buy <= 0) continue
    const info = infoById.get(ingredientId) ?? { name: 'Ingredient', unit: 'piece' as Unit }
    items.push({ ingredientId, name: info.name, unit: info.unit, needed: total, have, buy })
  }
  return items.sort((a, b) => a.name.localeCompare(b.name))
}
