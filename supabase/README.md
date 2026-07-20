# Supabase setup

This app uses Supabase (Postgres) with **Row-Level Security scoping every row to the Clerk user id**. Auth uses Clerk's **native Supabase integration** (Clerk as a third-party auth provider in Supabase) — *not* the deprecated "Supabase JWT template" that shared a JWT secret. The standard Clerk session token works because the integration adds the `authenticated` role.

## One-time setup

1. **Create a Supabase project** at https://supabase.com. In `.env.local`, set:
   ```
   VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
   VITE_SUPABASE_ANON_KEY=ey...   # the publishable (anon) key
   ```

2. **Activate Clerk's Supabase integration** (gives you a Clerk domain):
   - Clerk dashboard → [Supabase integration setup](https://dashboard.clerk.com/setup/supabase) → choose options → **Activate**.
   - Copy the **Clerk domain** it reveals (e.g. `https://your-instance.clerk.accounts.dev`).

3. **Add Clerk as a third-party auth provider in Supabase**:
   - Supabase dashboard → **Authentication → Sign In / Providers** → **Add provider** → **Clerk**.
   - Paste the **Clerk domain** from step 2. Save.

   That's it — no secrets shared. Supabase verifies Clerk tokens via Clerk's JWKS.

## How queries are scoped

`src/cooking/lib/supabase.ts` exports `createCookingClient(token)` — a per-request client that sends the Clerk session token as a Bearer token. Server functions (the tRPC context in `src/integrations/trpc/init.ts`) call `session.getToken()` and pass it here. Supabase resolves the token and exposes its claims via `auth.jwt()`.

## RLS pattern (used by every `cooking_*` table)

Clerk user ids (`user_…`) are not UUIDs, so we read the JWT `sub` directly (`auth.jwt() ->> 'sub'`) rather than `auth.uid()` (which casts `sub` to uuid):

```sql
create policy "owner can manage own rows"
  on cooking_<table>
  for all
  to authenticated
  using ((auth.jwt() ->> 'sub') = user_id)
  with check ((auth.jwt() ->> 'sub') = user_id);
```

Every `cooking_*` table also has a column default `user_id text not null default auth.jwt() ->> 'sub'`, so the app never sends `user_id` — the DB derives it from the request token.

## Migrations

Run the files under `supabase/migrations/` in Supabase's SQL editor in order. Each is idempotent (`if not exists` / `drop ... if exists`), so re-runs are safe.
