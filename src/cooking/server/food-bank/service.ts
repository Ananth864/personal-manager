import type { FoodBankRepo } from './repo'
import type { ScheduleRepo } from '../schedule/repo'

/**
 * Food Bank service operations (CONTEXT.md → Food Bank; ADR-0002 / ADR-0006).
 *
 * Availability is derived elsewhere (availability.ts); this module holds the
 * mutations that aren't Cook or Schedule reservations — currently Discard, the
 * direct reduction of produced portions without assigning a meal slot.
 */

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
