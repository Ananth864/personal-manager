/**
 * Food Bank availability (CONTEXT.md → Food Bank; ADR-0002 / ADR-0006).
 *
 * Availability is derived, not stored: produced portions (from Cooks) minus
 * every reservation (a Meal Slot assigned to withdraw a portion). A reservation
 * in a current/future week is *active* (clearable — clearing the slot releases
 * it); a reservation in an archived past week is *permanent consumption* (past
 * weeks are read-only, so it can't be cleared and stays counted). Both subtract
 * equally from availability — the active/permanent split is about clearability,
 * not the count.
 *
 * Portions are tracked per Recipe (catalog) and commingled across Cooks of the
 * same Recipe; the NULL recipe id is the commingled ad-hoc pool.
 */

export interface ProducedPortion {
  recipeId: string | null
  portions: number
}

export interface Reservation {
  recipeId: string | null
  slotDate: string
}

export interface FoodBankEntry {
  recipeId: string | null
  recipeName: string
  produced: number
  available: number
}

/** Available portions for one recipe: produced minus all reservations for it. */
export function availableFor(produced: number, reservationCount: number): number {
  return produced - reservationCount
}

/**
 * Build the per-recipe Food Bank summary. `recipeNameFor` resolves a recipe id
 * to its display name (null → the ad-hoc pool). Entries with no produced
 * portions and no reservations are omitted.
 */
export function buildFoodBankSummary(
  produced: ProducedPortion[],
  reservations: Reservation[],
  recipeNameFor: (id: string | null) => string,
): FoodBankEntry[] {
  const producedById = new Map<string | null, number>()
  for (const p of produced) {
    producedById.set(p.recipeId, (producedById.get(p.recipeId) ?? 0) + p.portions)
  }
  const reservedCountById = new Map<string | null, number>()
  for (const r of reservations) {
    reservedCountById.set(r.recipeId, (reservedCountById.get(r.recipeId) ?? 0) + 1)
  }

  const recipeIds = new Set<string | null>([
    ...producedById.keys(),
    ...reservedCountById.keys(),
  ])

  return [...recipeIds].map((recipeId) => {
    const producedFor = producedById.get(recipeId) ?? 0
    const reservedFor = reservedCountById.get(recipeId) ?? 0
    return {
      recipeId,
      recipeName: recipeNameFor(recipeId),
      produced: producedFor,
      available: availableFor(producedFor, reservedFor),
    }
  })
}
