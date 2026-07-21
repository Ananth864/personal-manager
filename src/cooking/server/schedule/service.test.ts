import { beforeEach, describe, expect, it } from 'vitest'
import { InMemoryScheduleRepo } from './repo'
import type { ScheduleRepo } from './repo'
import { InMemoryInventoryRepo } from '../inventory/repo'
import type { InventoryRepo } from '../inventory/repo'
import { addIngredient } from '../inventory/service'
import {
  assignAdhoc,
  assignRecipe,
  buildWeek,
  clearSlot,
  markNoCook,
} from './service'
import { addDays, currentWeekStart } from '../../schedule/date-utils'
import type { InventoryItem } from '../inventory/types'
import type { RecipeDetail } from '../recipes/types'
import type { SlotRow } from './types'

function recipe(id: string, name: string, lines: { id: string; qty: number }[]): RecipeDetail {
  return {
    id,
    name,
    servings: 2,
    notes: null,
    createdAt: new Date(),
    ingredients: lines.map((l) => ({
      ingredient: {
        id: l.id,
        name: l.id,
        unit: 'g',
        createdAt: new Date(),
      },
      quantity: l.qty,
    })),
  }
}

function slot(
  slotDate: string,
  meal: 'lunch' | 'dinner',
  partial: Partial<SlotRow>,
): SlotRow {
  return {
    id: `${slotDate}_${meal}`,
    slotDate,
    meal,
    assignmentType: 'recipe',
    recipeId: null,
    adhocName: null,
    adhocIngredients: null,
    cooked: false,
    ...partial,
  }
}

