import { describe, expect, it } from 'vitest'
import {
  availableFor,
  buildFoodBankSummary,
} from './availability'
import type { ProducedPortion, Reservation } from './availability'

describe('food bank availability', () => {
  describe('availableFor', () => {
    it('is produced minus reservations', () => {
      expect(availableFor(4, 1)).toBe(3)
      expect(availableFor(4, 0)).toBe(4)
    })

    it('clamps conceptually at zero when over-reserved (caller treats <=0 as none)', () => {
      expect(availableFor(2, 5)).toBe(-3)
    })
  })

  describe('buildFoodBankSummary', () => {
    const nameFor = (id: string | null) => (id === 'r1' ? 'Chili' : id === 'r2' ? 'Soup' : 'Ad-hoc')

    it('reduces availability when a portion is reserved', () => {
      const produced: ProducedPortion[] = [{ recipeId: 'r1', portions: 4 }]
      const reservations: Reservation[] = [{ recipeId: 'r1', slotDate: '2030-01-02' }]
      const summary = buildFoodBankSummary(produced, reservations, nameFor)
      expect(summary).toContainEqual({
        recipeId: 'r1',
        recipeName: 'Chili',
        produced: 4,
        available: 3,
      })
    })

    it('releases availability when the reservation is cleared (no reservations left)', () => {
      const produced: ProducedPortion[] = [{ recipeId: 'r1', portions: 4 }]
      const summary = buildFoodBankSummary(produced, [], nameFor)
      expect(summary[0].available).toBe(4)
    })

    it('archive locks: a past-week reservation still counts against availability', () => {
      // The slot is in an archived week (any past date); it counts exactly like
      // an active one — only clearability differs (enforced elsewhere).
      const produced: ProducedPortion[] = [{ recipeId: 'r1', portions: 4 }]
      const reservations: Reservation[] = [{ recipeId: 'r1', slotDate: '2020-01-01' }]
      const summary = buildFoodBankSummary(produced, reservations, nameFor)
      expect(summary[0].available).toBe(3)
    })

    it('commingles portions across multiple cooks of the same recipe', () => {
      // Two cooks of Chili (4 + 4) accumulate; reserving 2 leaves 6.
      const produced: ProducedPortion[] = [
        { recipeId: 'r1', portions: 4 },
        { recipeId: 'r1', portions: 4 },
      ]
      const reservations: Reservation[] = [
        { recipeId: 'r1', slotDate: '2030-01-02' },
        { recipeId: 'r1', slotDate: '2030-01-03' },
      ]
      const summary = buildFoodBankSummary(produced, reservations, nameFor)
      expect(summary[0]).toMatchObject({ recipeName: 'Chili', produced: 8, available: 6 })
    })

    it('tracks the ad-hoc pool (null recipe id) alongside catalog recipes', () => {
      const produced: ProducedPortion[] = [
        { recipeId: 'r1', portions: 2 },
        { recipeId: null, portions: 3 },
      ]
      const reservations: Reservation[] = [{ recipeId: null, slotDate: '2030-01-02' }]
      const summary = buildFoodBankSummary(produced, reservations, nameFor)
      const byName = new Map(summary.map((e) => [e.recipeName, e]))
      expect(byName.get('Chili')?.available).toBe(2)
      expect(byName.get('Ad-hoc')?.available).toBe(2)
    })
  })
})
