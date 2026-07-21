/**
 * The persistence seam for the Food Bank (CONTEXT.md → Food Bank; ADR-0002).
 * T05 only PRODUCES portions here; reservations/withdrawals land in T06.
 *
 * Portions are tracked per Recipe and commingled across Cooks of the same
 * Recipe. Ad-hoc Cooks (no catalog identity) commingle into a single NULL
 * recipe-id pool per user. `addPortions` is the single production path — Cook
 * is the only operation that produces portions. `removePortions` is the discard
 * path (a portion thrown away or eaten without a slot); it only reduces what's
 * there and never goes negative.
 */
export interface FoodBankRepo {
  addPortions: (recipeId: string | null, portions: number) => Promise<void>
  /** Discard produced portions (floor at 0). Service guards the reservation floor. */
  removePortions: (recipeId: string | null, portions: number) => Promise<void>
  /** The produced-portions ledger (one row per recipe, including the ad-hoc pool). */
  listProduced: () => Promise<{ recipeId: string | null; portions: number }[]>
}

/** In-memory implementation used by the Cook service-layer tests. */
export class InMemoryFoodBankRepo implements FoodBankRepo {
  private readonly portions = new Map<string, number>()
  private static readonly ADHOC_KEY = '__adhoc__'

  async addPortions(recipeId: string | null, portions: number): Promise<void> {
    if (portions <= 0) return
    const key = recipeId ?? InMemoryFoodBankRepo.ADHOC_KEY
    this.portions.set(key, (this.portions.get(key) ?? 0) + portions)
  }

  async removePortions(recipeId: string | null, portions: number): Promise<void> {
    if (portions <= 0) return
    const key = recipeId ?? InMemoryFoodBankRepo.ADHOC_KEY
    const current = this.portions.get(key) ?? 0
    this.portions.set(key, Math.max(0, current - portions))
  }

  async listProduced(): Promise<{ recipeId: string | null; portions: number }[]> {
    return [...this.portions.entries()].map(([key, portions]) => ({
      recipeId: key === InMemoryFoodBankRepo.ADHOC_KEY ? null : key,
      portions,
    }))
  }

  /** Test-only accessor (null recipeId reads the ad-hoc pool). */
  portionsFor(recipeId: string | null): number {
    return this.portions.get(recipeId ?? InMemoryFoodBankRepo.ADHOC_KEY) ?? 0
  }
}

