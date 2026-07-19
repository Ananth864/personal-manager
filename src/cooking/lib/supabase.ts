import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export function isSupabaseConfigured(): boolean {
  return Boolean(url && anonKey)
}

function requireUrl(): string {
  if (!url) {
    throw new Error(
      'VITE_SUPABASE_URL is not set. Add your Supabase project URL to .env.local.',
    )
  }
  return url
}

function requireAnonKey(): string {
  if (!anonKey) {
    throw new Error(
      'VITE_SUPABASE_ANON_KEY is not set. Add your Supabase anon key to .env.local.',
    )
  }
  return anonKey
}

/**
 * Per-request Cooking client bound to the user's Clerk session token.
 *
 * T02+ calls this from server functions, passing the token returned by
 * `auth().getToken()` (from `@clerk/tanstack-react-start/server`). Supabase
 * verifies the Clerk-issued JWT and exposes the user id as `auth.uid()` in
 * Row-Level Security policies — so every query is scoped to the user
 * regardless of how it is issued. See `supabase/README.md`.
 */
export function createCookingClient(token: string | null): SupabaseClient {
  return createClient(requireUrl(), requireAnonKey(), {
    global: {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    },
  })
}
