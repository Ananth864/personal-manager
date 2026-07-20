import { describe, expect, it } from 'vitest'
import { computeAvailability } from './availability'
import type { InventoryItem } from '../inventory/types'
import type { RecipeIngredient } from './types'

let idSeq = 0
function inv(
  name: string,
  state: InventoryItem['state'],
  quantity: number | null,
) {
  const id = `ing_${++idSeq}`
  return {
    item: {
      ingredient: { id, name, unit: 'g' as const, createdAt: new Date() },
      state,
      quantity,
      updatedAt: new Date(),
    } satisfies InventoryItem,
    id,
  }
}

function line(item: { id: string }, quantity: number): RecipeIngredient {
  return {
    ingredient: {
      id: item.id,
      name: 'whatever',
      unit: 'g',
      createdAt: new Date(),
    },
    quantity,
  }
}

describe('computeAvailability', () => {
  it('is ok when every required ingredient is available', () => {
    const a = inv('Egg', 'tracked', 6)
    const b = inv('Salt', 'endless', null)
    const ingredients = [line(a, 2), line(b, 5)]

    expect(computeAvailability(ingredients, [a.item, b.item])).toEqual({
      ok: true,
      missingCount: 0,
    })
  })

  it('counts an Unavailable ingredient as missing', () => {
    const a = inv('Egg', 'tracked', 6)
    const b = inv('Milk', 'unavailable', 0)
    const ingredients = [line(a, 2), line(b, 250)]

    expect(computeAvailability(ingredients, [a.item, b.item])).toEqual({
      ok: false,
      missingCount: 1,
    })
  })

  it('counts a Tracked ingredient with insufficient quantity as missing', () => {
    const a = inv('Egg', 'tracked', 2)
    const ingredients = [line(a, 4)]

    expect(computeAvailability(ingredients, [a.item])).toEqual({
      ok: false,
      missingCount: 1,
    })
  })

  it('treats an Endless ingredient as always available regardless of required quantity', () => {
    const salt = inv('Salt', 'endless', null)
    const ingredients = [line(salt, 9999)]

    expect(computeAvailability(ingredients, [salt.item])).toEqual({
      ok: true,
      missingCount: 0,
    })
  })

  it('counts a required ingredient that is not in inventory at all as missing', () => {
    const a = inv('Egg', 'tracked', 6)
    const orphan = line({ id: 'ing_orphan' }, 2)

    expect(computeAvailability([line(a, 2), orphan], [a.item])).toEqual({
      ok: false,
      missingCount: 1,
    })
  })

  it('sums multiple missing ingredients', () => {
    const a = inv('Egg', 'tracked', 1)
    const b = inv('Milk', 'unavailable', 0)
    const c = inv('Flour', 'tracked', 50)
    const ingredients = [line(a, 3), line(b, 200), line(c, 100)]

    expect(computeAvailability(ingredients, [a.item, b.item, c.item])).toEqual({
      ok: false,
      missingCount: 3,
    })
  })

  it('treats an exactly-sufficient Tracked ingredient as available', () => {
    const a = inv('Egg', 'tracked', 4)
    const ingredients = [line(a, 4)]

    expect(computeAvailability(ingredients, [a.item]).ok).toBe(true)
  })

  it('is vacuously ok for a recipe with no ingredients', () => {
    expect(computeAvailability([], [])).toEqual({ ok: true, missingCount: 0 })
  })
})
