import { beforeEach, describe, expect, it } from 'vitest'
import { InMemoryInventoryRepo } from './repo'
import type { InventoryRepo } from './repo'
import {
  addIngredient,
  listInventory,
  restockIngredient,
  searchIngredients,
  setIngredientState,
} from './service'

describe('inventory service', () => {
  let repo: InventoryRepo

  beforeEach(() => {
    repo = new InMemoryInventoryRepo()
  })

  describe('addIngredient', () => {
    it('creates an ingredient with its initial inventory state', async () => {
      const item = await addIngredient(repo, {
        name: 'Egg',
        unit: 'piece',
        state: 'tracked',
        quantity: 6,
      })

      expect(item.ingredient.name).toBe('Egg')
      expect(item.ingredient.unit).toBe('piece')
      expect(item.state).toBe('tracked')
      expect(item.quantity).toBe(6)
    })

    it('rejects an empty name', async () => {
      await expect(
        addIngredient(repo, { name: '  ', unit: 'piece', state: 'tracked', quantity: 1 }),
      ).rejects.toThrow(/name/i)
    })

    it('rejects a duplicate name, case-insensitively', async () => {
      await addIngredient(repo, { name: 'Egg', unit: 'piece', state: 'tracked', quantity: 6 })
      await expect(
        addIngredient(repo, { name: 'egg', unit: 'piece', state: 'tracked', quantity: 2 }),
      ).rejects.toThrow(/already exists/i)
    })

    it('tracked state requires a positive quantity', async () => {
      await expect(
        addIngredient(repo, { name: 'Egg', unit: 'piece', state: 'tracked' }),
      ).rejects.toThrow(/quantity/i)
    })
  })

  describe('restockIngredient', () => {
    it('adds to the existing tracked quantity', async () => {
      const { ingredient } = await addIngredient(repo, {
        name: 'Egg',
        unit: 'piece',
        state: 'tracked',
        quantity: 6,
      })
      const updated = await restockIngredient(repo, ingredient.id, 4)
      expect(updated.state).toBe('tracked')
      expect(updated.quantity).toBe(10)
    })

    it('transitions Unavailable -> Tracked with the restocked quantity', async () => {
      const { ingredient } = await addIngredient(repo, {
        name: 'Milk',
        unit: 'ml',
        state: 'unavailable',
      })
      const updated = await restockIngredient(repo, ingredient.id, 500)
      expect(updated.state).toBe('tracked')
      expect(updated.quantity).toBe(500)
    })

    it('transitions Endless -> Tracked when you start quantifying a staple', async () => {
      const { ingredient } = await addIngredient(repo, {
        name: 'Salt',
        unit: 'g',
        state: 'endless',
      })
      const updated = await restockIngredient(repo, ingredient.id, 200)
      expect(updated.state).toBe('tracked')
      expect(updated.quantity).toBe(200)
    })

    it('rejects a non-positive restock amount', async () => {
      const { ingredient } = await addIngredient(repo, {
        name: 'Egg',
        unit: 'piece',
        state: 'tracked',
        quantity: 6,
      })
      await expect(restockIngredient(repo, ingredient.id, 0)).rejects.toThrow()
      await expect(restockIngredient(repo, ingredient.id, -3)).rejects.toThrow()
    })
  })

  describe('setIngredientState', () => {
    it('mark Unavailable sets quantity to zero', async () => {
      const { ingredient } = await addIngredient(repo, {
        name: 'Milk',
        unit: 'ml',
        state: 'tracked',
        quantity: 250,
      })
      const updated = await setIngredientState(repo, ingredient.id, 'unavailable')
      expect(updated.state).toBe('unavailable')
      expect(updated.quantity).toBe(0)
    })

    it('mark Endless clears the quantity', async () => {
      const { ingredient } = await addIngredient(repo, {
        name: 'Salt',
        unit: 'g',
        state: 'tracked',
        quantity: 100,
      })
      const updated = await setIngredientState(repo, ingredient.id, 'endless')
      expect(updated.state).toBe('endless')
      expect(updated.quantity).toBeNull()
    })

    it('set Tracked with a positive quantity replaces the quantity', async () => {
      const { ingredient } = await addIngredient(repo, {
        name: 'Egg',
        unit: 'piece',
        state: 'tracked',
        quantity: 6,
      })
      const updated = await setIngredientState(repo, ingredient.id, 'tracked', {
        quantity: 12,
      })
      expect(updated.state).toBe('tracked')
      expect(updated.quantity).toBe(12)
    })

    it('Tracked rejects a missing or non-positive quantity', async () => {
      const { ingredient } = await addIngredient(repo, {
        name: 'Egg',
        unit: 'piece',
        state: 'unavailable',
      })
      await expect(
        setIngredientState(repo, ingredient.id, 'tracked'),
      ).rejects.toThrow(/quantity/i)
      await expect(
        setIngredientState(repo, ingredient.id, 'tracked', { quantity: 0 }),
      ).rejects.toThrow(/quantity/i)
    })
  })

  describe('list & search', () => {
    it('lists all inventory items', async () => {
      await addIngredient(repo, { name: 'Egg', unit: 'piece', state: 'tracked', quantity: 6 })
      await addIngredient(repo, { name: 'Salt', unit: 'g', state: 'endless' })
      await addIngredient(repo, { name: 'Milk', unit: 'ml', state: 'unavailable' })

      const all = await listInventory(repo)
      expect(all).toHaveLength(3)
      expect(all.map((i) => i.state).sort()).toEqual([
        'endless',
        'tracked',
        'unavailable',
      ])
    })

    it('search filters by name, case-insensitive substring', async () => {
      await addIngredient(repo, { name: 'Egg', unit: 'piece', state: 'tracked', quantity: 6 })
      await addIngredient(repo, { name: 'Eggplant', unit: 'g', state: 'tracked', quantity: 500 })
      await addIngredient(repo, { name: 'Milk', unit: 'ml', state: 'endless' })

      const results = await searchIngredients(repo, 'egg')
      expect(results.map((r) => r.ingredient.name).sort()).toEqual([
        'Egg',
        'Eggplant',
      ])
    })
  })

  describe('canonical unit', () => {
    it('is set at creation and preserved by every operation', async () => {
      const { ingredient } = await addIngredient(repo, {
        name: 'Chicken',
        unit: 'g',
        state: 'tracked',
        quantity: 500,
      })
      expect(ingredient.unit).toBe('g')

      const after = await restockIngredient(repo, ingredient.id, 100)
      expect(after.ingredient.unit).toBe('g')

      const marked = await setIngredientState(repo, ingredient.id, 'unavailable')
      expect(marked.ingredient.unit).toBe('g')
    })
  })

  describe('cross-state transitions', () => {
    it('transitions Endless <-> Unavailable', async () => {
      const { ingredient } = await addIngredient(repo, {
        name: 'Salt',
        unit: 'g',
        state: 'endless',
      })
      const unavailable = await setIngredientState(repo, ingredient.id, 'unavailable')
      expect(unavailable.state).toBe('unavailable')
      expect(unavailable.quantity).toBe(0)

      const endlessAgain = await setIngredientState(repo, ingredient.id, 'endless')
      expect(endlessAgain.state).toBe('endless')
      expect(endlessAgain.quantity).toBeNull()
    })
  })
})
