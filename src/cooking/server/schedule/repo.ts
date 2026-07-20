import type {
  MealPosition,
  SlotRow,
  UpsertSlotInput,
} from './types'

/**
 * The persistence seam for the Schedule service. The service layer depends on
 * this interface (not on Supabase) so the domain rules — especially the
 * "Schedule mutations never touch Inventory" invariant (ADR-0001) — can be
 * tested in-memory. The Schedule repo deliberately has no Inventory dependency.
 */
export interface ScheduleRepo {
  /** All assigned slots in the week [weekStart, weekStart+6]. */
  listSlots: (weekStart: string) => Promise<SlotRow[]>
  upsertSlot: (input: UpsertSlotInput) => Promise<void>
  clearSlot: (slotDate: string, meal: MealPosition) => Promise<void>
}

/** In-memory implementation used by the service-layer tests. */
export class InMemoryScheduleRepo implements ScheduleRepo {
  private readonly slots = new Map<string, SlotRow>()

  private key(slotDate: string, meal: MealPosition): string {
    return `${slotDate}_${meal}`
  }

  async listSlots(weekStart: string): Promise<SlotRow[]> {
    const start = weekStart
    return [...this.slots.values()]
      .filter((s) => s.slotDate >= start && s.slotDate < addDaysISO(start, 7))
      .sort((a, b) =>
        a.slotDate === b.slotDate
          ? a.meal.localeCompare(b.meal)
          : a.slotDate.localeCompare(b.slotDate),
      )
  }

  async upsertSlot(input: UpsertSlotInput): Promise<void> {
    const row: SlotRow = {
      id: this.slots.get(this.key(input.slotDate, input.meal))?.id ?? cryptoId(),
      slotDate: input.slotDate,
      meal: input.meal,
      assignmentType: input.assignmentType,
      recipeId: input.recipeId ?? null,
      adhocName: input.adhocName ?? null,
      adhocIngredients: input.adhocIngredients ?? null,
    }
    this.slots.set(this.key(input.slotDate, input.meal), row)
  }

  async clearSlot(slotDate: string, meal: MealPosition): Promise<void> {
    this.slots.delete(this.key(slotDate, meal))
  }
}

// Minimal helpers kept local so the in-memory repo has no cross-module import.
function addDaysISO(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d, 12))
  date.setUTCDate(date.getUTCDate() + n)
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
}

function cryptoId(): string {
  return `slot_${Math.random().toString(36).slice(2, 10)}`
}
