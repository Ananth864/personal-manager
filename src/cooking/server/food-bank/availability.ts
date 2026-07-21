/**
 * Food Bank availability (CONTEXT.md → Food Bank; ADR-0002 / ADR-0006).
 *
 * Availability is derived, not stored. It has three terms:
 *   produced  — real portions from past Cooks (the cooking_food_bank ledger)
 *   planned   — portions that planned-but-uncooked meals *will* produce
 *               (Σ servings − 1 over uncooked recipe/ad-hoc slots this/next
 *               week). Lets a plan reserve future leftovers: "cook Chili Mon,
 *               eat the leftovers Tue–Thu". When a planned cook fires, its
 *               portions move from `planned` to `produced` — no double-count.
 *   reserved  — Food Bank withdrawal slots (every week, active + archived)
 *
 * available = produced + planned − reserved. A reservation in a current/future
 * week is *active* (clearable); in an archived past week it's *permanent
 * consumption* (past weeks are read-only, so it can't be released). Both
 * subtract equally — the split is about clearability, not the count.
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

/** A planned (uncooked) cook that will produce portions. */
export interface PlannedCook {
  recipeId: string | null
  slotDate: string
  assignmentType: 'recipe' | 'adhoc'
  adhocServings: number | null
}

export interface FoodBankEntry {
  recipeId: string | null
  recipeName: string
  produced: number
  planned: number
  available: number
}

/** Available portions for one recipe: produced + planned − reservations. */
export function availableFor(
  produced: number,
  planned: number,
  reservationCount: number,
): number {
  return produced + planned - reservationCount
}

/**
 * Project the portions that planned (uncooked) meals will produce, grouped by
 * recipe. Only counts meals in the current week or later (past uncooked slots
 * are water under the bridge). The cooking slot eats one portion, so each meal
 * contributes `servings − 1` (clamped at 0).
 */
export function computePlannedProductions(
  plannedCooks: PlannedCook[],
  servingsFor: (recipeId: string) => number | undefined,
  currentWeekStart: string,
): ProducedPortion[] {
  const byId = new Map<string | null, number>()
  for (const cook of plannedCooks) {
    if (cook.slotDate < currentWeekStart) continue
    const servings =
      cook.assignmentType === 'adhoc'
        ? cook.adhocServings
        : cook.recipeId
          ? servingsFor(cook.recipeId)
          : undefined
    if (servings == null) continue
    const portions = Math.max(0, servings - 1)
    if (portions <= 0) continue
    byId.set(cook.recipeId, (byId.get(cook.recipeId) ?? 0) + portions)
  }
  return [...byId.entries()].map(([recipeId, portions]) => ({ recipeId, portions }))
}

/**
 * Build the per-recipe Food Bank summary. `recipeNameFor` resolves a recipe id
 * to its display name (null → the ad-hoc pool). Entries with no produced, no
 * planned, and no reservations are omitted.
 */
export function buildFoodBankSummary(
  produced: ProducedPortion[],
  planned: ProducedPortion[],
  reservations: Reservation[],
  recipeNameFor: (id: string | null) => string,
): FoodBankEntry[] {
  const sumById = (entries: ProducedPortion[]) => {
    const m = new Map<string | null, number>()
    for (const e of entries) m.set(e.recipeId, (m.get(e.recipeId) ?? 0) + e.portions)
    return m
  }
  const producedById = sumById(produced)
  const plannedById = sumById(planned)
  const reservedCountById = new Map<string | null, number>()
  for (const r of reservations) {
    reservedCountById.set(r.recipeId, (reservedCountById.get(r.recipeId) ?? 0) + 1)
  }

  const recipeIds = new Set<string | null>([
    ...producedById.keys(),
    ...plannedById.keys(),
    ...reservedCountById.keys(),
  ])

  return [...recipeIds].map((recipeId) => {
    const producedFor = producedById.get(recipeId) ?? 0
    const plannedFor = plannedById.get(recipeId) ?? 0
    const reservedFor = reservedCountById.get(recipeId) ?? 0
    return {
      recipeId,
      recipeName: recipeNameFor(recipeId),
      produced: producedFor,
      planned: plannedFor,
      available: availableFor(producedFor, plannedFor, reservedFor),
    }
  })
}