describe('schedule service', () => {
  let repo: ScheduleRepo
  const weekStart = currentWeekStart()

  beforeEach(() => {
    repo = new InMemoryScheduleRepo()
  })

  describe('buildWeek', () => {
    it('renders seven days, each with lunch and dinner unassigned', () => {
      const week = buildWeek(weekStart, [], [], [])
      expect(week.days).toHaveLength(7)
      for (const day of week.days) {
        expect(day.lunch.assignment).toBeNull()
        expect(day.dinner.assignment).toBeNull()
        expect(day.lunch.shortfall).toBeNull()
      }
    })

    it('marks a fully-past week as read-only', () => {
      const past = addDays(weekStart, -14)
      expect(buildWeek(past, [], [], []).readonly).toBe(true)
      expect(buildWeek(weekStart, [], [], []).readonly).toBe(false)
    })

    it('flags a recipe slot with the count of missing ingredients', () => {
      const rcp = recipe('rcp_1', 'Omelette', [
        { id: 'ing_egg', qty: 3 },
        { id: 'ing_salt', qty: 1 },
      ])
      const inventory: InventoryItem[] = [
        {
          ingredient: { id: 'ing_egg', name: 'Egg', unit: 'piece', createdAt: new Date() },
          state: 'tracked',
          quantity: 6,
          updatedAt: new Date(),
        },
        // salt not in inventory -> missing
      ]
      const slots = [slot(addDays(weekStart, 1), 'lunch', { assignmentType: 'recipe', recipeId: 'rcp_1' })]

      const week = buildWeek(weekStart, slots, [rcp], inventory)
      expect(week.days[1].lunch.assignment?.type).toBe('recipe')
      expect(week.days[1].lunch.assignment?.recipeName).toBe('Omelette')
      expect(week.days[1].lunch.shortfall).toBe(1)
    })

    it('flags an ad-hoc slot against inventory', () => {
      const slots = [
        slot(addDays(weekStart, 2), 'dinner', {
          assignmentType: 'adhoc',
          adhocName: 'Toast',
          adhocIngredients: [{ ingredientId: 'ing_bread', quantity: 2 }],
        }),
      ]
      const week = buildWeek(weekStart, slots, [], [])
      expect(week.days[2].dinner.assignment?.type).toBe('adhoc')
      expect(week.days[2].dinner.shortfall).toBe(1)
    })

    it('leaves shortfall null for No Cook and unassigned slots', () => {
      const slots = [slot(addDays(weekStart, 3), 'lunch', { assignmentType: 'nocook' })]
      const week = buildWeek(weekStart, slots, [], [])
      expect(week.days[3].lunch.shortfall).toBeNull()
      expect(week.days[3].dinner.shortfall).toBeNull() // unassigned
    })

    it('projects shortfall sequentially: earlier meals consume Tracked stock', () => {
      // 6 eggs tracked; two meals each needing 4 eggs. The first is cookable,
      // the second flags short because the first used up 4 of the 6.
      const rcp = recipe('rcp_egg', 'Eggs', [{ id: 'ing_egg', qty: 4 }])
      const inventory: InventoryItem[] = [
        {
          ingredient: { id: 'ing_egg', name: 'Egg', unit: 'piece', createdAt: new Date() },
          state: 'tracked',
          quantity: 6,
          updatedAt: new Date(),
        },
      ]
      const slots = [
        slot(addDays(weekStart, 0), 'lunch', { assignmentType: 'recipe', recipeId: 'rcp_egg' }),
        slot(addDays(weekStart, 2), 'dinner', { assignmentType: 'recipe', recipeId: 'rcp_egg' }),
      ]
      const week = buildWeek(weekStart, slots, [rcp], inventory)
      expect(week.days[0].lunch.shortfall).toBe(0) // 6 >= 4, sim drops to 2
      expect(week.days[2].dinner.shortfall).toBe(1) // only 2 left, needs 4
    })

    it('never mutates the Inventory it was given (planning ≠ cooking)', () => {
      const rcp = recipe('rcp_egg', 'Eggs', [{ id: 'ing_egg', qty: 4 }])
      const inventory: InventoryItem[] = [
        {
          ingredient: { id: 'ing_egg', name: 'Egg', unit: 'piece', createdAt: new Date() },
          state: 'tracked',
          quantity: 6,
          updatedAt: new Date(),
        },
      ]
      const before = structuredClone(inventory)
      buildWeek(
        weekStart,
        [slot(addDays(weekStart, 0), 'lunch', { assignmentType: 'recipe', recipeId: 'rcp_egg' })],
        [rcp],
        inventory,
      )
      expect(inventory).toEqual(before)
    })
  })

  describe('mutations leave Inventory unchanged (ADR-0001)', () => {
    let inventory: InventoryRepo
    let snapshot: InventoryItem[]
    let eggId: string
    let milkId: string

    beforeEach(async () => {
      inventory = new InMemoryInventoryRepo()
      const egg = await addIngredient(inventory, { name: 'Egg', unit: 'piece', state: 'tracked', quantity: 6 })
      const milk = await addIngredient(inventory, { name: 'Milk', unit: 'ml', state: 'endless' })
      eggId = egg.ingredient.id
      milkId = milk.ingredient.id
      snapshot = structuredClone(await inventory.list())
    })

    it('every Schedule mutation leaves the Inventory rows byte-for-byte the same', async () => {
      const date = addDays(weekStart, 1)
      await assignRecipe(repo, date, 'lunch', 'rcp_1')
      await markNoCook(repo, date, 'dinner')
      await assignAdhoc(repo, addDays(weekStart, 2), 'lunch', {
        name: 'Custom',
        ingredients: [{ ingredientId: eggId, quantity: 2 }, { ingredientId: milkId, quantity: 100 }],
      })
      await clearSlot(repo, date, 'lunch')

      const after = await inventory.list()
      expect(after).toEqual(snapshot)
    })

    it('rejects an ad-hoc recipe with no ingredients (without touching inventory)', async () => {
      await expect(
        assignAdhoc(repo, addDays(weekStart, 1), 'lunch', { ingredients: [] }),
      ).rejects.toThrow(/at least one ingredient/i)
      expect(await inventory.list()).toEqual(snapshot)
    })

    it('rejects a duplicate ingredient in an ad-hoc recipe', async () => {
      await expect(
        assignAdhoc(repo, addDays(weekStart, 1), 'lunch', {
          ingredients: [
            { ingredientId: eggId, quantity: 1 },
            { ingredientId: eggId, quantity: 2 },
          ],
        }),
      ).rejects.toThrow(/twice/i)
    })
  })
})
