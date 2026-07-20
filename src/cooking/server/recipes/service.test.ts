import { beforeEach, describe, expect, it } from 'vitest'
import { InMemoryRecipeRepo } from './repo'
import type { RecipeRepo } from './repo'
import { createRecipe, updateRecipe } from './service'
import type { Ingredient } from '../inventory/types'

describe('recipe service', () => {
  let repo: RecipeRepo
  let egg: Ingredient
  let salt: Ingredient

  beforeEach(() => {
    repo = new InMemoryRecipeRepo().seed([
      (egg = { id: 'ing_egg', name: 'Egg', unit: 'piece', createdAt: new Date() }),
      (salt = { id: 'ing_salt', name: 'Salt', unit: 'g', createdAt: new Date() }),
    ])
  })

  describe('createRecipe', () => {
    it('creates a recipe with its ingredient lines', async () => {
      const r = await createRecipe(repo, {
        name: 'Omelette',
        servings: 2,
        notes: 'Fluffy.',
        ingredients: [
          { ingredientId: egg.id, quantity: 3 },
          { ingredientId: salt.id, quantity: 2 },
        ],
      })
      expect(r.name).toBe('Omelette')
      expect(r.servings).toBe(2)
      expect(r.notes).toBe('Fluffy.')
      expect(r.ingredients).toHaveLength(2)
      expect(r.ingredients.map((i) => i.quantity).sort()).toEqual([2, 3])
    })

    it('trims the name and blank notes', async () => {
      const r = await createRecipe(repo, {
        name: '  Toast  ',
        servings: 1,
        notes: '   ',
        ingredients: [{ ingredientId: egg.id, quantity: 1 }],
      })
      expect(r.name).toBe('Toast')
      expect(r.notes).toBeNull()
    })

    it('rejects an empty name', async () => {
      await expect(
        createRecipe(repo, {
          name: '',
          servings: 1,
          notes: null,
          ingredients: [{ ingredientId: egg.id, quantity: 1 }],
        }),
      ).rejects.toThrow(/name/i)
    })

    it('rejects servings below 1', async () => {
      await expect(
        createRecipe(repo, {
          name: 'X',
          servings: 0,
          notes: null,
          ingredients: [{ ingredientId: egg.id, quantity: 1 }],
        }),
      ).rejects.toThrow(/servings/i)
    })

    it('rejects a non-positive ingredient quantity', async () => {
      await expect(
        createRecipe(repo, {
          name: 'X',
          servings: 1,
          notes: null,
          ingredients: [{ ingredientId: egg.id, quantity: 0 }],
        }),
      ).rejects.toThrow(/quantity/i)
    })

    it('rejects the same ingredient listed twice', async () => {
      await expect(
        createRecipe(repo, {
          name: 'X',
          servings: 1,
          notes: null,
          ingredients: [
            { ingredientId: egg.id, quantity: 1 },
            { ingredientId: egg.id, quantity: 2 },
          ],
        }),
      ).rejects.toThrow(/twice/i)
    })

    it('update replaces the ingredient set', async () => {
      const r = await createRecipe(repo, {
        name: 'X',
        servings: 1,
        notes: null,
        ingredients: [{ ingredientId: egg.id, quantity: 1 }],
      })
      const updated = await updateRecipe(repo, r.id, {
        name: 'X',
        servings: 4,
        notes: 'more',
        ingredients: [{ ingredientId: salt.id, quantity: 5 }],
      })
      expect(updated.servings).toBe(4)
      expect(updated.ingredients).toHaveLength(1)
      expect(updated.ingredients[0].ingredient.id).toBe(salt.id)
    })
  })

  describe('soft-delete', () => {
    it('hides a recipe from the catalog list but keeps it gettable', async () => {
      const r = await createRecipe(repo, {
        name: 'X',
        servings: 1,
        notes: null,
        ingredients: [{ ingredientId: egg.id, quantity: 1 }],
      })
      await repo.softDelete(r.id)
      const listed = await repo.list()
      expect(listed).toHaveLength(0)
      // get still resolves it (archived Weeks stay legible).
      expect(await repo.get(r.id)).not.toBeNull()
    })
  })
})
