import type { InventoryItem } from '../inventory/types'
import type { RecipeDetail } from '../recipes/types'
import type { RecipeRepo } from '../recipes/repo'
import type { FoodBankRepo } from '../food-bank/repo'
import { availableFor, computePlannedProductions } from '../food-bank/availability'
import type { ScheduleRepo } from './repo'
import { addDays, isPastWeek, mondayOfWeek, todayISO, weekDays } from '../../schedule/date-utils'
import type {
  AdhocIngredient,
  DayPlan,
  MealPosition,
  MealSlot,
  SlotAssignment,
  SlotRow,
  UpsertSlotInput,
  Week,
} from './types'

export type { MealPosition, AssignmentType, AdhocIngredient, Week, MealSlot, DayPlan } from './types'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function validateSlotKey(slotDate: string): void {
  if (!ISO_DATE.test(slotDate)) {
    throw new Error('Slot date must be a yyyy-mm-dd ISO date.')
  }
}

function normalizeAdhocIngredients(lines: AdhocIngredient[]): AdhocIngredient[] {
  if (lines.length === 0) {
    throw new Error('An ad-hoc recipe needs at least one ingredient.')
  }
  const seen = new Set<string>()
  for (const line of lines) {
    if (!line.ingredientId) {
      throw new Error('Each ingredient line needs an ingredient.')
    }
    if (!Number.isFinite(line.quantity) || line.quantity <= 0) {
      throw new Error('Each ingredient quantity must be positive.')
    }
    if (seen.has(line.ingredientId)) {
      throw new Error('An ad-hoc recipe cannot list the same ingredient twice.')
    }
    seen.add(line.ingredientId)
  }
  return lines
}

// ---------------------------------------------------------------------------
// Read: build a hydrated week (pure; takes inventory as data for the flag only).
// ---------------------------------------------------------------------------

function toAssignment(
  row: SlotRow,
  recipeById: Map<string, RecipeDetail>,
): SlotAssignment {
  if (row.assignmentType === 'recipe') {
    const r = row.recipeId ? recipeById.get(row.recipeId) : undefined
    return {
      type: 'recipe',
      recipeId: row.recipeId ?? undefined,
      recipeName: r?.name ?? null,
      recipeServings: r?.servings ?? null,
    }
  }
  if (row.assignmentType === 'adhoc') {
    return {
      type: 'adhoc',
      adhocName: row.adhocName,
      adhocIngredients: row.adhocIngredients ?? [],
    }
  }
  if (row.assignmentType === 'foodbank') {
    const r = row.recipeId ? recipeById.get(row.recipeId) : undefined
    return {
      type: 'foodbank',
      recipeId: row.recipeId ?? undefined,
      recipeName: r?.name ?? null,
    }
  }
  return { type: row.assignmentType }
}

/** Resolve a slot's required ingredient lines, or null when there's nothing to check. */
function requiredLines(
  row: SlotRow,
  recipeById: Map<string, RecipeDetail>,
): { ingredientId: string; quantity: number }[] | null {
  if (row.assignmentType === 'recipe') {
    const r = row.recipeId ? recipeById.get(row.recipeId) : undefined
    if (!r) return null
    return r.ingredients.map((i) => ({
      ingredientId: i.ingredient.id,
      quantity: i.quantity,
    }))
  }
  if (row.assignmentType === 'adhoc') {
    return (row.adhocIngredients ?? []).map((a) => ({
      ingredientId: a.ingredientId,
      quantity: a.quantity,
    }))
  }
  return null
}

/**
 * Project this slot's shortfall against a *running* simulated balance of
 * Tracked ingredients. Only today-or-future, uncooked slots participate: the
 * flag is a forward-looking planning aid ("if I cook my remaining planned
 * meals with what I currently have, where do I come up short?"). Past slots
 * are water under the bridge, and cooked slots already consumed real
 * Inventory (simulating them would double-count). `sim` is seeded from the
 * current real Inventory, so past Cooks are already reflected in it.
 *
 * Walked chronologically, so an earlier planned cook consumes from `sim` and a
 * later meal that looked cookable in isolation can flag short once that Tracked
 * ingredient is used up. Endless ingredients are always available and never
 * consumed; Unavailable and not-in-inventory count as short. `sim` is mutated
 * in place. Planning is not Cooking (ADR-0001): this mutates only the
 * throwaway `sim` map, never the Inventory passed in.
 */
function projectShortfall(
  row: SlotRow,
  recipeById: Map<string, RecipeDetail>,
  invById: Map<string, InventoryItem>,
  sim: Map<string, number>,
  simulate: boolean,
): number | null {
  if (!simulate || row.cooked) return null
  const lines = requiredLines(row, recipeById)
  if (lines === null) return null
  let missing = 0
  for (const line of lines) {
    const inv = invById.get(line.ingredientId)
    if (!inv || inv.state === 'unavailable') {
      missing++
      continue
    }
    if (inv.state === 'endless') continue
    const avail = sim.get(line.ingredientId) ?? 0
    if (avail >= line.quantity) {
      sim.set(line.ingredientId, avail - line.quantity)
    } else {
      missing++
      sim.set(line.ingredientId, 0)
    }
  }
  return missing
}

function buildSlot(
  date: string,
  meal: MealPosition,
  slotByKey: Map<string, SlotRow>,
  recipeById: Map<string, RecipeDetail>,
  invById: Map<string, InventoryItem>,
  sim: Map<string, number>,
  simulate: boolean,
): MealSlot {
  const row = slotByKey.get(`${date}_${meal}`)
  if (!row) return { date, meal, assignment: null, shortfall: null, cooked: false }
  return {
    date,
    meal,
    assignment: toAssignment(row, recipeById),
    shortfall: projectShortfall(row, recipeById, invById, sim, simulate),
    cooked: row.cooked,
  }
}

