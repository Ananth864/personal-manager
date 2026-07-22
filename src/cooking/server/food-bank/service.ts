import type { FoodBankRepo } from './repo'
import type { ScheduleRepo } from '../schedule/repo'
import type { RecipeRepo } from '../recipes/repo'
import {
  buildFoodBankSummary,
  computePlannedProductions
  
} from './availability'
import type {FoodBankEntry} from './availability';
import { addDays, mondayOfWeek, todayISO } from '../../schedule/date-utils'

/**
 * Food Bank service operations (CONTEXT.md → Food Bank; ADR-0002 / ADR-0006).
 *
 * Availability is derived elsewhere (availability.ts); this module holds the
 * mutations and the shared derivation orchestration that the tRPC
 * `foodBank.summary` procedure and the agent's per-turn snapshot both use (so
 * the Food Bank summary logic has one home, not two).
 */

/**
 * Derive the per-recipe Food Bank summary from the live repos. Shared by the
 * `foodBank.summary` tRPC procedure and the agent's state snapshot so the
 * produced/planned/reserved/discardable terms can't drift between them.
 */
export async function foodBankSummaryFor(
  foodBank: FoodBankRepo,
  schedule: ScheduleRepo,
  recipes: RecipeRepo,
): Promise<FoodBankEntry[]> {
  const [produced, reservations, plannedCooks, allRecipes] = await Promise.all([
    foodBank.listProduced(),
    schedule.listFoodBankSlots(),
    schedule.listPlannedCooks(),
    recipes.list(),
  ])
  const servingsById = new Map(allRecipes.map((r) => [r.id, r.servings]))
  const weekStart = mondayOfWeek(todayISO())
  const planned = computePlannedProductions(
    plannedCooks,
    (id) => servingsById.get(id),
    weekStart,
    addDays(weekStart, 14),
  )
  const nameById = new Map(allRecipes.map((r) => [r.id, r.name]))
  return buildFoodBankSummary(produced, planned, reservations, (id) =>
    id ? nameById.get(id) ?? 'Recipe' : 'Ad-hoc',
  )
}

/**
 * How many produced portions of `recipeId` (null = the ad-hoc pool) can be
 * removed without breaking a reservation: `produced − reserved`, floored at 0.
 * Shared by Discard (which throws if exceeded) and Uncook's banking reversal
 * (which floors silently — see schedule/cook.ts).
 */
export async function discardableFor(
  foodBank: FoodBankRepo,
  schedule: ScheduleRepo,
  recipeId: string | null,
): Promise<number> {
  const [produced, reservations] = await Promise.all([
    foodBank.listProduced(),
    schedule.listFoodBankSlots(),
  ])
  const producedFor = produced.find((p) => p.recipeId === recipeId)?.portions ?? 0
  const reservedFor = reservations.filter((r) => r.recipeId === recipeId).length
  return Math.max(0, producedFor - reservedFor)
}

/**
 * Discard `count` produced portions of `recipeId` (null = the ad-hoc pool)
 * directly from the Food Bank — e.g. they were thrown away or eaten without
 * being planned into a slot.
 *
 * Guards the reservation floor: produced may not drop below the number of
 * portions reserved by Food Bank slots, so a discard can never break a promise
 * a slot is holding. (To discard a reserved portion, clear the slot first.)
 */
export async function discardPortions(
  foodBank: FoodBankRepo,
  schedule: ScheduleRepo,
  recipeId: string | null,
  count: number,
): Promise<void> {
  if (!Number.isInteger(count) || count <= 0) {
    throw new Error('Discard count must be a positive whole number.')
  }
  const discardable = await discardableFor(foodBank, schedule, recipeId)
  if (count > discardable) {
    throw new Error(
      `Only ${discardable} of those portions can be discarded; the rest are reserved by meal slots.`,
    )
  }
  await foodBank.removePortions(recipeId, count)
}
