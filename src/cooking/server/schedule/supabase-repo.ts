import { createCookingClient } from '#/cooking/lib/supabase'
import { addDays } from '../../schedule/date-utils'
import type { ScheduleRepo } from './repo'
import type {
  AdhocIngredient,
  AssignmentType,
  MealPosition,
  SlotRow,
  UpsertSlotInput,
} from './types'

/** Raw PostgREST row (snake_case columns). */
interface RawRow {
  id: string
  slot_date: string
  meal: MealPosition
  assignment_type: AssignmentType
  recipe_id: string | null
  adhoc_name: string | null
  adhoc_ingredients: AdhocIngredient[] | null
  adhoc_servings: number | null
  cooked: boolean
}

function toSlotRow(r: RawRow): SlotRow {
  return {
    id: r.id,
    slotDate: r.slot_date,
    meal: r.meal,
    assignmentType: r.assignment_type,
    recipeId: r.recipe_id,
    adhocName: r.adhoc_name,
    adhocIngredients: r.adhoc_ingredients,
    adhocServings: r.adhoc_servings,
    cooked: r.cooked,
  }
}

function rowFromInput(input: UpsertSlotInput) {
  return {
    slot_date: input.slotDate,
    meal: input.meal,
    assignment_type: input.assignmentType,
    recipe_id: input.recipeId ?? null,
    adhoc_name: input.adhocName ?? null,
    adhoc_ingredients: input.adhocIngredients ?? null,
    adhoc_servings: input.adhocServings ?? null,
  }
}

/**
 * Production ScheduleRepo backed by Supabase. RLS (user_id = auth.jwt()->>'sub')
 * scopes every query; user_id is never sent (column default derives it).
 * Upserts target the (user_id, slot_date, meal) unique constraint.
 */
export class SupabaseScheduleRepo implements ScheduleRepo {
  private readonly client

  constructor(token: string) {
    this.client = createCookingClient(token)
  }

  async listSlots(weekStart: string): Promise<SlotRow[]> {
    const end = addDays(weekStart, 6)
    const { data, error } = await this.client
      .from('cooking_meal_slots')
      .select(
        'id, slot_date, meal, assignment_type, recipe_id, adhoc_name, adhoc_ingredients, adhoc_servings, cooked',
      )
      .gte('slot_date', weekStart)
      .lte('slot_date', end)
      .order('slot_date')
      .order('meal')
    if (error) {
      throw new Error(`Failed to list schedule: ${error.message}`)
    }
    return (data as RawRow[]).map(toSlotRow)
  }

  async getSlot(slotDate: string, meal: MealPosition): Promise<SlotRow | null> {
    const { data, error } = await this.client
      .from('cooking_meal_slots')
      .select(
        'id, slot_date, meal, assignment_type, recipe_id, adhoc_name, adhoc_ingredients, adhoc_servings, cooked',
      )
      .eq('slot_date', slotDate)
      .eq('meal', meal)
      .maybeSingle()
    if (error) {
      throw new Error(`Failed to get slot: ${error.message}`)
    }
    return data ? toSlotRow(data) : null
  }

  async listFoodBankSlots(): Promise<{ recipeId: string | null; slotDate: string }[]> {
    const { data, error } = await this.client
      .from('cooking_meal_slots')
      .select('recipe_id, slot_date')
      .eq('assignment_type', 'foodbank')
    if (error) {
      throw new Error(`Failed to read Food Bank reservations: ${error.message}`)
    }
    return (data as { recipe_id: string | null; slot_date: string }[]).map((r) => ({
      recipeId: r.recipe_id,
      slotDate: r.slot_date,
    }))
  }

  async upsertSlot(input: UpsertSlotInput): Promise<void> {
    const { error } = await this.client
      .from('cooking_meal_slots')
      .upsert(rowFromInput(input), { onConflict: 'user_id,slot_date,meal' })
    if (error) {
      throw new Error(`Failed to save slot: ${error.message}`)
    }
  }

  async clearSlot(slotDate: string, meal: MealPosition): Promise<void> {
    const { error } = await this.client
      .from('cooking_meal_slots')
      .delete()
      .eq('slot_date', slotDate)
      .eq('meal', meal)
    if (error) {
      throw new Error(`Failed to clear slot: ${error.message}`)
    }
  }

  async claimForCook(slotDate: string, meal: MealPosition): Promise<boolean> {
    // Atomic conditional update: only flips cooked if it was false. If 0 rows
    // match (already cooked, or missing), nothing changed and we return false.
    const { data, error } = await this.client
      .from('cooking_meal_slots')
      .update({ cooked: true })
      .eq('slot_date', slotDate)
      .eq('meal', meal)
      .eq('cooked', false)
      .select('id')
    if (error) {
      throw new Error(`Failed to claim slot for cooking: ${error.message}`)
    }
    return data.length > 0
  }
}
