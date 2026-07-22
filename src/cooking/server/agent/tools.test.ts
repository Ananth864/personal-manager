import { beforeEach, describe, expect, it } from 'vitest'
import { InMemoryInventoryRepo } from '../inventory/repo'
import { InMemoryScheduleRepo } from '../schedule/repo'
import { InMemoryRecipeRepo } from '../recipes/repo'
import { InMemoryFoodBankRepo } from '../food-bank/repo'
import { addIngredient } from '../inventory/service'
import { createAgentTools  } from './tools'
import type {AgentToolDeps} from './tools';
import { addDays, currentWeekStart } from '../../schedule/date-utils'
import type { InventoryItem } from '../inventory/types'

const SLOT_DATE = addDays(currentWeekStart(), 1) // tomorrow, in the current week

function makeDeps(): AgentToolDeps {
  return {
    inventory: new InMemoryInventoryRepo(),
    schedule: new InMemoryScheduleRepo(),
    recipes: new InMemoryRecipeRepo(),
    foodBank: new InMemoryFoodBankRepo(),
  }
}

async function seedIngredient(
  deps: AgentToolDeps,
  name: string,
  state: InventoryItem['state'],
  quantity?: number,
) {
  const item = await addIngredient(deps.inventory, {
    name,
    unit: state === 'endless' ? 'g' : 'piece',
    state,
    quantity: quantity ?? null,
  })
  return item.ingredient
}

/**
 * Tool-boundary tests (T08 + T09). Each calls a tool's `execute` against
 * in-memory repos — the test double for the Clerk-session-scoped Supabase repos
 * — and asserts it runs the right service logic with the right args and returns a
 * domain-shaped result. The model is not involved (these target the tool↔service
 * seam). The structural test guards the ADR-0003 capability boundary.
 */
