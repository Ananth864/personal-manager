import { beforeEach, describe, expect, it } from 'vitest'
import { InMemoryScheduleRepo } from './repo'
import type { ScheduleRepo } from './repo'
import { InMemoryInventoryRepo } from '../inventory/repo'
import type { InventoryRepo } from '../inventory/repo'
import { InMemoryIngredientLedgerRepo } from '../inventory/ledger-repo'
import type { IngredientLedgerRepo } from '../inventory/ledger-repo'
import { InMemoryRecipeRepo } from '../recipes/repo'
import { InMemoryFoodBankRepo } from '../food-bank/repo'
import { addIngredient } from '../inventory/service'
import { buildCookPreview, cook, uncook } from './cook'
import type { Ingredient, InventoryItem } from '../inventory/types'

const DATE = '2025-01-01'

describe('cook', () => {
  let schedule: ScheduleRepo
  let inventory: InventoryRepo
  let recipes: InMemoryRecipeRepo
  let foodBank: InMemoryFoodBankRepo
  let ledger: IngredientLedgerRepo

  beforeEach(() => {
    schedule = new InMemoryScheduleRepo()
    inventory = new InMemoryInventoryRepo()
    recipes = new InMemoryRecipeRepo()
    foodBank = new InMemoryFoodBankRepo()
    ledger = new InMemoryIngredientLedgerRepo()
  })

  async function tracked(name: string, qty: number): Promise<Ingredient> {
    const item = await addIngredient(inventory, {
      name,
      unit: 'g',
      state: 'tracked',
      quantity: qty,
    })
    return item.ingredient
  }

  async function endless(name: string): Promise<Ingredient> {
    const item = await addIngredient(inventory, { name, unit: 'g', state: 'endless' })
    return item.ingredient
  }

  async function unavailable(name: string): Promise<Ingredient> {
    const item = await addIngredient(inventory, { name, unit: 'g', state: 'unavailable' })
    return item.ingredient
  }

  async function recipeWith(
    name: string,
    servings: number,
    lines: { ingredient: Ingredient; quantity: number }[],
  ): Promise<string> {
    recipes.seed(lines.map((l) => l.ingredient))
    const r = await recipes.create({
      name,
      servings,
      notes: null,
      ingredients: lines.map((l) => ({ ingredientId: l.ingredient.id, quantity: l.quantity })),
    })
    return r.id
  }

  async function cookSlot(date: string, meal: 'lunch' | 'dinner') {
    return cook(schedule, inventory, foodBank, recipes, ledger, date, meal)
  }

  it('decrements each Tracked ingredient by the recipe quantity', async () => {
    const egg = await tracked('Egg', 6)
    const flour = await tracked('Flour', 200)
    const recipeId = await recipeWith('Pancakes', 4, [
      { ingredient: egg, quantity: 2 },
      { ingredient: flour, quantity: 50 },
    ])
    await schedule.upsertSlot({
      slotDate: DATE,
      meal: 'lunch',
      assignmentType: 'recipe',
      recipeId,
    })

    await cookSlot(DATE, 'lunch')

    expect((await inventory.get(egg.id))?.quantity).toBe(4)
    expect((await inventory.get(egg.id))?.state).toBe('tracked')
    expect((await inventory.get(flour.id))?.quantity).toBe(150)
  })

  it('clamps at zero and transitions to Unavailable', async () => {
    const egg = await tracked('Egg', 2)
    const recipeId = await recipeWith('Omelette', 2, [{ ingredient: egg, quantity: 5 }])
    await schedule.upsertSlot({ slotDate: DATE, meal: 'lunch', assignmentType: 'recipe', recipeId })

    await cookSlot(DATE, 'lunch')

    const after = await inventory.get(egg.id)
    expect(after?.state).toBe('unavailable')
    expect(after?.quantity).toBe(0)
  })

  it('leaves Endless ingredients unaffected', async () => {
    const salt = await endless('Salt')
    const egg = await tracked('Egg', 6)
    const recipeId = await recipeWith('Eggs', 2, [
      { ingredient: salt, quantity: 9999 },
      { ingredient: egg, quantity: 2 },
    ])
    await schedule.upsertSlot({ slotDate: DATE, meal: 'lunch', assignmentType: 'recipe', recipeId })

    await cookSlot(DATE, 'lunch')

    const saltAfter = await inventory.get(salt.id)
    expect(saltAfter?.state).toBe('endless')
    expect(saltAfter?.quantity).toBeNull()
  })

  it('leaves Unavailable ingredients Unavailable (no negatives)', async () => {
    const milk = await unavailable('Milk')
    const recipeId = await recipeWith('Latte', 1, [{ ingredient: milk, quantity: 200 }])
    await schedule.upsertSlot({ slotDate: DATE, meal: 'lunch', assignmentType: 'recipe', recipeId })

    await cookSlot(DATE, 'lunch')

    const after = await inventory.get(milk.id)
    expect(after?.state).toBe('unavailable')
    expect(after?.quantity).toBe(0)
  })

    it('banks servings − 1 portions (the cooking slot eats one)', async () => {
      const egg = await tracked('Egg', 12)
      const recipeId = await recipeWith('Quiche', 6, [{ ingredient: egg, quantity: 3 }])
      await schedule.upsertSlot({ slotDate: DATE, meal: 'dinner', assignmentType: 'recipe', recipeId })

      const result = await cookSlot(DATE, 'dinner')
      expect(result.produced).toBe(5)
      expect(foodBank.portionsFor(recipeId)).toBe(5)
    })

    it('banks nothing for a single-serving recipe (the slot eats the only portion)', async () => {
      const egg = await tracked('Egg', 12)
      const recipeId = await recipeWith('Solo', 1, [{ ingredient: egg, quantity: 1 }])
      await schedule.upsertSlot({ slotDate: DATE, meal: 'dinner', assignmentType: 'recipe', recipeId })

      const result = await cookSlot(DATE, 'dinner')
      expect(result.produced).toBe(0)
      expect(foodBank.portionsFor(recipeId)).toBe(0)
    })

  it('commingles portions across multiple cooks of the same recipe', async () => {
    const egg = await tracked('Egg', 24)
    const recipeId = await recipeWith('Quiche', 6, [{ ingredient: egg, quantity: 3 }])
    await schedule.upsertSlot({ slotDate: '2025-01-01', meal: 'dinner', assignmentType: 'recipe', recipeId })
    await schedule.upsertSlot({ slotDate: '2025-01-02', meal: 'dinner', assignmentType: 'recipe', recipeId })

      await cook(schedule, inventory, foodBank, recipes, ledger, '2025-01-01', 'dinner')
      await cook(schedule, inventory, foodBank, recipes, ledger, '2025-01-02', 'dinner')

      expect(foodBank.portionsFor(recipeId)).toBe(10)
    })

  it('cooks an Ad-hoc slot: decrements and produces servings into the ad-hoc pool', async () => {
    const bread = await tracked('Bread', 4)
    await schedule.upsertSlot({
      slotDate: DATE,
      meal: 'lunch',
      assignmentType: 'adhoc',
      adhocName: 'Toast',
      adhocServings: 2,
      adhocIngredients: [{ ingredientId: bread.id, quantity: 2 }],
    })

    const result = await cookSlot(DATE, 'lunch')
    expect(result.produced).toBe(1)
    expect((await inventory.get(bread.id))?.quantity).toBe(2)
    expect(foodBank.portionsFor(null)).toBe(1) // ad-hoc pool (servings 2 − 1 eaten)
  })

  it('blocks a second Cook on the same slot (one Cook per slot)', async () => {
    const egg = await tracked('Egg', 12)
    const recipeId = await recipeWith('Eggs', 2, [{ ingredient: egg, quantity: 2 }])
    await schedule.upsertSlot({ slotDate: DATE, meal: 'lunch', assignmentType: 'recipe', recipeId })

    await cookSlot(DATE, 'lunch')
    await expect(cookSlot(DATE, 'lunch')).rejects.toThrow(/already been cooked/i)
  })

  it('refuses to cook a No-Cook slot', async () => {
    await schedule.upsertSlot({ slotDate: DATE, meal: 'lunch', assignmentType: 'nocook' })
    await expect(cookSlot(DATE, 'lunch')).rejects.toThrow(/fresh-cook/i)
  })

  it('refuses to cook an unassigned slot', async () => {
    await expect(cookSlot(DATE, 'lunch')).rejects.toThrow(/nothing is assigned/i)
  })

  describe('uncook', () => {
    async function uncookSlot(date: string, meal: 'lunch' | 'dinner') {
      return uncook(schedule, inventory, foodBank, ledger, date, meal)
    }

    it('restores a Tracked ingredient to its pre-cook quantity and reverses banking', async () => {
      const egg = await tracked('Egg', 6)
      const recipeId = await recipeWith('Pancakes', 4, [{ ingredient: egg, quantity: 2 }])
      await schedule.upsertSlot({ slotDate: DATE, meal: 'lunch', assignmentType: 'recipe', recipeId })

      await cookSlot(DATE, 'lunch')
      expect((await inventory.get(egg.id))?.quantity).toBe(4)
      expect(foodBank.portionsFor(recipeId)).toBe(3)

      await uncookSlot(DATE, 'lunch')

      expect((await inventory.get(egg.id))?.quantity).toBe(6)
      expect((await inventory.get(egg.id))?.state).toBe('tracked')
      expect(foodBank.portionsFor(recipeId)).toBe(0)
      expect((await schedule.getSlot(DATE, 'lunch'))?.cooked).toBe(false)
    })

    it('restores exactly the actual (clamped) consumption, not the recipe request', async () => {
      const egg = await tracked('Egg', 2)
      const recipeId = await recipeWith('Omelette', 2, [{ ingredient: egg, quantity: 5 }])
      await schedule.upsertSlot({ slotDate: DATE, meal: 'lunch', assignmentType: 'recipe', recipeId })

      await cookSlot(DATE, 'lunch')
      expect((await inventory.get(egg.id))?.state).toBe('unavailable')

      await uncookSlot(DATE, 'lunch')

      // Recipe asked for 5 but only 2 were on hand → ledger recorded −2, so
      // Uncook restores exactly 2 (not 5).
      expect((await inventory.get(egg.id))?.quantity).toBe(2)
      expect((await inventory.get(egg.id))?.state).toBe('tracked')
    })

    it('preserves manual edits made between Cook and Uncook', async () => {
      const egg = await tracked('Egg', 6)
      const recipeId = await recipeWith('Pancakes', 4, [{ ingredient: egg, quantity: 2 }])
      await schedule.upsertSlot({ slotDate: DATE, meal: 'lunch', assignmentType: 'recipe', recipeId })

      await cookSlot(DATE, 'lunch') // 6 → 4 (delta −2)
      // Manual restock after the cook.
      const item = (await inventory.get(egg.id))!
      await inventory.save({ ...item, quantity: 10 })

      await uncookSlot(DATE, 'lunch')

      // 10 + 2 restored = 12 — the manual edit is preserved, not clobbered.
      expect((await inventory.get(egg.id))?.quantity).toBe(12)
    })

    it('reverses banking floored at produced − reserved (reservations stay backed)', async () => {
      const egg = await tracked('Egg', 12)
      const recipeId = await recipeWith('Quiche', 4, [{ ingredient: egg, quantity: 2 }])
      await schedule.upsertSlot({ slotDate: DATE, meal: 'lunch', assignmentType: 'recipe', recipeId })

      await cookSlot(DATE, 'lunch') // banks 3 portions
      // Reserve 2 of them against future slots.
      await schedule.upsertSlot({ slotDate: '2025-01-02', meal: 'lunch', assignmentType: 'foodbank', recipeId })
      await schedule.upsertSlot({ slotDate: '2025-01-03', meal: 'lunch', assignmentType: 'foodbank', recipeId })

      const result = await uncookSlot(DATE, 'lunch')

      // discardable = 3 produced − 2 reserved = 1; only 1 portion pulled back.
      expect(result.reversedPortions).toBe(1)
      expect(foodBank.portionsFor(recipeId)).toBe(2)
    })

    it('throws if the slot was not cooked', async () => {
      const egg = await tracked('Egg', 6)
      const recipeId = await recipeWith('Pancakes', 4, [{ ingredient: egg, quantity: 2 }])
      await schedule.upsertSlot({ slotDate: DATE, meal: 'lunch', assignmentType: 'recipe', recipeId })

      await expect(uncookSlot(DATE, 'lunch')).rejects.toThrow(/has not been cooked/i)
    })

    it('a second uncook is rejected (the first released the cooked flag)', async () => {
      const egg = await tracked('Egg', 6)
      const recipeId = await recipeWith('Pancakes', 4, [{ ingredient: egg, quantity: 2 }])
      await schedule.upsertSlot({ slotDate: DATE, meal: 'lunch', assignmentType: 'recipe', recipeId })

      await cookSlot(DATE, 'lunch')
      await uncookSlot(DATE, 'lunch')
      await expect(uncookSlot(DATE, 'lunch')).rejects.toThrow(/has not been cooked/i)
    })
  })
})

