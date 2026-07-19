import { createTRPCRouter } from './init'

// Cooking's UI-facing procedures are added here in later tickets (Inventory,
// Recipes, Schedule, …). Each wraps the service layer in `src/cooking/server/`
// so domain rules live in one place, shared with the agent tools. Kept empty
// in the skeleton ticket.
export const trpcRouter = createTRPCRouter({})
export type TRPCRouter = typeof trpcRouter
