import { z } from 'zod'

import { createTRPCRouter, protectedProcedure } from './init'
import { SupabaseInventoryRepo } from '#/cooking/server/inventory/supabase-repo'
import {
  addIngredient,
  listInventory,
  restockIngredient,
  setIngredientState,
} from '#/cooking/server/inventory/service'
import { UNITS } from '#/cooking/server/inventory/types'
import { SupabaseRecipeRepo } from '#/cooking/server/recipes/supabase-repo'
import { computeAvailability } from '#/cooking/server/recipes/availability'
import {
  createRecipe,
  deleteRecipe,
  updateRecipe,
  withAvailability,
} from '#/cooking/server/recipes/service'
import { SupabaseScheduleRepo } from '#/cooking/server/schedule/supabase-repo'
import {
  assignAdhoc,
  assignRecipe,
  buildWeek,
  clearSlot,
  markNoCook,
} from '#/cooking/server/schedule/service'
import type { Context } from './init'

const stateSchema = z.enum(['endless', 'tracked', 'unavailable'])
const unitSchema = z.enum(UNITS)

function repoFor(ctx: Context) {
  return new SupabaseInventoryRepo(ctx.token!)
}

function recipeRepoFor(ctx: Context) {
  return new SupabaseRecipeRepo(ctx.token!)
}

function scheduleRepoFor(ctx: Context) {
  return new SupabaseScheduleRepo(ctx.token!)
}

/** Fetch the user's inventory snapshot, for availability badges. */
function inventoryFor(ctx: Context) {
  return new SupabaseInventoryRepo(ctx.token!).list()
}

const recipeLineSchema = z.object({
  ingredientId: z.string().min(1),
  quantity: z.number().positive(),
})
const recipeInputSchema = z.object({
  name: z.string().min(1),
  servings: z.number().int().min(1),
  notes: z.string().nullable(),
  ingredients: z.array(recipeLineSchema),
})

export const trpcRouter = createTRPCRouter({
  inventory: createTRPCRouter({
    list: protectedProcedure.query(({ ctx }) =>
      listInventory(repoFor(ctx)),
    ),

    add: protectedProcedure
      .input(
        z.object({
          name: z.string().min(1),
          unit: unitSchema,
          state: stateSchema,
          quantity: z.number().positive().nullable().optional(),
        }),
      )
      .mutation(({ ctx, input }) => addIngredient(repoFor(ctx), input)),

    restock: protectedProcedure
      .input(
        z.object({
          ingredientId: z.string(),
          quantity: z.number().positive(),
        }),
      )
      .mutation(({ ctx, input }) =>
        restockIngredient(repoFor(ctx), input.ingredientId, input.quantity),
      ),

    setState: protectedProcedure
      .input(
        z.object({
          ingredientId: z.string(),
          state: stateSchema,
          quantity: z.number().positive().optional(),
        }),
      )
      .mutation(({ ctx, input }) =>
        setIngredientState(repoFor(ctx), input.ingredientId, input.state, {
          quantity: input.quantity,
        }),
      ),
  }),

  recipes: createTRPCRouter({
    list: protectedProcedure.query(async ({ ctx }) => {
      const [inventory, recipes] = await Promise.all([
        inventoryFor(ctx),
        recipeRepoFor(ctx).list(),
      ])
      return withAvailability(recipes, inventory)
    }),

    get: protectedProcedure
      .input(z.object({ id: z.string() }))
      .query(async ({ ctx, input }) => {
        const [inventory, recipe] = await Promise.all([
          inventoryFor(ctx),
          recipeRepoFor(ctx).get(input.id),
        ])
        if (!recipe) return null
        return {
          ...recipe,
          availability: computeAvailability(
            recipe.ingredients.map((i) => ({
              ingredientId: i.ingredient.id,
              quantity: i.quantity,
            })),
            inventory,
          ),
        }
      }),

    create: protectedProcedure
      .input(recipeInputSchema)
      .mutation(({ ctx, input }) => createRecipe(recipeRepoFor(ctx), input)),

    update: protectedProcedure
      .input(z.object({ id: z.string() }).extend(recipeInputSchema.shape))
      .mutation(({ ctx, input }) =>
        updateRecipe(recipeRepoFor(ctx), input.id, input),
      ),

    delete: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(({ ctx, input }) => deleteRecipe(recipeRepoFor(ctx), input.id)),
  }),

  schedule: createTRPCRouter({
    getWeek: protectedProcedure
      .input(z.object({ weekStart: z.string() }))
      .query(async ({ ctx, input }) => {
        const [slots, inventory, recipes] = await Promise.all([
          scheduleRepoFor(ctx).listSlots(input.weekStart),
          inventoryFor(ctx),
          recipeRepoFor(ctx).list(),
        ])
        return buildWeek(input.weekStart, slots, recipes, inventory)
      }),

    assignRecipe: protectedProcedure
      .input(
        z.object({
          date: z.string(),
          meal: z.enum(['lunch', 'dinner']),
          recipeId: z.string().min(1),
        }),
      )
      .mutation(({ ctx, input }) =>
        assignRecipe(scheduleRepoFor(ctx), input.date, input.meal, input.recipeId),
      ),

    assignAdhoc: protectedProcedure
      .input(
        z.object({
          date: z.string(),
          meal: z.enum(['lunch', 'dinner']),
          name: z.string().nullable(),
          ingredients: z.array(recipeLineSchema),
        }),
      )
      .mutation(({ ctx, input }) =>
        assignAdhoc(scheduleRepoFor(ctx), input.date, input.meal, input),
      ),

    markNoCook: protectedProcedure
      .input(
        z.object({ date: z.string(), meal: z.enum(['lunch', 'dinner']) }),
      )
      .mutation(({ ctx, input }) =>
        markNoCook(scheduleRepoFor(ctx), input.date, input.meal),
      ),

    clearSlot: protectedProcedure
      .input(
        z.object({ date: z.string(), meal: z.enum(['lunch', 'dinner']) }),
      )
      .mutation(({ ctx, input }) =>
        clearSlot(scheduleRepoFor(ctx), input.date, input.meal),
      ),
  }),
})
export type TRPCRouter = typeof trpcRouter
