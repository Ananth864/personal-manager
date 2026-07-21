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
  const [produced, reservations] = await Promise.all([
    foodBank.listProduced(),
    schedule.listFoodBankSlots(),
  ])
  const producedFor = produced.find((p) => p.recipeId === recipeId)?.portions ?? 0
  const reservedFor = reservations.filter((r) => r.recipeId === recipeId).length
  const discardable = producedFor - reservedFor
  if (count > discardable) {
    throw new Error(
      `Only ${discardable} portion${discardable === 1 ? '' : 's'} can be discarded ` +
        `(${reservedFor} are reserved by meal slots).`,
    )
  }
  await foodBank.removePortions(recipeId, count)
}
