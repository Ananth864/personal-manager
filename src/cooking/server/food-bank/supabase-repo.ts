import { createCookingClient } from '#/cooking/lib/supabase'
import type { FoodBankRepo } from './repo'

/**
 * Production FoodBankRepo backed by Supabase. `addPortions` calls the
 * `cooking_add_portions` Postgres function (see 0005_cook.sql) so the increment
 * is atomic and commingles portions across Cooks of the same Recipe. Runs as
 * the authenticated caller with RLS, so a user only ever writes their own row.
 */
export class SupabaseFoodBankRepo implements FoodBankRepo {
  private readonly client

  constructor(token: string) {
    this.client = createCookingClient(token)
  }

  async addPortions(recipeId: string | null, portions: number): Promise<void> {
    if (portions <= 0) return
    const { error } = await this.client.rpc('cooking_add_portions', {
      p_recipe: recipeId,
      p_portions: portions,
    })
    if (error) {
      throw new Error(`Failed to add Food Bank portions: ${error.message}`)
    }
  }
}
