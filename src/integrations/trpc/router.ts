import { z } from 'zod'

import { createTRPCRouter, protectedProcedure } from './init'
import { SupabaseInventoryRepo } from '#/cooking/server/inventory/supabase-repo'
import {
  addIngredient,
  listInventory,
  restockIngredient,
  setIngredientState,
} from '#/cooking/server/inventory/service'
import type { Context } from './init'

const stateSchema = z.enum(['endless', 'tracked', 'unavailable'])

function repoFor(ctx: Context) {
  return new SupabaseInventoryRepo(ctx.token!)
}

export const trpcRouter = createTRPCRouter({
  inventory: createTRPCRouter({
    list: protectedProcedure.query(({ ctx }) =>
      listInventory(repoFor(ctx)),
    ),

    add: protectedProcedure
      .input(
        z.object({
          name: z.string().min(1),
          unit: z.string().min(1),
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
})
export type TRPCRouter = typeof trpcRouter
