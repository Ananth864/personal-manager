import { computeAvailability } from './availability'
import type { AvailabilityLine } from './availability'
import type { InventoryItem } from '../inventory/types'
import type { CreateRecipeInput, RecipeRepo } from './repo'
import type { RecipeDetail, RecipeWithAvailability } from './types'

export { computeAvailability } from './availability'
export type { Availability } from './types'

function normalize(input: CreateRecipeInput): CreateRecipeInput {
  const name = input.name.trim()
  if (!name) {
    throw new Error('Recipe name is required.')
  }
  if (input.ingredients.length === 0) {
    throw new Error('A recipe needs at least one ingredient.')
  }
  if (!Number.isInteger(input.servings) || input.servings < 1) {
    throw new Error('Servings must be a whole number of 1 or more.')
  }
  const seen = new Set<string>()
  for (const line of input.ingredients) {
    if (!line.ingredientId) {
      throw new Error('Each ingredient line needs an ingredient.')
    }
    if (!Number.isFinite(line.quantity) || line.quantity <= 0) {
      throw new Error('Each ingredient quantity must be positive.')
    }
    if (seen.has(line.ingredientId)) {
      throw new Error('A recipe cannot list the same ingredient twice.')
    }
    seen.add(line.ingredientId)
  }
  return {
    name,
    servings: input.servings,
    notes: input.notes?.trim() ? input.notes.trim() : null,
    ingredients: input.ingredients,
  }
}

export async function createRecipe(
  repo: RecipeRepo,
  input: CreateRecipeInput,
): Promise<RecipeDetail> {
  return repo.create(normalize(input))
}

export async function updateRecipe(
  repo: RecipeRepo,
  id: string,
  input: CreateRecipeInput,
): Promise<RecipeDetail> {
  return repo.update(id, normalize(input))
}

export async function listRecipes(repo: RecipeRepo): Promise<RecipeDetail[]> {
  return repo.list()
}

export async function getRecipe(
  repo: RecipeRepo,
  id: string,
): Promise<RecipeDetail | null> {
  return repo.get(id)
}

export async function deleteRecipe(repo: RecipeRepo, id: string): Promise<void> {
  return repo.softDelete(id)
}

/**
 * Attach a cookability badge to each recipe against the given inventory.
 * Used by the router's list/get procedures.
 */
export function withAvailability(
  recipes: RecipeDetail[],
  inventory: InventoryItem[],
): RecipeWithAvailability[] {
  return recipes.map((r) => {
    const lines: AvailabilityLine[] = r.ingredients.map((i) => ({
      ingredientId: i.ingredient.id,
      quantity: i.quantity,
    }))
    return { ...r, availability: computeAvailability(lines, inventory) }
  })
}
