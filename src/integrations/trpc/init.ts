import { initTRPC, TRPCError } from '@trpc/server'
import superjson from 'superjson'
import { auth } from '@clerk/tanstack-react-start/server'

/**
 * Per-request context. `auth()` resolves from clerkMiddleware's request
 * instrumentation; `getToken()` is the Clerk session token we forward to
 * Supabase so Row-Level Security scopes every query to this user (ADR 0005).
 */
export interface Context {
  userId: string | null
  token: string | null
}

export async function createContext(): Promise<Context> {
  const session = await auth()
  const token = session.userId ? await session.getToken() : null
  return { userId: session.userId, token }
}

const t = initTRPC.context<Context>().create({
  transformer: superjson,
})

export const createTRPCRouter = t.router
export const publicProcedure = t.procedure

/** Rejects unauthenticated requests; ctx.userId and ctx.token are non-null after. */
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.userId || !ctx.token) {
    throw new TRPCError({ code: 'UNAUTHORIZED' })
  }
  return next({
    ctx: { ...ctx, userId: ctx.userId, token: ctx.token },
  })
})
