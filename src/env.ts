import { createEnv } from '@t3-oss/env-core'
import { z } from 'zod'

export const env = createEnv({
  server: {
    SERVER_URL: z.string().url().optional(),
    // Clerk secret key — read server-side by clerkMiddleware. Required for auth().
    CLERK_SECRET_KEY: z.string().min(1),
    // xAI — server-only (no VITE_ prefix). The agent route handler reads it.
    XAI_API_KEY: z.string().min(1),
    // Model is a config swap (ADR-0007); defaults to the spec'd model if unset.
    XAI_MODEL: z.string().min(1).optional(),
  },

  clientPrefix: 'VITE_',

  client: {
    VITE_APP_TITLE: z.string().min(1).optional(),
    VITE_CLERK_PUBLISHABLE_KEY: z.string().min(1),
    // Supabase is optional in v1's skeleton ticket; required once Inventory (T02) lands.
    VITE_SUPABASE_URL: z.string().url().optional(),
    VITE_SUPABASE_ANON_KEY: z.string().min(1).optional(),
  },

  // Server-only vars (CLERK_SECRET_KEY, OPENAI_API_KEY, ...) are loaded into
  // process.env by vite.config.ts (Vite only surfaces VITE_-prefixed vars via
  // import.meta.env). Merge both so t3-env sees every key on the server.
  runtimeEnv: {
    ...process.env,
    ...import.meta.env,
  },

  emptyStringAsUndefined: true,
})
