import type { Ingredient } from '../inventory/types'
import type { RecipeDetail, RecipeIngredient } from './types'

/** A recipe line as received at the persistence boundary (ingredient id + quantity). */
export interface RecipeIngredientInput {
  ingredientId: string
  quantity: number
}

export interface CreateRecipeInput {
  name: string
  servings: number
  notes: string | null
  ingredients: RecipeIngredientInput[]
}

export type UpdateRecipeInput = CreateRecipeInput

/**
 * The persistence seam for the Recipe service. `list` excludes soft-deleted
 * recipes; `get` returns a recipe regardless of its hidden flag so archived
 * Weeks stay legible after a recipe is removed from the catalog.
 */
export interface RecipeRepo {
  list: () => Promise<RecipeDetail[]>
  get: (id: string) => Promise<RecipeDetail | null>
  create: (input: CreateRecipeInput) => Promise<RecipeDetail>
  update: (id: string, input: UpdateRecipeInput) => Promise<RecipeDetail>
  softDelete: (id: string) => Promise<void>
}

/** In-memory implementation used by the service-layer tests. */
export class InMemoryRecipeRepo implements RecipeRepo {
  private readonly recipes = new Map<string, RecipeDetail & { hidden: boolean }>()
  private readonly ingredients = new Map<string, Ingredient>()
  private nextId = 1

  /** Seed the catalog of pickable ingredients (mirrors cooking_ingredients). */
  seed(ingredients: Ingredient[]): this {
    for (const i of ingredients) this.ingredients.set(i.id, i)
    return this
  }

  async list(): Promise<RecipeDetail[]> {
    return [...this.recipes.values()]
      .filter((r) => !r.hidden)
      .map(({ hidden: _hidden, ...r }) => clone(r))
      .sort((a, b) => a.name.localeCompare(b.name))
  }

  async get(id: string): Promise<RecipeDetail | null> {
    const r = this.recipes.get(id)
    if (!r) return null
    const { hidden: _hidden, ...rest } = r
    return clone(rest)
  }

  async create(input: CreateRecipeInput): Promise<RecipeDetail> {
    const id = `rcp_${this.nextId++}`
    const now = new Date()
    const detail: RecipeDetail & { hidden: boolean } = {
      id,
      name: input.name,
      servings: input.servings,
      notes: input.notes,
      createdAt: now,
      ingredients: this.resolve(input.ingredients),
      hidden: false,
    }
    this.recipes.set(id, clone(detail))
    const { hidden: _hidden, ...rest } = detail
    return clone(rest)
  }

  async update(id: string, input: UpdateRecipeInput): Promise<RecipeDetail> {
    const existing = this.recipes.get(id)
    if (!existing) throw new Error('Recipe not found.')
    const updated: RecipeDetail & { hidden: boolean } = {
      ...existing,
      name: input.name,
      servings: input.servings,
      notes: input.notes,
      ingredients: this.resolve(input.ingredients),
    }
    this.recipes.set(id, clone(updated))
    const { hidden: _hidden, ...rest } = updated
    return clone(rest)
  }

  async softDelete(id: string): Promise<void> {
    const existing = this.recipes.get(id)
    if (!existing) throw new Error('Recipe not found.')
    existing.hidden = true
  }

  private resolve(lines: RecipeIngredientInput[]): RecipeIngredient[] {
    return lines.map((l) => {
      const ingredient = this.ingredients.get(l.ingredientId)
      if (!ingredient) {
        throw new Error(`Unknown ingredient: ${l.ingredientId}`)
      }
      return { ingredient: clone(ingredient), quantity: l.quantity }
    })
  }
}

function clone<T>(value: T): T {
  return structuredClone(value)
}
