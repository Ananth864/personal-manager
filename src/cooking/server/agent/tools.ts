import { z } from 'zod'
import type { InventoryRepo } from '../inventory/repo'
import type { RecipeRepo, CreateRecipeInput } from '../recipes/repo'
import type { ScheduleRepo } from '../schedule/repo'
import type { FoodBankRepo } from '../food-bank/repo'
import type { Week } from '../schedule/types'
import {
  addIngredient,
  listInventory,
  restockIngredient,
  setIngredientState,
} from '../inventory/service'
import { createRecipe, listRecipes } from '../recipes/service'
import {
  assignAdhoc,
  assignFoodBank,
  assignRecipe,
  clearSlot,
  markNoCook,
} from '../schedule/service'
import { foodBankSummaryFor } from '../food-bank/service'
import { assignmentLabel, loadAgentWeek } from './snapshot'
import { addDays, mondayOfWeek, todayISO } from '../../schedule/date-utils'

/** A compact, JSON-serializable view of an Inventory item for tool results. */
function toItemView(item: {
  ingredient: { id: string; name: string; unit: string }
  state: string
  quantity: number | null
}) {
  return {
    id: item.ingredient.id,
    name: item.ingredient.name,
    unit: item.ingredient.unit,
    state: item.state,
    quantity: item.quantity,
  }
}

/** The repos an agent turn runs against (all Clerk-token-scoped, RLS-enforced). */
export interface AgentToolDeps {
  inventory: InventoryRepo
  schedule: ScheduleRepo
  recipes: RecipeRepo
  foodBank: FoodBankRepo
}

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be a yyyy-mm-dd ISO date.')
const mealSchema = z.enum(['lunch', 'dinner'])

/** A compact day summary for query_schedule / query_past_weeks results. */
function summarizeWeek(week: Week) {
  return {
    weekStart: week.weekStart,
    readonly: week.readonly,
    days: week.days.map((d) => ({
      date: d.date,
      lunch: d.lunch.assignment ? assignmentLabel(d.lunch.assignment) : null,
      dinner: d.dinner.assignment ? assignmentLabel(d.dinner.assignment) : null,
    })),
  }
}

async function loadWeek(deps: AgentToolDeps, weekStart: string) {
  const { week } = await loadAgentWeek(deps, weekStart)
  return week
}

/**
 * The agent's twelve domain tools (ADR-0007) — thin wrappers over the same
 * service-layer logic the UI uses, so the agent never touches the DB directly
 * and RLS scopes every read/write to the user. The capability boundary from
 * ADR-0003 is enforced structurally: notably absent are `trigger_cook`,
 * `update_recipe`/`delete_recipe`, and any DB/SQL surface. A structural test
 * guards that absence.
 *
 * Reads (query_*) return compact, JSON-shaped views. Writes (assign/clear/add/
 * restock/set_state) execute directly on instruction (ADR-0003 — no proposal
 * gate) and return the resulting state for the model to confirm.
 */
