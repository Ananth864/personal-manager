import { createCookingClient } from '#/cooking/lib/supabase'
import type { Unit } from '../inventory/types'
import type { RecipeRepo, RecipeIngredientInput } from './repo'
import type { Recipe, RecipeDetail, RecipeIngredient } from './types'

/** To-one nested ingredient columns from the join. */
interface IngredientJoinRow {
  id: string
  name: string
  unit: string
  created_at: string
}

/** Recipe header columns, without the ingredient join. */
const RECIPE_COLUMNS = 'id, name, servings, notes, created_at'

/** Full recipe + its ingredient lines + each line's catalog ingredient. */
interface RecipeRow {
  id: string
  name: string
  servings: number
  notes: string | null
  created_at: string
  // Has-many from the recipe; each line nests its to-one ingredient.
  cooking_recipe_ingredients: RecipeIngredientRow[] | null | undefined
}

interface RecipeIngredientRow {
  quantity: string | number
  // To-one (ingredient_id references cooking_ingredients.id). PostgREST returns
  // an object; supabase-js infers an array, so accept either.
  cooking_ingredients: IngredientJoinRow | IngredientJoinRow[] | null | undefined
}

function toRecipe(row: Pick<RecipeRow, 'id' | 'name' | 'servings' | 'notes' | 'created_at'>): Recipe {
  return {
    id: row.id,
    name: row.name,
    servings: row.servings,
    notes: row.notes,
    createdAt: new Date(row.created_at),
  }
}

function toDetail(row: RecipeRow): RecipeDetail {
  const lines = row.cooking_recipe_ingredients ?? []
  const ingredients: RecipeIngredient[] = lines
    .map((l): RecipeIngredient | null => {
      const ing = unwrap(l.cooking_ingredients)
      if (!ing) return null
      return {
        ingredient: {
          id: ing.id,
          name: ing.name,
          unit: ing.unit as Unit,
          createdAt: new Date(ing.created_at),
        },
        quantity: Number(l.quantity),
      }
    })
    .filter((x): x is RecipeIngredient => x !== null)
  return { ...toRecipe(row), ingredients }
}

/** Normalize the to-one nested ingredient into a single object or null. */
function unwrap<T>(shape: T | T[] | null | undefined): T | null {
  if (shape == null) return null
  return Array.isArray(shape) ? (shape[0] ?? null) : shape
}

/**
 * Production RecipeRepo backed by Supabase. RLS (user_id = auth.jwt()->>'sub'
 * on cooking_recipes; ownership-derived on cooking_recipe_ingredients) scopes
 * every query to the authenticated user. Inserts omit user_id — the column
 * default derives it from the Clerk session (see 0003_recipes.sql).
 */
export class SupabaseRecipeRepo implements RecipeRepo {
  private readonly client

  constructor(token: string) {
    this.client = createCookingClient(token)
  }

  async list(): Promise<RecipeDetail[]> {
    const { data, error } = await this.client
      .from('cooking_recipes')
      .select(
        `${RECIPE_COLUMNS}, cooking_recipe_ingredients(quantity, cooking_ingredients!ingredient_id(id, name, unit, created_at))`,
      )
      .eq('hidden', false)
      .order('name')
    if (error) {
      throw new Error(`Failed to list recipes: ${error.message}`)
    }
    return (data as RecipeRow[]).map(toDetail)
  }

  async get(id: string): Promise<RecipeDetail | null> {
    const { data, error } = await this.client
      .from('cooking_recipes')
      .select(
        `${RECIPE_COLUMNS}, cooking_recipe_ingredients(quantity, cooking_ingredients!ingredient_id(id, name, unit, created_at))`,
      )
      .eq('id', id)
      .maybeSingle()
    if (error) {
      throw new Error(`Failed to get recipe: ${error.message}`)
    }
    return data ? toDetail(data) : null
  }

  async create(input: {
    name: string
    servings: number
    notes: string | null
    ingredients: RecipeIngredientInput[]
  }): Promise<RecipeDetail> {
    const { data: row, error: recipeErr } = await this.client
      .from('cooking_recipes')
      .insert({ name: input.name, servings: input.servings, notes: input.notes, created_by: 'user' })
      .select(RECIPE_COLUMNS)
      .single()
    if (recipeErr) {
      throw new Error(`Failed to create recipe: ${recipeErr.message}`)
    }

    const { error: linesErr } = await this.insertLines(row.id, input.ingredients)
    if (linesErr) {
      // Cascade deletes any partial ingredient rows along with the recipe.
      await this.client.from('cooking_recipes').delete().eq('id', row.id)
      throw new Error(`Failed to create recipe ingredients: ${linesErr.message}`)
    }

    // Re-fetch so the returned detail carries real ingredient names/units.
    return (await this.get(row.id))!
  }

  async update(
    id: string,
    input: {
      name: string
      servings: number
      notes: string | null
      ingredients: RecipeIngredientInput[]
    },
  ): Promise<RecipeDetail> {
    const { error: recipeErr } = await this.client
      .from('cooking_recipes')
      .update({ name: input.name, servings: input.servings, notes: input.notes })
      .eq('id', id)
    if (recipeErr) {
      throw new Error(`Failed to update recipe: ${recipeErr.message}`)
    }

    // Replace the ingredient set: delete the old lines, insert the new ones.
    await this.client.from('cooking_recipe_ingredients').delete().eq('recipe_id', id)
    const { error: linesErr } = await this.insertLines(id, input.ingredients)
    if (linesErr) {
      throw new Error(`Failed to update recipe ingredients: ${linesErr.message}`)
    }

    // Re-fetch so the returned detail carries real ingredient names/units.
    return (await this.get(id))!
  }

  async softDelete(id: string): Promise<void> {
    const { error } = await this.client
      .from('cooking_recipes')
      .update({ hidden: true })
      .eq('id', id)
    if (error) {
      throw new Error(`Failed to delete recipe: ${error.message}`)
    }
  }

  private insertLines(recipeId: string, lines: RecipeIngredientInput[]) {
    if (lines.length === 0) {
      return Promise.resolve({ error: null as null | { message: string } })
    }
    return this.client
      .from('cooking_recipe_ingredients')
      .insert(lines.map((l) => ({ recipe_id: recipeId, ingredient_id: l.ingredientId, quantity: l.quantity })))
  }
}
