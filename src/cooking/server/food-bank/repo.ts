/**
 * The persistence seam for the Food Bank (CONTEXT.md → Food Bank; ADR-0002).
 * T05 only PRODUCES portions here; reservations/withdrawals land in T06.
 *
 * Portions are tracked per Recipe and commingled across Cooks of the same
 * Recipe. `addPortions` is the single write path — Cook is the only operation
 * that produces portions.
 */
export interface FoodBankRepo {
  addPortions: (recipeId: string, portions: number) => Promise<void>
}

/** In-memory implementation used by the Cook service-layer tests. */
export class InMemoryFoodBankRepo implements FoodBankRepo {
  private readonly portions = new Map<string, number>()

  async addPortions(recipeId: string, portions: number): Promise<void> {
    if (portions <= 0) return
    this.portions.set(recipeId, (this.portions.get(recipeId) ?? 0) + portions)
  }

  /** Test-only accessor. */
  portionsFor(recipeId: string): number {
    return this.portions.get(recipeId) ?? 0
  }
}