export function createAgentTools(deps: AgentToolDeps) {
  return {
    // ── Inventory (T08) ────────────────────────────────────────────────────
    query_inventory: {
      description:
        "List every ingredient in the user's inventory with its id, name, unit, state (endless/tracked/unavailable), and quantity. Call this to see what the user has before updating it.",
      inputSchema: z.object({}),
      execute: async () => {
        const items = await listInventory(deps.inventory)
        return { inventory: items.map(toItemView) }
      },
    },

    restock_ingredient: {
      description:
        "Add to an ingredient's quantity (additive). Use when the user reports buying or obtaining more of something, e.g. \"I bought 6 eggs\". Requires the ingredient id (from query_inventory) and a positive quantity.",
      inputSchema: z.object({
        ingredientId: z.string().min(1),
        quantity: z.number().positive(),
      }),
      execute: async ({ ingredientId, quantity }: { ingredientId: string; quantity: number }) => {
        const item = await restockIngredient(deps.inventory, ingredientId, quantity)
        return { ingredient: toItemView(item) }
      },
    },

    set_ingredient_state: {
      description:
        'Set an ingredient to a new state: "endless" (a staple, stop tracking quantity), "tracked" (available with a positive quantity — provide it), or "unavailable" (no longer available, e.g. "we finished the milk"). Requires the ingredient id.',
      inputSchema: z.object({
        ingredientId: z.string().min(1),
        state: z.enum(['endless', 'tracked', 'unavailable']),
        quantity: z.number().positive().optional(),
      }),
      execute: async ({
        ingredientId,
        state,
        quantity,
      }: {
        ingredientId: string
        state: 'endless' | 'tracked' | 'unavailable'
        quantity?: number
      }) => {
        const item = await setIngredientState(deps.inventory, ingredientId, state, { quantity })
        return { ingredient: toItemView(item) }
      },
    },

    // ── Schedule ───────────────────────────────────────────────────────────
    assign_slot: {
      description:
        'Assign a Meal Slot (a date + lunch/dinner) one of four ways: a catalog recipe, an ad-hoc recipe, a Food Bank portion withdrawal, or No Cook. Past weeks are read-only. For "plan my week", call this for each slot you want to fill. Ingredient availability does not limit assignment.',
      inputSchema: z.discriminatedUnion('type', [
        z.object({
          type: z.literal('recipe'),
          date: dateSchema,
          meal: mealSchema,
          recipeId: z.string().min(1),
        }),
        z.object({
          type: z.literal('adhoc'),
          date: dateSchema,
          meal: mealSchema,
          name: z.string().optional(),
          servings: z.number().int().min(1).optional(),
          ingredients: z
            .array(
              z.object({ ingredientId: z.string().min(1), quantity: z.number().positive() }),
            )
            .min(1),
        }),
        z.object({
          type: z.literal('food_bank'),
          date: dateSchema,
          meal: mealSchema,
          recipeId: z.string().nullable(),
        }),
        z.object({
          type: z.literal('no_cook'),
          date: dateSchema,
          meal: mealSchema,
        }),
      ]),
      execute: async (input: AssignSlotInput) => {
        switch (input.type) {
          case 'recipe':
            await assignRecipe(deps.schedule, input.date, input.meal, input.recipeId)
            break
          case 'adhoc':
            await assignAdhoc(deps.schedule, input.date, input.meal, {
              name: input.name,
              servings: input.servings ?? null,
              ingredients: input.ingredients,
            })
            break
          case 'food_bank':
            await assignFoodBank(
              deps.schedule,
              deps.foodBank,
              deps.recipes,
              input.date,
              input.meal,
              input.recipeId,
            )
            break
          case 'no_cook':
            await markNoCook(deps.schedule, input.date, input.meal)
            break
        }
        return { assigned: input.type, date: input.date, meal: input.meal }
      },
    },

    clear_slot: {
      description:
        'Clear a Meal Slot (leave it unplanned). Releases any Food Bank reservation it held. Past weeks are read-only.',
      inputSchema: z.object({ date: dateSchema, meal: mealSchema }),
      execute: async ({ date, meal }: { date: string; meal: 'lunch' | 'dinner' }) => {
        await clearSlot(deps.schedule, date, meal)
        return { cleared: true, date, meal }
      },
    },

    query_schedule: {
      description:
        "Read the current Week's Schedule: each day's lunch and dinner assignment (or null). Use this to see what's planned before suggesting changes.",
      inputSchema: z.object({}),
      execute: async () => {
        const week = await loadWeek(deps, mondayOfWeek(todayISO()))
        return { week: summarizeWeek(week) }
      },
    },

    query_past_weeks: {
      description:
        'Read recent past Weeks (read-only archives) for planning context — what the user cooked/ate recently. Returns the last several weeks of assignments.',
      inputSchema: z.object({ weeks: z.number().int().min(1).max(8).optional() }),
      execute: async ({ weeks = 4 }: { weeks?: number }) => {
        const current = mondayOfWeek(todayISO())
        const out = []
        for (let i = weeks; i >= 1; i--) {
          const weekStart = addDays(current, -7 * i)
          out.push(summarizeWeek(await loadWeek(deps, weekStart)))
        }
        return { weeks: out }
      },
    },

    // ── Catalog ────────────────────────────────────────────────────────────
    add_recipe: {
      description:
        'Add a new Recipe to the catalog (the agent cannot edit or delete recipes). Requires a name, servings, and at least one ingredient line (ingredient id + quantity). Use query_ingredients to find valid ingredient ids.',
      inputSchema: z.object({
        name: z.string().min(1),
        servings: z.number().int().min(1),
        notes: z.string().nullable().optional(),
        ingredients: z
          .array(
            z.object({ ingredientId: z.string().min(1), quantity: z.number().positive() }),
          )
          .min(1),
      }),
      execute: async (input: CreateRecipeInput) => {
        const recipe = await createRecipe(deps.recipes, input)
        return {
          recipe: {
            id: recipe.id,
            name: recipe.name,
            servings: recipe.servings,
            ingredients: recipe.ingredients.map((i) => ({
              ingredientId: i.ingredient.id,
              name: i.ingredient.name,
              quantity: i.quantity,
            })),
          },
        }
      },
    },

    add_ingredient: {
      description:
        'Add a new Ingredient to the catalog (and Inventory). Use when the user names something that is not yet tracked. Requires a name, a canonical unit (piece/g/kg/ml/L), and an initial state (endless, or tracked with a quantity).',
      inputSchema: z.object({
        name: z.string().min(1),
        unit: z.enum(['piece', 'g', 'kg', 'ml', 'L']),
        state: z.enum(['endless', 'tracked', 'unavailable']),
        quantity: z.number().positive().optional(),
      }),
      execute: async (input: {
        name: string
        unit: 'piece' | 'g' | 'kg' | 'ml' | 'L'
        state: 'endless' | 'tracked' | 'unavailable'
        quantity?: number
      }) => {
        const item = await addIngredient(deps.inventory, {
          name: input.name,
          unit: input.unit,
          state: input.state,
          quantity: input.quantity ?? null,
        })
        return { ingredient: toItemView(item) }
      },
    },

    // ── Queries ────────────────────────────────────────────────────────────
    query_recipes: {
      description:
        "List the user's saved Recipes with ids, names, servings, and ingredient lines. Use this to find recipe ids for assign_slot (recipe) and to see what's cookable.",
      inputSchema: z.object({}),
      execute: async () => {
        const recipes = await listRecipes(deps.recipes)
        return {
          recipes: recipes.map((r) => ({
            id: r.id,
            name: r.name,
            servings: r.servings,
            ingredients: r.ingredients.map((i) => ({
              ingredientId: i.ingredient.id,
              name: i.ingredient.name,
              quantity: i.quantity,
              unit: i.ingredient.unit,
            })),
          })),
        }
      },
    },

    query_ingredients: {
      description:
        'List the ingredient catalog (ids, names, units) — the pickable ingredients. Use this to resolve names to ids before adding a recipe or restocking.',
      inputSchema: z.object({}),
      execute: async () => {
        const items = await listInventory(deps.inventory)
        return {
          ingredients: items.map((i) => ({
            id: i.ingredient.id,
            name: i.ingredient.name,
            unit: i.ingredient.unit,
          })),
        }
      },
    },

    query_food_bank: {
      description:
        'Read Food Bank availability: prepared portions per recipe (produced, planned from upcoming cooks, reserved, and how many are available/discardable). Use this to suggest eating from the Food Bank.',
      inputSchema: z.object({}),
      execute: async () => {
        const summary = await foodBankSummaryFor(deps.foodBank, deps.schedule, deps.recipes)
        return { foodBank: summary }
      },
    },
  }
}

/** The discriminated-union input shape for assign_slot (kept flat for the SDK). */
type AssignSlotInput =
  | { type: 'recipe'; date: string; meal: 'lunch' | 'dinner'; recipeId: string }
  | {
      type: 'adhoc'
      date: string
      meal: 'lunch' | 'dinner'
      name?: string
      servings?: number
      ingredients: { ingredientId: string; quantity: number }[]
    }
  | { type: 'food_bank'; date: string; meal: 'lunch' | 'dinner'; recipeId: string | null }
  | { type: 'no_cook'; date: string; meal: 'lunch' | 'dinner' }
