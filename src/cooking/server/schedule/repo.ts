import { addDays } from '../../schedule/date-utils'
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
  private nextId = 1

  private key(slotDate: string, meal: MealPosition): string {
    return `${slotDate}_${meal}`
  }

  async listSlots(weekStart: string): Promise<SlotRow[]> {
    return [...this.slots.values()]
      .filter((s) => s.slotDate >= weekStart && s.slotDate < addDays(weekStart, 7))
      .sort((a, b) =>
        a.slotDate === b.slotDate
          ? a.meal.localeCompare(b.meal)
          : a.slotDate.localeCompare(b.slotDate),
      )
  }

  async upsertSlot(input: UpsertSlotInput): Promise<void> {
    const existing = this.slots.get(this.key(input.slotDate, input.meal))
    const row: SlotRow = {
      id: existing?.id ?? `slot_${this.nextId++}`,
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
