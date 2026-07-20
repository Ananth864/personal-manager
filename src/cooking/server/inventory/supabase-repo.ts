import { createCookingClient } from '#/cooking/lib/supabase'
import type { InventoryRepo } from './repo'
import type { Ingredient, InventoryItem, InventoryState } from './types'

/** Columns for the ingredient catalog row, without the inventory join. */
const INGREDIENT_COLUMNS = 'id, name, unit, created_at'

/** Ingredient row + its 1:1 inventory join. */
interface IngredientRow {
  id: string
  name: string
  unit: string
  created_at: string
  cooking_inventory: InventoryJoinRow[]
}

interface InventoryJoinRow {
  state: InventoryState
  quantity: number | null
  updated_at: string
}

interface IngredientColumns {
  id: string
  name: string
  unit: string
  created_at: string
}

function toIngredient(row: IngredientColumns): Ingredient {
  return {
    id: row.id,
    name: row.name,
    unit: row.unit,
    createdAt: new Date(row.created_at),
  }
}

function toItem(row: IngredientRow): InventoryItem {
  // The 1:1 join comes back as a has-many array; take the first (and only) row.
  const inv = row.cooking_inventory.at(0) ?? null
  return {
    ingredient: toIngredient(row),
    state: inv?.state ?? 'unavailable',
    quantity: inv?.quantity ?? null,
    updatedAt: inv ? new Date(inv.updated_at) : new Date(),
  }
}

/**
 * Production InventoryRepo backed by Supabase. RLS (user_id = auth.uid())
 * guarantees every row belongs to the authenticated user, so this code never
 * filters by user itself. Inserts omit user_id — the cooking_set_user_id
 * trigger derives it from the Clerk session (see 0002_inventory.sql).
 */
export class SupabaseInventoryRepo implements InventoryRepo {
  private readonly client

  constructor(token: string) {
    this.client = createCookingClient(token)
  }

  async list(): Promise<InventoryItem[]> {
    const { data, error } = await this.client
      .from('cooking_ingredients')
      .select(`${INGREDIENT_COLUMNS}, cooking_inventory(state, quantity, updated_at)`)
      .order('name')
    if (error) {
      throw new Error(`Failed to list inventory: ${error.message}`)
    }
    return data.map(toItem)
  }

  async get(ingredientId: string): Promise<InventoryItem | null> {
    const { data, error } = await this.client
      .from('cooking_ingredients')
      .select(`${INGREDIENT_COLUMNS}, cooking_inventory(state, quantity, updated_at)`)
      .eq('id', ingredientId)
      .maybeSingle()
    if (error) {
      throw new Error(`Failed to get ingredient: ${error.message}`)
    }
    return data ? toItem(data) : null
  }

  async findIngredientByName(name: string): Promise<Ingredient | null> {
    const { data, error } = await this.client
      .from('cooking_ingredients')
      .select(INGREDIENT_COLUMNS)
      .ilike('name', name)
      .maybeSingle()
    if (error) {
      throw new Error(`Failed to look up ingredient: ${error.message}`)
    }
    return data ? toIngredient(data) : null
  }

  async createIngredient(input: {
    name: string
    unit: string
    state: InventoryState
    quantity: number | null
  }): Promise<InventoryItem> {
    const { data: ing, error: ingErr } = await this.client
      .from('cooking_ingredients')
      .insert({ name: input.name, unit: input.unit, created_by: 'user' })
      .select(INGREDIENT_COLUMNS)
      .single()
    if (ingErr) {
      throw new Error(`Failed to create ingredient: ${ingErr.message}`)
    }

    const { error: invErr } = await this.client.from('cooking_inventory').insert({
      ingredient_id: ing.id,
      state: input.state,
      quantity: input.quantity,
    })
    if (invErr) {
      // Roll back the orphan ingredient so a failed insert doesn't leave a
      // dangling catalog row that would show as Unavailable.
      await this.client.from('cooking_ingredients').delete().eq('id', ing.id)
      throw new Error(`Failed to create inventory entry: ${invErr.message}`)
    }

    return {
      ingredient: toIngredient(ing),
      state: input.state,
      quantity: input.quantity,
      updatedAt: new Date(),
    }
  }

  async save(item: InventoryItem): Promise<InventoryItem> {
    const { error } = await this.client
      .from('cooking_inventory')
      .upsert(
        {
          ingredient_id: item.ingredient.id,
          state: item.state,
          quantity: item.quantity,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'ingredient_id' },
      )
    if (error) {
      throw new Error(`Failed to save inventory entry: ${error.message}`)
    }
    return item
  }
}