describe('agent tools', () => {
  let deps: AgentToolDeps
  beforeEach(() => {
    deps = makeDeps()
  })

  // ── Structural: the capability boundary (ADR-0003) ──────────────────────
  describe('capability boundary', () => {
    it('exposes exactly the twelve allowed tools and none forbidden', () => {
      const tools = createAgentTools(deps)
      const names = Object.keys(tools).sort()
      expect(names).toEqual(
        [
          'add_ingredient',
          'add_recipe',
          'assign_slot',
          'clear_slot',
          'query_food_bank',
          'query_ingredients',
          'query_inventory',
          'query_past_weeks',
          'query_recipes',
          'query_schedule',
          'restock_ingredient',
          'set_ingredient_state',
        ].sort(),
      )
      // The autonomy boundary is enforced by ABSENCE — none of these exist.
      for (const forbidden of [
        'trigger_cook',
        'cook',
        'update_recipe',
        'delete_recipe',
        'query_database',
        'run_sql',
      ]) {
        expect(tools).not.toHaveProperty(forbidden)
      }
    })
  })

  // ── Inventory (T08) ─────────────────────────────────────────────────────
  describe('query_inventory', () => {
    it('lists every item in the compact shape', async () => {
      await seedIngredient(deps, 'Egg', 'tracked', 6)
      const tools = createAgentTools(deps)
      const result = await tools.query_inventory.execute()
      expect(result.inventory[0]).toMatchObject({ name: 'Egg', state: 'tracked', quantity: 6 })
    })
  })

  describe('restock_ingredient', () => {
    it('adds quantity additively', async () => {
      const egg = await seedIngredient(deps, 'Egg', 'tracked', 4)
      const tools = createAgentTools(deps)
      const result = await tools.restock_ingredient.execute({
        ingredientId: egg.id,
        quantity: 6,
      })
      expect(result.ingredient.quantity).toBe(10)
      expect((await deps.inventory.get(egg.id))?.quantity).toBe(10)
    })
  })

  describe('set_ingredient_state', () => {
    it('moves an ingredient to unavailable', async () => {
      const milk = await seedIngredient(deps, 'Milk', 'tracked', 200)
      const tools = createAgentTools(deps)
      const result = await tools.set_ingredient_state.execute({
        ingredientId: milk.id,
        state: 'unavailable',
      })
      expect(result.ingredient.state).toBe('unavailable')
      expect((await deps.inventory.get(milk.id))?.state).toBe('unavailable')
    })
  })

  // ── Schedule ────────────────────────────────────────────────────────────
  describe('assign_slot', () => {
    it('assigns a recipe via the recipe variant', async () => {
      const egg = await seedIngredient(deps, 'Egg', 'tracked', 6)
      ;(deps.recipes as InMemoryRecipeRepo).seed([egg])
      const r = await deps.recipes.create({
        name: 'Omelette',
        servings: 2,
        notes: null,
        ingredients: [{ ingredientId: egg.id, quantity: 2 }],
      })
      const tools = createAgentTools(deps)
      const result = await tools.assign_slot.execute({
        type: 'recipe',
        date: SLOT_DATE,
        meal: 'lunch',
        recipeId: r.id,
      })
      expect(result.assigned).toBe('recipe')
      const slot = await deps.schedule.getSlot(SLOT_DATE, 'lunch')
      expect(slot?.assignmentType).toBe('recipe')
      expect(slot?.recipeId).toBe(r.id)
    })

    it('assigns an ad-hoc recipe via the adhoc variant', async () => {
      const bread = await seedIngredient(deps, 'Bread', 'tracked', 4)
      const tools = createAgentTools(deps)
      await tools.assign_slot.execute({
        type: 'adhoc',
        date: SLOT_DATE,
        meal: 'dinner',
        name: 'Toast',
        servings: 2,
        ingredients: [{ ingredientId: bread.id, quantity: 2 }],
      })
      const slot = await deps.schedule.getSlot(SLOT_DATE, 'dinner')
      expect(slot?.assignmentType).toBe('adhoc')
      expect(slot?.adhocServings).toBe(2)
    })

    it('marks No Cook via the no_cook variant', async () => {
      const tools = createAgentTools(deps)
      await tools.assign_slot.execute({ type: 'no_cook', date: SLOT_DATE, meal: 'lunch' })
      expect((await deps.schedule.getSlot(SLOT_DATE, 'lunch'))?.assignmentType).toBe('nocook')
    })

    it('withdraws a Food Bank portion via the food_bank variant', async () => {
      const egg = await seedIngredient(deps, 'Egg', 'tracked', 6)
      ;(deps.recipes as InMemoryRecipeRepo).seed([egg])
      const r = await deps.recipes.create({
        name: 'Quiche',
        servings: 4,
        notes: null,
        ingredients: [{ ingredientId: egg.id, quantity: 2 }],
      })
      await deps.foodBank.addPortions(r.id, 3)
      const tools = createAgentTools(deps)
      await tools.assign_slot.execute({
        type: 'food_bank',
        date: SLOT_DATE,
        meal: 'lunch',
        recipeId: r.id,
      })
      expect((await deps.schedule.getSlot(SLOT_DATE, 'lunch'))?.assignmentType).toBe('foodbank')
    })
  })

  describe('clear_slot', () => {
    it('removes a slot assignment', async () => {
      const tools = createAgentTools(deps)
      await tools.assign_slot.execute({ type: 'no_cook', date: SLOT_DATE, meal: 'lunch' })
      await tools.clear_slot.execute({ date: SLOT_DATE, meal: 'lunch' })
      expect(await deps.schedule.getSlot(SLOT_DATE, 'lunch')).toBeNull()
    })
  })

  describe('query_schedule', () => {
    it('returns the current week with per-day lunch/dinner labels', async () => {
      const tools = createAgentTools(deps)
      await tools.assign_slot.execute({ type: 'no_cook', date: SLOT_DATE, meal: 'lunch' })
      const result = await tools.query_schedule.execute()
      const day = result.week.days.find((d: { date: string }) => d.date === SLOT_DATE)
      expect(day?.lunch).toBe('No cook')
      expect(day?.dinner).toBeNull()
    })
  })

  describe('query_past_weeks', () => {
    it('returns read-only summaries of recent past weeks', async () => {
      const tools = createAgentTools(deps)
      const result = await tools.query_past_weeks.execute({ weeks: 2 })
      expect(result.weeks).toHaveLength(2)
      expect(result.weeks.every((w: { readonly: boolean }) => w.readonly)).toBe(true)
    })
  })

  // ── Catalog ─────────────────────────────────────────────────────────────
  describe('add_recipe', () => {
    it('creates a recipe in the catalog referencing existing ingredients', async () => {
      const egg = await seedIngredient(deps, 'Egg', 'tracked', 6)
      ;(deps.recipes as InMemoryRecipeRepo).seed([egg])
      const tools = createAgentTools(deps)
      const result = await tools.add_recipe.execute({
        name: 'Omelette',
        servings: 2,
        notes: null,
        ingredients: [{ ingredientId: egg.id, quantity: 2 }],
      })
      expect(result.recipe.name).toBe('Omelette')
      const stored = await deps.recipes.get(result.recipe.id)
      expect(stored?.ingredients).toHaveLength(1)
    })
  })

  describe('add_ingredient', () => {
    it('adds a new tracked ingredient to the catalog + inventory', async () => {
      const tools = createAgentTools(deps)
      const result = await tools.add_ingredient.execute({
        name: 'Avocado',
        unit: 'piece',
        state: 'tracked',
        quantity: 3,
      })
      expect(result.ingredient).toMatchObject({ name: 'Avocado', state: 'tracked', quantity: 3 })
      expect((await deps.inventory.list()).map((i) => i.ingredient.name)).toContain('Avocado')
    })
  })

  // ── Queries ─────────────────────────────────────────────────────────────
  describe('query_recipes', () => {
    it('lists recipes with ingredient lines', async () => {
      const egg = await seedIngredient(deps, 'Egg', 'tracked', 6)
      ;(deps.recipes as InMemoryRecipeRepo).seed([egg])
      await deps.recipes.create({
        name: 'Omelette',
        servings: 2,
        notes: null,
        ingredients: [{ ingredientId: egg.id, quantity: 2 }],
      })
      const tools = createAgentTools(deps)
      const result = await tools.query_recipes.execute()
      expect(result.recipes[0]).toMatchObject({ name: 'Omelette', servings: 2 })
      expect(result.recipes[0].ingredients[0]).toMatchObject({ name: 'Egg', quantity: 2 })
    })
  })

  describe('query_ingredients', () => {
    it('lists the catalog (id/name/unit) without state', async () => {
      await seedIngredient(deps, 'Salt', 'endless')
      const tools = createAgentTools(deps)
      const result = await tools.query_ingredients.execute()
      expect(result.ingredients[0]).toMatchObject({ name: 'Salt', unit: 'g' })
      expect(result.ingredients[0]).not.toHaveProperty('state')
    })
  })

  describe('query_food_bank', () => {
    it('returns the derived Food Bank summary', async () => {
      const egg = await seedIngredient(deps, 'Egg', 'tracked', 12)
      ;(deps.recipes as InMemoryRecipeRepo).seed([egg])
      const r = await deps.recipes.create({
        name: 'Quiche',
        servings: 4,
        notes: null,
        ingredients: [{ ingredientId: egg.id, quantity: 2 }],
      })
      await deps.foodBank.addPortions(r.id, 3)
      const tools = createAgentTools(deps)
      const result = await tools.query_food_bank.execute()
      const entry = result.foodBank.find((e: { recipeName: string }) => e.recipeName === 'Quiche')
      expect(entry).toMatchObject({ produced: 3, available: 3 })
    })
  })
})
