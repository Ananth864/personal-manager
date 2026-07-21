/** The two meal positions in a day. */
export type MealPosition = 'lunch' | 'dinner'

/** What fills a Meal Slot. 'foodbank' is stubbed (lands in T06). */
export type AssignmentType = 'recipe' | 'adhoc' | 'foodbank' | 'nocook'

/** An ingredient line in an Ad-hoc Recipe (ingredient id + required quantity). */
export interface AdhocIngredient {
  ingredientId: string
  quantity: number
}

/**
 * A slot's assignment. Only the fields relevant to `type` are populated.
 * `null` (no assignment) is represented by the *absence* of a slot row, not by
 * a null Assignment.
 */
export interface SlotAssignment {
  type: AssignmentType
  /** 'recipe' */
  recipeId?: string
  recipeName?: string | null
  recipeServings?: number | null
  /** 'adhoc' */
  adhocName?: string | null
  adhocIngredients?: AdhocIngredient[]
}

/**
 * One cell of the Schedule. `shortfall` is the count of required ingredients
 * not currently available (the soft non-blocking flag); null when there is
 * nothing to check (unassigned / No Cook / Food Bank).
 */
export interface MealSlot {
  date: string
  meal: MealPosition
  assignment: SlotAssignment | null
  shortfall: number | null
  /** Has this slot's meal been cooked? (One Cook per slot.) */
  cooked: boolean
}

export interface DayPlan {
  date: string
  lunch: MealSlot
  dinner: MealSlot
}

export interface Week {
  weekStart: string
  days: DayPlan[]
  /** Whole week is in the past — read-only archive. */
  readonly: boolean
}

/** Raw persisted slot row (what the repo returns). */
export interface SlotRow {
  id: string
  slotDate: string
  meal: MealPosition
  assignmentType: AssignmentType
  recipeId: string | null
  adhocName: string | null
  adhocIngredients: AdhocIngredient[] | null
  /** Portions an ad-hoc Cook produces into the Food Bank (null otherwise). */
  adhocServings: number | null
  cooked: boolean
}

/** Payload for upserting a slot. */
export interface UpsertSlotInput {
  slotDate: string
  meal: MealPosition
  assignmentType: AssignmentType
  recipeId?: string | null
  adhocName?: string | null
  adhocIngredients?: AdhocIngredient[] | null
  adhocServings?: number | null
}
