import { createEnv } from '@t3-oss/env-core'
import { z } from 'zod'

export const env = createEnv({
  server: {
    SERVER_URL: z.string().url().optional(),
    // Clerk secret key — read server-side by clerkMiddleware. Required for auth().
    CLERK_SECRET_KEY: z.string().min(1),
  },

  clientPrefix: 'VITE_',

  client: {
    VITE_APP_TITLE: z.string().min(1).optional(),
    VITE_CLERK_PUBLISHABLE_KEY: z.string().min(1),
    // Supabase is optional in v1's skeleton ticket; required once Inventory (T02) lands.
    VITE_SUPABASE_URL: z.string().url().optional(),
    VITE_SUPABASE_ANON_KEY: z.string().min(1).optional(),
  },

  runtimeEnv: import.meta.env,

  emptyStringAsUndefined: true,
})
