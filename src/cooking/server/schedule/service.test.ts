import { beforeEach, describe, expect, it } from 'vitest'
import { InMemoryScheduleRepo } from './repo'
import type { ScheduleRepo } from './repo'
import { InMemoryInventoryRepo } from '../inventory/repo'
import type { InventoryRepo } from '../inventory/repo'
import { InMemoryRecipeRepo } from '../recipes/repo'
import { InMemoryFoodBankRepo } from '../food-bank/repo'
import { addIngredient } from '../inventory/service'
import {
  assignAdhoc,
  assignFoodBank,
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
    adhocServings: null,
    cooked: false,
    bankedPortions: null,
    ...partial,
  }
}

describe('schedule service', () => {
  let repo: ScheduleRepo
  const weekStart = currentWeekStart()
  // A week entirely in the future, so every slot is "today-or-future" and
  // participates in the forward shortfall projection.
  const futureWeekStart = addDays(currentWeekStart(), 7)

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
      const slots = [slot(addDays(futureWeekStart, 1), 'lunch', { assignmentType: 'recipe', recipeId: 'rcp_1' })]

      const week = buildWeek(futureWeekStart, slots, [rcp], inventory)
      expect(week.days[1].lunch.assignment?.type).toBe('recipe')
      expect(week.days[1].lunch.assignment?.recipeName).toBe('Omelette')
      expect(week.days[1].lunch.shortfall).toBe(1)
    })

    it('flags an ad-hoc slot against inventory', () => {
      const slots = [
        slot(addDays(futureWeekStart, 2), 'dinner', {
          assignmentType: 'adhoc',
          adhocName: 'Toast',
          adhocIngredients: [{ ingredientId: 'ing_bread', quantity: 2 }],
        }),
      ]
      const week = buildWeek(futureWeekStart, slots, [], [])
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
        slot(addDays(futureWeekStart, 0), 'lunch', { assignmentType: 'recipe', recipeId: 'rcp_egg' }),
        slot(addDays(futureWeekStart, 2), 'dinner', { assignmentType: 'recipe', recipeId: 'rcp_egg' }),
      ]
      const week = buildWeek(futureWeekStart, slots, [rcp], inventory)
      expect(week.days[0].lunch.shortfall).toBe(0) // 6 >= 4, sim drops to 2
      expect(week.days[2].dinner.shortfall).toBe(1) // only 2 left, needs 4
    })

    it('does not project cooked slots — they already consumed real inventory', () => {
      const rcp = recipe('rcp_egg', 'Eggs', [{ id: 'ing_egg', qty: 4 }])
      const inventory: InventoryItem[] = [
        {
          ingredient: { id: 'ing_egg', name: 'Egg', unit: 'piece', createdAt: new Date() },
          state: 'tracked',
          quantity: 4,
          updatedAt: new Date(),
        },
      ]
      const slots = [
        slot(addDays(futureWeekStart, 1), 'lunch', { assignmentType: 'recipe', recipeId: 'rcp_egg', cooked: true }),
        slot(addDays(futureWeekStart, 3), 'dinner', { assignmentType: 'recipe', recipeId: 'rcp_egg' }),
      ]
      const week = buildWeek(futureWeekStart, slots, [rcp], inventory)
      // Cooked slot is not projected…
      expect(week.days[1].lunch.shortfall).toBeNull()
      // …so it didn't consume the simulated balance — the future dinner still
      // sees all 4 eggs (Cook already took its 4 from real inventory).
      expect(week.days[3].dinner.shortfall).toBe(0)
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

  describe('past weeks are read-only (archive lock)', () => {
    let schedule: ScheduleRepo
    beforeEach(() => {
      schedule = new InMemoryScheduleRepo()
    })

    it('clearSlot rejects a past-week slot', async () => {
      const pastDate = addDays(currentWeekStart(), -7)
      await expect(clearSlot(schedule, pastDate, 'lunch')).rejects.toThrow(/past week/i)
    })

    it('assignRecipe rejects a past-week slot', async () => {
      await expect(
        assignRecipe(schedule, addDays(currentWeekStart(), -7), 'lunch', 'rcp_1'),
      ).rejects.toThrow(/past week/i)
    })
  })

  describe('Food Bank reservations (service layer)', () => {
    let schedule: ScheduleRepo
    let recipes: InMemoryRecipeRepo
    let foodBank: InMemoryFoodBankRepo

    beforeEach(async () => {
      schedule = new InMemoryScheduleRepo()
      recipes = new InMemoryRecipeRepo()
      foodBank = new InMemoryFoodBankRepo()
    })

    it('reserves portions and blocks once availability runs out', async () => {
      const rcp = await recipes.create({
        name: 'Chili',
        servings: 4,
        notes: null,
        ingredients: [],
      })
      await foodBank.addPortions(rcp.id, 3) // 3 real portions available

      const base = addDays(currentWeekStart(), 7) // next week, in horizon
      await assignFoodBank(schedule, foodBank, recipes, base, 'lunch', rcp.id)
      await assignFoodBank(schedule, foodBank, recipes, addDays(base, 1), 'lunch', rcp.id)
      await assignFoodBank(schedule, foodBank, recipes, addDays(base, 2), 'lunch', rcp.id)

      // The three reservations each created a foodbank slot.
      const reservedSlot = await schedule.getSlot(base, 'lunch')
      expect(reservedSlot?.assignmentType).toBe('foodbank')
      expect(reservedSlot?.recipeId).toBe(rcp.id)

      // A 4th would over-reserve (3 produced − 3 reserved = 0).
      await expect(
        assignFoodBank(schedule, foodBank, recipes, addDays(base, 3), 'lunch', rcp.id),
      ).rejects.toThrow(/no portions available/i)
    })

    it('reserves against projected portions from a planned cook', async () => {
      const rcp = await recipes.create({
        name: 'Chili',
        servings: 4,
        notes: null,
        ingredients: [],
      })
      const base = addDays(currentWeekStart(), 1)
      // Plan a cook (uncooked recipe slot) — projects servings − 1 = 3 portions.
      await assignRecipe(schedule, base, 'lunch', rcp.id)

      // No real portions, but the projected 3 let us reserve 2 future portions.
      await assignFoodBank(schedule, foodBank, recipes, addDays(base, 1), 'dinner', rcp.id)
      await assignFoodBank(schedule, foodBank, recipes, addDays(base, 2), 'dinner', rcp.id)
      expect((await schedule.getSlot(addDays(base, 1), 'dinner'))?.assignmentType).toBe('foodbank')
    })
  })
})