export function buildWeek(
  weekStart: string,
  slots: SlotRow[],
  recipes: RecipeDetail[],
  inventory: InventoryItem[],
): Week {
  const recipeById = new Map(recipes.map((r) => [r.id, r]))
  const slotByKey = new Map(slots.map((s) => [`${s.slotDate}_${s.meal}`, s]))
  const invById = new Map(inventory.map((i) => [i.ingredient.id, i]))
  // Simulated Tracked balances for the sequential projection — a fresh copy, so
  // the real Inventory passed in is never mutated (ADR-0001: planning ≠ cooking).
  const sim = new Map<string, number>()
  for (const i of inventory) {
    if (i.state === 'tracked') sim.set(i.ingredient.id, i.quantity ?? 0)
  }
  const days: DayPlan[] = weekDays(weekStart).map((date) => {
    // Only today-or-future slots participate in the forward shortfall projection.
    const simulate = date >= todayISO()
    return {
      date,
      lunch: buildSlot(date, 'lunch', slotByKey, recipeById, invById, sim, simulate),
      dinner: buildSlot(date, 'dinner', slotByKey, recipeById, invById, sim, simulate),
    }
  })
  return { weekStart, days, readonly: isPastWeek(weekStart) }
}

// ---------------------------------------------------------------------------
// Write: Schedule mutations. NONE of these touch Inventory (ADR-0001).
// Past weeks are read-only archives, so every mutation rejects a past-week
// slot (enforces ADR-0006's archive-lock for Food Bank reservations too).
// ---------------------------------------------------------------------------

function rejectPastWeek(slotDate: string): void {
  if (slotDate < mondayOfWeek(todayISO())) {
    throw new Error("Can't edit a past week — past weeks are read-only.")
  }
}

export async function assignRecipe(
  repo: ScheduleRepo,
  slotDate: string,
  meal: MealPosition,
  recipeId: string,
): Promise<void> {
  validateSlotKey(slotDate)
  rejectPastWeek(slotDate)
  if (!recipeId) throw new Error('A recipe is required.')
  const input: UpsertSlotInput = {
    slotDate,
    meal,
    assignmentType: 'recipe',
    recipeId,
  }
  return repo.upsertSlot(input)
}

export async function assignAdhoc(
  repo: ScheduleRepo,
  slotDate: string,
  meal: MealPosition,
  payload: {
    name?: string | null
    ingredients: AdhocIngredient[]
    servings?: number | null
  },
): Promise<void> {
  validateSlotKey(slotDate)
  rejectPastWeek(slotDate)
  const servings = payload.servings == null ? 1 : payload.servings
  if (!Number.isInteger(servings) || servings < 1) {
    throw new Error('Ad-hoc servings must be a whole number of 1 or more.')
  }
  const input: UpsertSlotInput = {
    slotDate,
    meal,
    assignmentType: 'adhoc',
    adhocName: payload.name?.trim() ? payload.name.trim() : null,
    adhocIngredients: normalizeAdhocIngredients(payload.ingredients),
    adhocServings: servings,
  }
  return repo.upsertSlot(input)
}

export async function markNoCook(
  repo: ScheduleRepo,
  slotDate: string,
  meal: MealPosition,
): Promise<void> {
  validateSlotKey(slotDate)
  rejectPastWeek(slotDate)
  return repo.upsertSlot({ slotDate, meal, assignmentType: 'nocook' })
}

export async function clearSlot(
  repo: ScheduleRepo,
  slotDate: string,
  meal: MealPosition,
): Promise<void> {
  validateSlotKey(slotDate)
  rejectPastWeek(slotDate)
  return repo.clearSlot(slotDate, meal)
}

/**
 * Reserve a Food Bank portion into a slot (CONTEXT.md → Food Bank; ADR-0006).
 * Reduces availability; clearing the slot releases it. No Inventory effect —
 * ingredients were consumed at Cook time. Blocks when nothing is available.
 *
 * Availability includes portions projected from planned (uncooked) cooks, so a
 * plan can reserve the future portions of a meal cooked earlier in the week.
 */
export async function assignFoodBank(
  repo: ScheduleRepo,
  foodBankRepo: FoodBankRepo,
  recipeRepo: RecipeRepo,
  slotDate: string,
  meal: MealPosition,
  recipeId: string | null,
): Promise<void> {
  validateSlotKey(slotDate)
  rejectPastWeek(slotDate)
  const [produced, reservations, plannedCooks, recipes] = await Promise.all([
    foodBankRepo.listProduced(),
    repo.listFoodBankSlots(),
    repo.listPlannedCooks(),
    recipeRepo.list(),
  ])
  const servingsById = new Map(recipes.map((r) => [r.id, r.servings]))
  const weekStart = mondayOfWeek(todayISO())
  const planned = computePlannedProductions(
    plannedCooks,
    (id) => servingsById.get(id),
    weekStart,
    addDays(weekStart, 14),
  )
  const producedFor = produced
    .filter((p) => p.recipeId === recipeId)
    .reduce((sum, p) => sum + p.portions, 0)
  const plannedFor = planned
    .filter((p) => p.recipeId === recipeId)
    .reduce((sum, p) => sum + p.portions, 0)
  const reservedFor = reservations.filter((r) => r.recipeId === recipeId).length
  if (availableFor(producedFor, plannedFor, reservedFor) <= 0) {
    throw new Error('No portions available in the Food Bank for that recipe.')
  }
  await repo.upsertSlot({ slotDate, meal, assignmentType: 'foodbank', recipeId })
}
