# Supabase setup

This app uses Supabase (Postgres) as its data store. **Row-Level Security scopes every row to the authenticated Clerk user id** — the data-protection boundary (per the TanStack Start auth architecture: route guards are UX, RLS is security). Clerk and Supabase are integrated via a JWT template: Clerk issues a JWT that Supabase verifies, exposing the Clerk user id as `auth.uid()` in RLS policies.

## One-time setup

1. **Create a Supabase project** at https://supabase.com. Copy the Project URL and the `anon` public key into `.env.local`:

   ```
   VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
   VITE_SUPABASE_ANON_KEY=eyYOUR-ANON-KEY
   ```

2. **Create a Clerk JWT template** named `supabase` (Clerk dashboard → JWT Templates → New template → Supabase). This exposes the Clerk user id as `sub` in the token Supabase receives.

3. **Make Supabase trust Clerk tokens.** In Supabase, set the JWT secret / JWKS to Clerk's (Supabase dashboard → Authentication → JWT Settings), so Supabase verifies the Bearer token the app sends and resolves `auth.uid()` to the Clerk user id. (See Clerk's Supabase guide for the current exact field.)

## How queries are scoped

`src/cooking/lib/supabase.ts` exports `createCookingClient(token)` — a per-request client bound to the user's Clerk session token. Server functions (T02+) call `auth().getToken()` to get that token and pass it here. Every Supabase query then runs as that user, gated by RLS.

## RLS pattern (used by every `cooking_*` table)

Clerk user ids (`user_…`) are not UUIDs, so we read the JWT `sub` directly
(`auth.jwt() ->> 'sub'`) rather than `auth.uid()` (which casts `sub` to uuid):

```sql
create policy "owner can manage own rows"
  on cooking_<table>
  for all
  using ((auth.jwt() ->> 'sub') = user_id)
  with check ((auth.jwt() ->> 'sub') = user_id);
```

Every `cooking_*` table also has a `before insert` trigger that stamps
`user_id := auth.jwt() ->> 'sub'`, so the app never sends `user_id` — the DB
derives it from the Clerk session.

The first feature tables (`cooking_ingredients`, `cooking_inventory`) land in ticket #3 (Ingredient Inventory). This skeleton ticket only wires the client factory; the first live RLS-gated query rides on the Inventory ticket.