describe('buildCookPreview', () => {
  const DATE_ISO = new Date(0)
  function item(
    id: string,
    state: InventoryItem['state'],
    quantity: number | null,
  ): InventoryItem {
    return {
      ingredient: { id, name: id, unit: 'g', createdAt: DATE_ISO },
      state,
      quantity,
      updatedAt: DATE_ISO,
    }
  }

  it('projects a normal decrement and flags sufficient Tracked as not-a-warning', () => {
    const preview = buildCookPreview(
      [{ ingredientId: 'egg', quantity: 2, name: 'Egg', unit: 'piece' }],
      [item('egg', 'tracked', 6)],
      4,
    )
    expect(preview.portionsToProduce).toBe(4)
    expect(preview.lines[0]).toMatchObject({
      currentState: 'tracked',
      currentQty: 6,
      newState: 'tracked',
      newQty: 4,
      changed: true,
      warning: false,
    })
  })

  it('flags an insufficient Tracked ingredient and clamps the projection to Unavailable', () => {
    const preview = buildCookPreview(
      [{ ingredientId: 'egg', quantity: 5, name: 'Egg', unit: 'piece' }],
      [item('egg', 'tracked', 2)],
      2,
    )
    expect(preview.lines[0]).toMatchObject({
      currentState: 'tracked',
      currentQty: 2,
      newState: 'unavailable',
      newQty: 0,
      changed: true,
      warning: true,
    })
  })

  it('leaves Endless unchanged with no warning', () => {
    const preview = buildCookPreview(
      [{ ingredientId: 'salt', quantity: 999, name: 'Salt', unit: 'g' }],
      [item('salt', 'endless', null)],
      2,
    )
    expect(preview.lines[0]).toMatchObject({
      currentState: 'endless',
      newState: 'endless',
      changed: false,
      warning: false,
    })
  })
})
