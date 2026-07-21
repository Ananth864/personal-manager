import type { MealPosition } from '../schedule/types'

/**
 * The persistence seam for the Ingredient Ledger (CONTEXT.md → Ingredient
 * Ledger; ADR-0008). Append-only; each entry records the ACTUAL delta a Cook
 * applied to a Tracked ingredient (post-clamp, negative for consumption).
 *
 * Uncook reads a slot's active entries, replays them in reverse, then marks
 * them reversed. Endless/Unavailable ingredients are never recorded.
 */
export interface LedgerEntry {
  ingredientId: string
  delta: number
  reversed: boolean
}

export interface IngredientLedgerRepo {
  /** Append a Cook's actual consumption of one ingredient. */
  record: (entry: {
    ingredientId: string
    delta: number
    sourceDate: string
    sourceMeal: MealPosition
  }) => Promise<void>
  /** Active (non-reversed) entries for a slot — what Uncook reverses. */
  listActiveForSlot: (sourceDate: string, sourceMeal: MealPosition) => Promise<LedgerEntry[]>
  /** Mark every active entry for a slot as reversed. */
  reverseForSlot: (sourceDate: string, sourceMeal: MealPosition) => Promise<void>
}

/** In-memory implementation used by the Cook/Uncook service-layer tests. */
export class InMemoryIngredientLedgerRepo implements IngredientLedgerRepo {
  private readonly rows: (LedgerEntry & { id: string; sourceDate: string; sourceMeal: MealPosition })[] = []
  private nextId = 1

  async record(entry: {
    ingredientId: string
    delta: number
    sourceDate: string
    sourceMeal: MealPosition
  }): Promise<void> {
    this.rows.push({ id: `led_${this.nextId++}`, ...entry, reversed: false })
  }

  async listActiveForSlot(sourceDate: string, sourceMeal: MealPosition): Promise<LedgerEntry[]> {
    return this.rows
      .filter(
        (r) => r.sourceDate === sourceDate && r.sourceMeal === sourceMeal && !r.reversed,
      )
      .map(({ ingredientId, delta, reversed }) => ({ ingredientId, delta, reversed }))
  }

  async reverseForSlot(sourceDate: string, sourceMeal: MealPosition): Promise<void> {
    for (const r of this.rows) {
      if (r.sourceDate === sourceDate && r.sourceMeal === sourceMeal && !r.reversed) {
        r.reversed = true
      }
    }
  }
}
