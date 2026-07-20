import type { Ingredient } from '../inventory/types'

/** A named, reusable collection of ingredients. Authored by user or agent. */
export interface Recipe {
  id: string
  name: string
  servings: number
  notes: string | null
  createdAt: Date
}

/** A recipe line: the catalog ingredient + the quantity required (in its canonical unit). */
export interface RecipeIngredient {
  ingredient: Ingredient
  quantity: number
}

/** A recipe with its ingredient lines expanded. */
export interface RecipeDetail extends Recipe {
  ingredients: RecipeIngredient[]
}

/**
 * Result of checking a recipe against the current Inventory. Computed by the
 * pure `computeAvailability` rule — reused by the list badge, the detail view,
 * the Schedule (T04), and the Shopping List (T07).
 */
export interface Availability {
  /** true when every required ingredient is available. */
  ok: boolean
  /** number of required ingredients not currently available. */
  missingCount: number
}

export type RecipeWithAvailability = RecipeDetail & { availability: Availability }
