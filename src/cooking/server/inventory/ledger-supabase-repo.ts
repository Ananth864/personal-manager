import { createCookingClient } from '#/cooking/lib/supabase'
import type { IngredientLedgerRepo, LedgerEntry } from './ledger-repo'
import type { MealPosition } from '../schedule/types'

interface RawRow {
  ingredient_id: string
  delta: number
  reversed: boolean
}

/**
 * Production IngredientLedgerRepo backed by Supabase. RLS scopes every query
 * to the caller; user_id is set by column default (never sent). The ledger is
 * append-only — `record` inserts, `reverseForSlot` flips `reversed` on the
 * slot's active rows.
 */
export class SupabaseIngredientLedgerRepo implements IngredientLedgerRepo {
  private readonly client

  constructor(token: string) {
    this.client = createCookingClient(token)
  }

  async record(entry: {
    ingredientId: string
    delta: number
    sourceDate: string
    sourceMeal: MealPosition
  }): Promise<void> {
    const { error } = await this.client.from('cooking_ingredient_ledger').insert({
      ingredient_id: entry.ingredientId,
      delta: entry.delta,
      source_date: entry.sourceDate,
      source_meal: entry.sourceMeal,
    })
    if (error) {
      throw new Error(`Failed to write ingredient ledger: ${error.message}`)
    }
  }

  async listActiveForSlot(sourceDate: string, sourceMeal: MealPosition): Promise<LedgerEntry[]> {
    const { data, error } = await this.client
      .from('cooking_ingredient_ledger')
      .select('ingredient_id, delta, reversed')
      .eq('source_date', sourceDate)
      .eq('source_meal', sourceMeal)
      .eq('reversed', false)
    if (error) {
      throw new Error(`Failed to read ingredient ledger: ${error.message}`)
    }
    return (data as RawRow[]).map((r) => ({
      ingredientId: r.ingredient_id,
      delta: r.delta,
      reversed: r.reversed,
    }))
  }

  async reverseForSlot(sourceDate: string, sourceMeal: MealPosition): Promise<void> {
    const { error } = await this.client
      .from('cooking_ingredient_ledger')
      .update({ reversed: true })
      .eq('source_date', sourceDate)
      .eq('source_meal', sourceMeal)
      .eq('reversed', false)
    if (error) {
      throw new Error(`Failed to reverse ingredient ledger: ${error.message}`)
    }
  }
}
