import { describe, expect, it } from 'vitest'
import {
  availableFor,
  buildFoodBankSummary,
  computePlannedProductions,
} from './availability'
import type { PlannedCook, ProducedPortion, Reservation } from './availability'

describe('food bank availability', () => {
  describe('availableFor', () => {
    it('is produced + planned − reservations', () => {
      expect(availableFor(4, 0, 1)).toBe(3)
      expect(availableFor(4, 2, 1)).toBe(5)
      expect(availableFor(0, 3, 1)).toBe(2)
    })

    it('goes negative when over-reserved (caller treats <=0 as none)', () => {
      expect(availableFor(2, 0, 5)).toBe(-3)
    })
  })

  describe('computePlannedProductions', () => {
    const servingsFor = (id: string) => (id === 'r1' ? 4 : id === 'r2' ? 1 : undefined)
    const weekStart = '2030-01-07' // a Monday
    const horizonEnd = '2030-01-21' // current + next week (exclusive)

    it('projects servings − 1 for each planned cook in the plannable horizon', () => {
      const cooks: PlannedCook[] = [
        { recipeId: 'r1', slotDate: '2030-01-08', assignmentType: 'recipe', adhocServings: null },
      ]
      expect(computePlannedProductions(cooks, servingsFor, weekStart, horizonEnd)).toEqual([
        { recipeId: 'r1', portions: 3 },
      ])
    })

    it('skips past-week, beyond-horizon, and single-serving (zero-remaining) cooks', () => {
      const cooks: PlannedCook[] = [
        { recipeId: 'r1', slotDate: '2019-01-01', assignmentType: 'recipe', adhocServings: null }, // past
        { recipeId: 'r1', slotDate: '2030-02-04', assignmentType: 'recipe', adhocServings: null }, // beyond next week
        { recipeId: 'r2', slotDate: '2030-01-09', assignmentType: 'recipe', adhocServings: null }, // servings 1 -> 0
      ]
      expect(computePlannedProductions(cooks, servingsFor, weekStart, horizonEnd)).toEqual([])
    })

    it('projects the ad-hoc pool from ad-hoc servings', () => {
      const cooks: PlannedCook[] = [
        { recipeId: null, slotDate: '2030-01-08', assignmentType: 'adhoc', adhocServings: 3 },
      ]
      expect(computePlannedProductions(cooks, servingsFor, weekStart, horizonEnd)).toEqual([
        { recipeId: null, portions: 2 },
      ])
    })
  })

  describe('buildFoodBankSummary', () => {
    const nameFor = (id: string | null) => (id === 'r1' ? 'Chili' : id === 'r2' ? 'Soup' : 'Ad-hoc')

    it('reduces availability when a portion is reserved', () => {
      const produced: ProducedPortion[] = [{ recipeId: 'r1', portions: 4 }]
      const reservations: Reservation[] = [{ recipeId: 'r1', slotDate: '2030-01-02' }]
      const summary = buildFoodBankSummary(produced, [], reservations, nameFor)
      expect(summary).toContainEqual({
        recipeId: 'r1',
        recipeName: 'Chili',
        produced: 4,
        planned: 0,
        available: 3,
      })
    })

    it('releases availability when the reservation is cleared', () => {
      const produced: ProducedPortion[] = [{ recipeId: 'r1', portions: 4 }]
      const summary = buildFoodBankSummary(produced, [], [], nameFor)
      expect(summary[0].available).toBe(4)
    })

    it('archive locks: a past-week reservation still counts against availability', () => {
      const produced: ProducedPortion[] = [{ recipeId: 'r1', portions: 4 }]
      const reservations: Reservation[] = [{ recipeId: 'r1', slotDate: '2020-01-01' }]
      const summary = buildFoodBankSummary(produced, [], reservations, nameFor)
      expect(summary[0].available).toBe(3)
    })

    it('commingles portions across multiple cooks of the same recipe', () => {
      const produced: ProducedPortion[] = [
        { recipeId: 'r1', portions: 5 },
        { recipeId: 'r1', portions: 5 },
      ]
      const reservations: Reservation[] = [
        { recipeId: 'r1', slotDate: '2030-01-02' },
        { recipeId: 'r1', slotDate: '2030-01-03' },
      ]
      const summary = buildFoodBankSummary(produced, [], reservations, nameFor)
      expect(summary[0]).toMatchObject({ recipeName: 'Chili', produced: 10, available: 8 })
    })

    it('lets a planned cook make its future portions reservable (the agent case)', () => {
      // Nothing cooked yet (produced 0), but a planned Chili cook (4 servings)
      // projects 3 portions — so 2 can be reserved and 1 still shows available.
      const planned: ProducedPortion[] = [{ recipeId: 'r1', portions: 3 }]
      const reservations: Reservation[] = [
        { recipeId: 'r1', slotDate: '2030-01-03' },
        { recipeId: 'r1', slotDate: '2030-01-04' },
      ]
      const summary = buildFoodBankSummary([], planned, reservations, nameFor)
      expect(summary[0]).toMatchObject({ produced: 0, planned: 3, available: 1 })
    })

    it('does not double-count when a planned cook becomes a real cook', () => {
      // The cook fired: produced 3, and the slot is no longer "planned", so
      // planned drops to 0. Same reservations -> same availability.
      const reservations: Reservation[] = [{ recipeId: 'r1', slotDate: '2030-01-03' }]
      const before = buildFoodBankSummary([], [{ recipeId: 'r1', portions: 3 }], reservations, nameFor)
      const after = buildFoodBankSummary([{ recipeId: 'r1', portions: 3 }], [], reservations, nameFor)
      expect(before[0].available).toBe(2)
      expect(after[0].available).toBe(2)
    })

    it('tracks the ad-hoc pool (null recipe id) alongside catalog recipes', () => {
      const produced: ProducedPortion[] = [
        { recipeId: 'r1', portions: 2 },
        { recipeId: null, portions: 3 },
      ]
      const reservations: Reservation[] = [{ recipeId: null, slotDate: '2030-01-02' }]
      const summary = buildFoodBankSummary(produced, [], reservations, nameFor)
      const byName = new Map(summary.map((e) => [e.recipeName, e]))
      expect(byName.get('Chili')?.available).toBe(2)
      expect(byName.get('Ad-hoc')?.available).toBe(2)
    })
  })
})
