import { beforeEach, describe, expect, it } from 'vitest'
import { InMemoryFoodBankRepo } from './repo'
import { InMemoryScheduleRepo } from '../schedule/repo'
import { InMemoryRecipeRepo } from '../recipes/repo'
import { assignFoodBank } from '../schedule/service'
import { discardPortions } from './service'
import { addDays, currentWeekStart } from '../../schedule/date-utils'

describe('Food Bank discard', () => {
  let foodBank: InMemoryFoodBankRepo
  let schedule: InMemoryScheduleRepo
  let recipes: InMemoryRecipeRepo

  beforeEach(() => {
    foodBank = new InMemoryFoodBankRepo()
    schedule = new InMemoryScheduleRepo()
    recipes = new InMemoryRecipeRepo()
  })

  it('reduces produced portions directly', async () => {
    await foodBank.addPortions('r1', 5)
    await discardPortions(foodBank, schedule, 'r1', 2)
    expect(foodBank.portionsFor('r1')).toBe(3)
  })

  it('discards from the ad-hoc pool when recipeId is null', async () => {
    await foodBank.addPortions(null, 4)
    await discardPortions(foodBank, schedule, null, 3)
    expect(foodBank.portionsFor(null)).toBe(1)
  })

  it('is a no-op-safe floor at zero (repo never goes negative)', async () => {
    await foodBank.addPortions('r1', 1)
    await discardPortions(foodBank, schedule, 'r1', 1)
    expect(foodBank.portionsFor('r1')).toBe(0)
  })

  it('guards the reservation floor: cannot discard portions reserved by slots', async () => {
    const rcp = await recipes.create({ name: 'Chili', servings: 4, notes: null, ingredients: [] })
    await foodBank.addPortions(rcp.id, 5)
    const base = addDays(currentWeekStart(), 1)
    // Reserve 2 of the 5 portions.
    await assignFoodBank(schedule, foodBank, recipes, base, 'lunch', rcp.id)
    await assignFoodBank(schedule, foodBank, recipes, addDays(base, 1), 'lunch', rcp.id)

    // discardable = 5 produced − 2 reserved = 3.
    await discardPortions(foodBank, schedule, rcp.id, 3)
    expect(foodBank.portionsFor(rcp.id)).toBe(2)

    // The remaining 2 are all reserved — discarding 1 must throw.
    await expect(discardPortions(foodBank, schedule, rcp.id, 1)).rejects.toThrow(
      /reserved by meal slots/i,
    )
  })

  it('rejects a non-positive count', async () => {
    await foodBank.addPortions('r1', 5)
    await expect(discardPortions(foodBank, schedule, 'r1', 0)).rejects.toThrow(/positive/i)
    await expect(discardPortions(foodBank, schedule, 'r1', -1)).rejects.toThrow(/positive/i)
  })
})
