import { applyCookDecrement, applyUncookIncrement } from '../inventory/rules'
import type { InventoryRepo } from '../inventory/repo'
import type { IngredientLedgerRepo } from '../inventory/ledger-repo'
import type { InventoryItem, InventoryState } from '../inventory/types'
import type { RecipeRepo } from '../recipes/repo'
import type { FoodBankRepo } from '../food-bank/repo'
import { discardableFor } from '../food-bank/service'
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
  ledgerRepo: IngredientLedgerRepo,
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

  // Atomically claim the slot, recording the portions this Cook banks so Uncook
  // can reverse exactly that. If another Cook claimed it between our getSlot and
  // now, this returns false and we abort before touching Inventory.
  const claimed = await scheduleRepo.claimForCook(slotDate, meal, portionsToProduce)
  if (!claimed) {
    throw new Error('This meal has already been cooked.')
  }

  // Decrement Tracked ingredients (Endless/Unavailable unaffected). Cook is
  // warn-only — never blocks, never goes negative. Each actual delta is recorded
  // in the Ingredient Ledger so this Cook can be reversed by Uncook (ADR-0008).
  for (const line of lines) {
    const item = await inventoryRepo.get(line.ingredientId)
    if (!item) continue
    const projected = applyCookDecrement(item, line.quantity)
    await inventoryRepo.save(projected)
    if (item.state === 'tracked') {
      const before = item.quantity ?? 0
      const after = projected.quantity ?? 0
      if (after !== before) {
        await ledgerRepo.record({
          ingredientId: line.ingredientId,
          delta: after - before,
          sourceDate: slotDate,
          sourceMeal: meal,
        })
      }
    }
  }

  if (portionsToProduce > 0) {
    await foodBankRepo.addPortions(bankKey, portionsToProduce)
  }

  return { produced: portionsToProduce }
}

/**
 * Uncook a slot's meal (CONTEXT.md → Uncook; ADR-0008). The deliberate inverse
 * of Cook — the second thing that mutates Tracked Inventory. Replays the slot's
 * Ingredient Ledger entries (restoring each actual delta, so Unavailable →
 * Tracked where quantity becomes positive), reverses the Food Bank production
 * recorded on the slot (floored at `produced − reserved` so reservations stay
 * backed), and releases the cooked flag so the slot can be cooked again.
 *
 * Endless/Unavailable ingredients had no ledger entry and so are unaffected.
 * Manual edits made between Cook and Uncook are preserved — only the Cook's own
 * delta is reversed. The banking reversal is non-throwing: if portions were
 * reserved after the Cook, fewer are pulled back (clear those slots first to
 * fully reverse the banking). The banked portions are read from the slot (set
 * at cook time) rather than re-derived from the recipe, so editing the recipe's
 * servings between Cook and Uncook does not skew the reversal.
 */
export async function uncook(
  scheduleRepo: ScheduleRepo,
  inventoryRepo: InventoryRepo,
  foodBankRepo: FoodBankRepo,
  ledgerRepo: IngredientLedgerRepo,
  slotDate: string,
  meal: MealPosition,
): Promise<{ reversedPortions: number }> {
  const slot = await scheduleRepo.getSlot(slotDate, meal)
  if (!slot) {
    throw new Error('Nothing is assigned to this slot.')
  }
  if (!slot.cooked) {
    throw new Error('This meal has not been cooked yet.')
  }
  if (slot.assignmentType !== 'recipe' && slot.assignmentType !== 'adhoc') {
    throw new Error('Only fresh-cook slots (Recipe or Ad-hoc) can be uncooked.')
  }

  // The portions this Cook banked, recorded on the slot at cook time.
  const bankKey = slot.assignmentType === 'recipe' ? slot.recipeId : null
  const portionsProduced = slot.bankedPortions ?? 0

  // 1. Restore ingredients: replay each ledger delta in reverse (+|delta|).
  const entries = await ledgerRepo.listActiveForSlot(slotDate, meal)
  for (const entry of entries) {
    const item = await inventoryRepo.get(entry.ingredientId)
    if (!item) continue
    await inventoryRepo.save(applyUncookIncrement(item, Math.abs(entry.delta)))
  }

  // 2. Mark the ledger entries reversed (append-only; keep the audit trail).
  await ledgerRepo.reverseForSlot(slotDate, meal)

  // 3. Reverse the Food Bank production, floored so reservations stay backed.
  let reversedPortions = 0
  if (portionsProduced > 0) {
    const discardable = await discardableFor(foodBankRepo, scheduleRepo, bankKey)
    reversedPortions = Math.min(portionsProduced, discardable)
    if (reversedPortions > 0) {
      await foodBankRepo.removePortions(bankKey, reversedPortions)
    }
  }

  // 4. Release the cook claim (last, after all reversals succeeded).
  await scheduleRepo.releaseCook(slotDate, meal)

  return { reversedPortions }
}
