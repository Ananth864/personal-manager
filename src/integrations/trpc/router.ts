import { createTRPCRouter, publicProcedure } from './init'

// The Cooking context's UI-facing procedures are added here in later tickets
// (Inventory, Recipes, Schedule, etc.). They wrap the service layer in
// `src/cooking/server/` so domain rules live in one place, shared with the
// agent tools. Kept empty in the skeleton ticket.
export const trpcRouter = createTRPCRouter({
  health: publicProcedure.query(() => ({ ok: true })),
})
export type TRPCRouter = typeof trpcRouter
