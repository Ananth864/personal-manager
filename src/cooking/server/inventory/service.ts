import { applyRestock, applySetState } from './rules'
import type { InventoryRepo } from './repo'
import type { InventoryItem, InventoryState, Unit } from './types'

export interface AddIngredientInput {
  name: string
  unit: Unit
  state: InventoryState
  /** Required when state is 'tracked'; ignored otherwise. */
  quantity?: number | null
}

function resolveInitialQuantity(
  state: InventoryState,
  quantity: number | null | undefined,
): number | null {
  if (state === 'endless') return null
  if (state === 'unavailable') return 0
  if (quantity == null) {
    throw new Error('Tracked state requires a quantity.')
  }
  if (quantity <= 0) {
    throw new Error('Tracked quantity must be positive.')
  }
  return quantity
}

export async function addIngredient(
  repo: InventoryRepo,
  input: AddIngredientInput,
): Promise<InventoryItem> {
  const name = input.name.trim()
  if (!name) {
    throw new Error('Ingredient name is required.')
  }
  // Unit is already one of the allowed enum values — no trimming needed.
  const unit = input.unit

  const existing = await repo.findIngredientByName(name)
  if (existing) {
    throw new Error(`An ingredient named "${name}" already exists.`)
  }

  const quantity = resolveInitialQuantity(input.state, input.quantity)
  return repo.createIngredient({ name, unit, state: input.state, quantity })
}

export async function listInventory(repo: InventoryRepo): Promise<InventoryItem[]> {
  return repo.list()
}

export async function restockIngredient(
  repo: InventoryRepo,
  ingredientId: string,
  qtyAdded: number,
): Promise<InventoryItem> {
  const item = await repo.get(ingredientId)
  if (!item) {
    throw new Error('Ingredient not found.')
  }
  return repo.save(applyRestock(item, qtyAdded))
}

export async function setIngredientState(
  repo: InventoryRepo,
  ingredientId: string,
  state: InventoryState,
  opts?: { quantity?: number },
): Promise<InventoryItem> {
  const item = await repo.get(ingredientId)
  if (!item) {
    throw new Error('Ingredient not found.')
  }
  return repo.save(applySetState(item, state, opts?.quantity))
}

export async function searchIngredients(
  repo: InventoryRepo,
  query: string,
): Promise<InventoryItem[]> {
  const q = query.trim().toLowerCase()
  const all = await repo.list()
  if (!q) return all
  return all.filter((i) => i.ingredient.name.toLowerCase().includes(q))
}
