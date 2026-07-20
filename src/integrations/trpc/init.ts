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

/**
 * Name of the Clerk JWT template that signs tokens Supabase will accept.
 * Must match the template you create in Clerk (see supabase/README.md).
 */
const SUPABASE_JWT_TEMPLATE = 'supabase'

export async function createContext(): Promise<Context> {
  const session = await auth()
  // Request the Supabase-template token specifically — the default session
  // token is signed by Clerk and would be rejected by Supabase. The template
  // signs with Supabase's JWT secret so auth.uid() resolves to the Clerk user id.
  const token = session.userId
    ? await session.getToken({ template: SUPABASE_JWT_TEMPLATE })
    : null
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
