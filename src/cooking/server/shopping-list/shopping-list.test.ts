import { describe, expect, it } from 'vitest'
import { buildShoppingList } from './shopping-list'
import type { PlannedCook } from '../food-bank/availability'
import type { RecipeDetail } from '../recipes/types'
import type { InventoryItem } from '../inventory/types'

const EPOCH = new Date(0)
const TODAY = '2030-01-08' // a Tuesday
const HORIZON = '2030-01-22' // current + next week (exclusive)

function inv(
  id: string,
  state: InventoryItem['state'],
  quantity: number | null,
): InventoryItem {
  return {
    ingredient: { id, name: id, unit: 'g', createdAt: EPOCH },
    state,
    quantity,
    updatedAt: EPOCH,
  }
}

function recipe(
  id: string,
  lines: { ingredientId: string; quantity: number; unit?: string }[],
): RecipeDetail {
  return {
    id,
    name: id,
    servings: 4,
    notes: null,
    createdAt: EPOCH,
    ingredients: lines.map((l) => ({
      ingredient: { id: l.ingredientId, name: l.ingredientId, unit: (l.unit ?? 'g') as never, createdAt: EPOCH },
      quantity: l.quantity,
    })),
  }
}

function cook(
  slotDate: string,
  recipeId: string | null,
  type: 'recipe' | 'adhoc' = 'recipe',
  adhoc?: { ingredientId: string; quantity: number }[],
): PlannedCook {
  return {
    recipeId,
    slotDate,
    assignmentType: type,
    adhocServings: type === 'adhoc' ? 2 : null,
    adhocIngredients: adhoc ?? null,
  }
}

describe('buildShoppingList', () => {
  it('lists an insufficient Tracked ingredient with the shortfall to buy', () => {
    const list = buildShoppingList(
      [cook(TODAY, 'r1')],
      [recipe('r1', [{ ingredientId: 'egg', quantity: 4 }])],
      [inv('egg', 'tracked', 2)],
      TODAY,
      HORIZON,
    )
    expect(list).toEqual([
      { ingredientId: 'egg', name: 'egg', unit: 'g', needed: 4, have: 2, buy: 2 },
    ])
  })

  it('excludes Endless ingredients (always available)', () => {
    const list = buildShoppingList(
      [cook(TODAY, 'r1')],
      [recipe('r1', [
        { ingredientId: 'salt', quantity: 999 },
        { ingredientId: 'egg', quantity: 2 },
      ])],
      [inv('salt', 'endless', null), inv('egg', 'tracked', 0)],
      TODAY,
      HORIZON,
    )
    expect(list.map((i) => i.ingredientId)).toEqual(['egg'])
  })

  it('lists an Unavailable ingredient at the full required quantity', () => {
    const list = buildShoppingList(
      [cook(TODAY, 'r1')],
      [recipe('r1', [{ ingredientId: 'milk', quantity: 200 }])],
      [inv('milk', 'unavailable', 0)],
      TODAY,
      HORIZON,
    )
    expect(list[0]).toMatchObject({ ingredientId: 'milk', have: 0, buy: 200 })
  })

  it('lists an ingredient with no Inventory entry (not yet stocked)', () => {
    const list = buildShoppingList(
      [cook(TODAY, 'r1')],
      [recipe('r1', [{ ingredientId: 'flour', quantity: 100 }])],
      [],
      TODAY,
      HORIZON,
    )
    expect(list[0]).toMatchObject({ ingredientId: 'flour', have: 0, buy: 100 })
  })

  it('excludes a fully-available Tracked ingredient (nothing to buy)', () => {
    const list = buildShoppingList(
      [cook(TODAY, 'r1')],
      [recipe('r1', [{ ingredientId: 'egg', quantity: 2 }])],
      [inv('egg', 'tracked', 5)],
      TODAY,
      HORIZON,
    )
    expect(list).toEqual([])
  })

  it('aggregates the same ingredient across multiple planned cooks', () => {
    const list = buildShoppingList(
      [cook(TODAY, 'r1'), cook('2030-01-09', 'r1')],
      [recipe('r1', [{ ingredientId: 'egg', quantity: 2 }])],
      [inv('egg', 'tracked', 3)],
      TODAY,
      HORIZON,
    )
    // 2 + 2 = 4 needed, 3 on hand → buy 1.
    expect(list[0]).toMatchObject({ ingredientId: 'egg', needed: 4, have: 3, buy: 1 })
  })

  it('resolves Ad-hoc slot ingredients from the slot lines', () => {
    const list = buildShoppingList(
      [cook(TODAY, null, 'adhoc', [{ ingredientId: 'bread', quantity: 4 }])],
      [],
      [inv('bread', 'tracked', 1)],
      TODAY,
      HORIZON,
    )
    expect(list[0]).toMatchObject({ ingredientId: 'bread', needed: 4, have: 1, buy: 3 })
  })

  it('excludes cooks before today and beyond the plannable horizon', () => {
    const list = buildShoppingList(
      [
        cook('2030-01-07', 'r1'), // yesterday — past
        cook(TODAY, 'r1'),
        cook('2030-02-04', 'r1'), // beyond next week
      ],
      [recipe('r1', [{ ingredientId: 'egg', quantity: 2 }])],
      [],
      TODAY,
      HORIZON,
    )
    // Only TODAY's cook counts → needed 2.
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({ ingredientId: 'egg', needed: 2 })
  })
})
