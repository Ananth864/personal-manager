import { applyCookDecrement } from '../inventory/rules'
import type { InventoryRepo } from '../inventory/repo'
import type { InventoryItem, InventoryState } from '../inventory/types'
import type { RecipeRepo } from '../recipes/repo'
import type { FoodBankRepo } from '../food-bank/repo'
import type { ScheduleRepo } from './repo'
import type { MealPosition } from './types'

/** One row of the Cook confirmation table: an ingredient's current → new state. */
export interface CookLine {
  ingredientId: string
  name: string
  unit: string
  required: number
  currentState: InventoryState
  currentQty: number | null
  newState: InventoryState
  newQty: number | null
  /** Whether Cook changes this ingredient at all. */
  changed: boolean
  /** Warn-only flag: Unavailable, or Tracked with insufficient quantity. */
  warning: boolean
}

export interface CookPreview {
  /** Portions this Cook will add to the Food Bank (0 for Ad-hoc). */
  portionsToProduce: number
  lines: CookLine[]
}

/**
 * Build the Cook confirmation table (pure). Uses `applyCookDecrement` to
 * project each ingredient's new state without mutating anything — the same
 * rule runs for real on Confirm, so preview and apply can't drift.
 */
export function buildCookPreview(
  lines: { ingredientId: string; quantity: number; name: string; unit: string }[],
  inventory: InventoryItem[],
  portionsToProduce: number,
): CookPreview {
  const invById = new Map(inventory.map((i) => [i.ingredient.id, i]))
  return {
    portionsToProduce,
    lines: lines.map((line) => {
      const base = {
        ingredientId: line.ingredientId,
        name: line.name,
        unit: line.unit,
        required: line.quantity,
      }
      const item = invById.get(line.ingredientId)
      if (!item) {
        return {
          ...base,
          currentState: 'unavailable',
          currentQty: null,
          newState: 'unavailable',
          newQty: null,
          changed: false,
          warning: true,
        }
      }
      const projected = applyCookDecrement(item, line.quantity)
      return {
        ...base,
        currentState: item.state,
        currentQty: item.quantity,
        newState: projected.state,
        newQty: projected.quantity,
        changed: projected.state !== item.state || projected.quantity !== item.quantity,
        warning:
          item.state === 'unavailable' ||
          (item.state === 'tracked' && (item.quantity ?? 0) < line.quantity),
      }
    }),
  }
}

/**
 * Cook a slot's meal (CONTEXT.md → Cook; ADR-0001/0002). This is the ONE
 * operation that mutates Tracked Ingredient Inventory and the one that produces
 * Food Bank portions. Warn-only — never blocks, never goes negative.
 *
 * - Recipe slots: decrement ingredients, bank `servings − 1` portions (the
 *   cooking slot eats one of the portions it just prepared).
 * - Ad-hoc slots: decrement ingredients, bank `adhocServings − 1` portions into
 *   the commingled ad-hoc pool (null recipe id).
 *
 * One Cook per slot is enforced by an atomic conditional claim (`claimForCook`)
 * BEFORE any decrement or portion write — two concurrent Cooks can't both
 * proceed. Planning is not Cooking (ADR-0001); Cook is the deliberate exception.
 */
export async function cook(
  scheduleRepo: ScheduleRepo,
  inventoryRepo: InventoryRepo,
  foodBankRepo: FoodBankRepo,
  recipeRepo: RecipeRepo,
  slotDate: string,
  meal: MealPosition,
): Promise<{ produced: number }> {
  const slot = await scheduleRepo.getSlot(slotDate, meal)
  if (!slot) {
    throw new Error('Nothing is assigned to this slot to cook.')
  }
  if (slot.cooked) {
    throw new Error('This meal has already been cooked.')
  }

  // Resolve the required lines + portions BEFORE claiming (read-only).
  let lines: { ingredientId: string; quantity: number }[]
  let portionsToProduce: number
  let bankKey: string | null
  if (slot.assignmentType === 'recipe') {
    if (!slot.recipeId) throw new Error('This slot has no recipe to cook.')
    const recipe = await recipeRepo.get(slot.recipeId)
    if (!recipe) throw new Error('The recipe for this slot could not be found.')
    lines = recipe.ingredients.map((i) => ({
      ingredientId: i.ingredient.id,
      quantity: i.quantity,
    }))
    portionsToProduce = Math.max(0, recipe.servings - 1)
    bankKey = slot.recipeId
  } else if (slot.assignmentType === 'adhoc') {
    lines = (slot.adhocIngredients ?? []).map((a) => ({
      ingredientId: a.ingredientId,
      quantity: a.quantity,
    }))
    // The cooking slot eats one portion; the rest go to the Food Bank.
    portionsToProduce = Math.max(0, (slot.adhocServings ?? 1) - 1)
    bankKey = null // the commingled ad-hoc pool
  } else {
    throw new Error('Only fresh-cook slots (Recipe or Ad-hoc) can be cooked.')
  }

  // Atomically claim the slot. If another Cook claimed it between our getSlot
  // and now, this returns false and we abort before touching Inventory.
  const claimed = await scheduleRepo.claimForCook(slotDate, meal)
  if (!claimed) {
    throw new Error('This meal has already been cooked.')
  }

  // Decrement Tracked ingredients (Endless/Unavailable unaffected). Cook is
  // warn-only — never blocks, never goes negative.
  for (const line of lines) {
    const item = await inventoryRepo.get(line.ingredientId)
    if (!item) continue
    await inventoryRepo.save(applyCookDecrement(item, line.quantity))
  }

  if (portionsToProduce > 0) {
    await foodBankRepo.addPortions(bankKey, portionsToProduce)
  }

  return { produced: portionsToProduce }
}
