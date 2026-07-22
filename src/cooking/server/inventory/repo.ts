import type { Ingredient, InventoryItem, InventoryState, Unit } from './types'

/**
 * The persistence seam for the Inventory service. The service layer depends on
 * this interface, not on Supabase directly, so the domain rules can be tested
 * in-memory (fast, deterministic) while production wires up Supabase. ADR-worthy
 * pattern: functional service over a repository interface.
 */
export interface InventoryRepo {
  list: () => Promise<InventoryItem[]>
  get: (ingredientId: string) => Promise<InventoryItem | null>
  findIngredientByName: (name: string) => Promise<Ingredient | null>
  createIngredient: (input: {
    name: string
    unit: Unit
    state: InventoryState
    quantity: number | null
  }) => Promise<InventoryItem>
  save: (item: InventoryItem) => Promise<InventoryItem>
  delete: (ingredientId: string) => Promise<void>
}

/** In-memory implementation used by the service-layer tests. */
export class InMemoryInventoryRepo implements InventoryRepo {
  private readonly items = new Map<string, InventoryItem>()
  private nextId = 1

  async list(): Promise<InventoryItem[]> {
    return [...this.items.values()].map(clone)
  }

  async get(ingredientId: string): Promise<InventoryItem | null> {
    const item = this.items.get(ingredientId)
    return item ? clone(item) : null
  }

  async findIngredientByName(name: string): Promise<Ingredient | null> {
    const lower = name.toLowerCase()
    for (const item of this.items.values()) {
      if (item.ingredient.name.toLowerCase() === lower) {
        return clone(item.ingredient)
      }
    }
    return null
  }

  async createIngredient(input: {
    name: string
    unit: Unit
    state: InventoryState
    quantity: number | null
  }): Promise<InventoryItem> {
    const id = `ing_${this.nextId++}`
    const now = new Date()
    const item: InventoryItem = {
      ingredient: { id, name: input.name, unit: input.unit, createdAt: now },
      state: input.state,
      quantity: input.quantity,
      updatedAt: now,
    }
    this.items.set(id, clone(item))
    return clone(item)
  }

  async save(item: InventoryItem): Promise<InventoryItem> {
    this.items.set(item.ingredient.id, clone(item))
    return clone(item)
  }

  async delete(ingredientId: string): Promise<void> {
    this.items.delete(ingredientId)
  }
}

function clone<T>(value: T): T {
  return structuredClone(value)
}
