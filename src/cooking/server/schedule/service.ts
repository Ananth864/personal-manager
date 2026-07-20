import { computeAvailability } from '../recipes/availability'
import type { InventoryItem } from '../inventory/types'
import type { RecipeDetail } from '../recipes/types'
import type { ScheduleRepo } from './repo'
import { isPastWeek, weekDays } from '../../schedule/date-utils'
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
    throw new Error('An ad-hoc meal needs at least one ingredient.')
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
      throw new Error('An ad-hoc meal cannot list the same ingredient twice.')
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
  return { type: row.assignmentType }
}

function shortfallFor(
  row: SlotRow,
  recipeById: Map<string, RecipeDetail>,
  inventory: InventoryItem[],
): number | null {
  if (row.assignmentType === 'recipe') {
    const r = row.recipeId ? recipeById.get(row.recipeId) : undefined
    if (!r) return null
    return computeAvailability(
      r.ingredients.map((i) => ({ ingredientId: i.ingredient.id, quantity: i.quantity })),
      inventory,
    ).missingCount
  }
  if (row.assignmentType === 'adhoc') {
    return computeAvailability(row.adhocIngredients ?? [], inventory).missingCount
  }
  return null
}

function buildSlot(
  date: string,
  meal: MealPosition,
  slotByKey: Map<string, SlotRow>,
  recipeById: Map<string, RecipeDetail>,
  inventory: InventoryItem[],
): MealSlot {
  const row = slotByKey.get(`${date}_${meal}`)
  if (!row) return { date, meal, assignment: null, shortfall: null }
  return {
    date,
    meal,
    assignment: toAssignment(row, recipeById),
    shortfall: shortfallFor(row, recipeById, inventory),
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
  const days: DayPlan[] = weekDays(weekStart).map((date) => ({
    date,
    lunch: buildSlot(date, 'lunch', slotByKey, recipeById, inventory),
    dinner: buildSlot(date, 'dinner', slotByKey, recipeById, inventory),
  }))
  return { weekStart, days, readonly: isPastWeek(weekStart) }
}

// ---------------------------------------------------------------------------
// Write: Schedule mutations. NONE of these touch Inventory (ADR-0001).
// ---------------------------------------------------------------------------

export async function assignRecipe(
  repo: ScheduleRepo,
  slotDate: string,
  meal: MealPosition,
  recipeId: string,
): Promise<void> {
  validateSlotKey(slotDate)
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
  payload: { name?: string | null; ingredients: AdhocIngredient[] },
): Promise<void> {
  validateSlotKey(slotDate)
  const input: UpsertSlotInput = {
    slotDate,
    meal,
    assignmentType: 'adhoc',
    adhocName: payload.name?.trim() ? payload.name.trim() : null,
    adhocIngredients: normalizeAdhocIngredients(payload.ingredients),
  }
  return repo.upsertSlot(input)
}

export async function markNoCook(
  repo: ScheduleRepo,
  slotDate: string,
  meal: MealPosition,
): Promise<void> {
  validateSlotKey(slotDate)
  return repo.upsertSlot({ slotDate, meal, assignmentType: 'nocook' })
}

export async function clearSlot(
  repo: ScheduleRepo,
  slotDate: string,
  meal: MealPosition,
): Promise<void> {
  validateSlotKey(slotDate)
  return repo.clearSlot(slotDate, meal)
}
