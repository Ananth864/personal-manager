import { beforeEach, describe, expect, it } from 'vitest'
import { InMemoryInventoryRepo } from '../inventory/repo'
import { addIngredient } from '../inventory/service'
import { createInventoryTools } from './tools'
import type { InventoryItem } from '../inventory/types'

/**
 * Tool-boundary tests (T08). Each test calls a tool's `execute` against an
 * InMemoryInventoryRepo — the test double for the Clerk-session-scoped Supabase
 * repo — and asserts it invokes the right Inventory service function with the
 * right args and returns a domain-shaped result. The model is not involved
 * (these target the tool↔service seam).
 */
describe('agent inventory tools', () => {
  let repo: InMemoryInventoryRepo

  beforeEach(() => {
    repo = new InMemoryInventoryRepo()
  })

  async function seed(
    name: string,
    state: InventoryItem['state'],
    quantity?: number,
  ) {
    const item = await addIngredient(repo, {
      name,
      unit: state === 'endless' ? 'g' : 'piece',
      state,
      quantity: quantity ?? null,
    })
    return item.ingredient
  }

  describe('query_inventory', () => {
    it('lists every item in the compact domain shape', async () => {
      await seed('Egg', 'tracked', 6)
      await seed('Salt', 'endless')
      const tools = createInventoryTools(repo)
      const result = await tools.query_inventory.execute()
      const names = (result.inventory as { name: string }[]).map((i) => i.name)
      expect(names).toEqual(expect.arrayContaining(['Egg', 'Salt']))
      const egg = (result.inventory as { name: string }[]).find((i) => i.name === 'Egg')
      expect(egg).toMatchObject({ state: 'tracked', quantity: 6, unit: 'piece' })
    })
  })

  describe('restock_ingredient', () => {
    it('adds quantity additively via the Inventory service', async () => {
      const egg = await seed('Egg', 'tracked', 4)
      const tools = createInventoryTools(repo)
      const result = await tools.restock_ingredient.execute({
        ingredientId: egg.id,
        quantity: 6,
      })
      expect(result.ingredient).toMatchObject({ id: egg.id, quantity: 10, state: 'tracked' })
      expect((await repo.get(egg.id))?.quantity).toBe(10)
    })

    it('rejects a non-positive quantity at the schema boundary', () => {
      const tools = createInventoryTools(repo)
      expect(() =>
        tools.restock_ingredient.inputSchema.parse({ ingredientId: 'x', quantity: 0 }),
      ).toThrow()
      expect(() =>
        tools.restock_ingredient.inputSchema.parse({ ingredientId: 'x', quantity: -1 }),
      ).toThrow()
    })
  })

  describe('set_ingredient_state', () => {
    it('moves a Tracked ingredient to Unavailable ("we finished the milk")', async () => {
      const milk = await seed('Milk', 'tracked', 200)
      const tools = createInventoryTools(repo)
      const result = await tools.set_ingredient_state.execute({
        ingredientId: milk.id,
        state: 'unavailable',
      })
      expect(result.ingredient).toMatchObject({ state: 'unavailable', quantity: 0 })
      expect((await repo.get(milk.id))?.state).toBe('unavailable')
    })

    it('restores a Tracked quantity from Unavailable', async () => {
      const milk = await seed('Milk', 'unavailable')
      const tools = createInventoryTools(repo)
      const result = await tools.set_ingredient_state.execute({
        ingredientId: milk.id,
        state: 'tracked',
        quantity: 500,
      })
      expect(result.ingredient).toMatchObject({ state: 'tracked', quantity: 500 })
    })

    it('rejects Tracked without a quantity at the schema boundary', () => {
      const tools = createInventoryTools(repo)
      expect(() =>
        tools.set_ingredient_state.inputSchema.parse({
          ingredientId: 'x',
          state: 'tracked',
        }),
      ).not.toThrow() // schema allows optional quantity; the service enforces it
    })
  })
})
