-- 0002_inventory.sql
-- Cooking > Ingredients & Inventory (T02).
-- Uses Clerk's NATIVE Supabase integration (third-party auth provider) — not
-- the deprecated JWT template. The Clerk session token carries the
-- "authenticated" role and `sub` = Clerk user id. Supabase verifies it via
-- Clerk's JWKS (configured as a third-party auth provider), and
-- auth.jwt() ->> 'sub' resolves to the Clerk user id. See supabase/README.md.

-- An Ingredient is the catalog identity: a name and its canonical unit.
-- It carries no quantity or availability itself (that lives in cooking_inventory).
-- user_id defaults from the request JWT, so the app never sends it.
create table if not exists cooking_ingredients (
  id         uuid primary key default gen_random_uuid(),
  user_id    text not null default auth.jwt() ->> 'sub',
  name       text not null,
  unit       text not null,
  created_by text not null default 'user',  -- 'user' | 'agent'
  created_at timestamptz not null default now()
);

-- Names are unique per user, case-insensitively. Expression uniques can't be
-- inline in CREATE TABLE, so this is a separate index.
create unique index if not exists cooking_ingredients_user_name_uniq
  on cooking_ingredients (user_id, lower(name));

-- Canonical unit is one of the five allowed values (matches the app's UNITS).
-- Idempotent so this applies whether or not an earlier version of the table
-- had the constraint.
alter table cooking_ingredients drop constraint if exists cooking_ingredients_unit_chk;
alter table cooking_ingredients
  add constraint cooking_ingredients_unit_chk
  check (unit in ('piece', 'g', 'kg', 'ml', 'L'));

-- An Inventory entry is the per-ingredient state in the user's kitchen.
-- Exactly one row per ingredient. The check constraint encodes the
-- Endless / Tracked / Unavailable state machine from CONTEXT.md.
create table if not exists cooking_inventory (
  ingredient_id uuid primary key references cooking_ingredients(id) on delete cascade,
  user_id       text not null default auth.jwt() ->> 'sub',
  state         text not null check (state in ('endless', 'tracked', 'unavailable')),
  quantity      numeric(14, 3),  -- null: endless | 0: unavailable | >0: tracked
  updated_at    timestamptz not null default now(),
  check (
    (state = 'endless'    and quantity is null)
    or (state = 'unavailable' and quantity = 0)
    or (state = 'tracked'     and quantity > 0)
  )
);

create index if not exists cooking_inventory_user_state_idx
  on cooking_inventory (user_id, state);

alter table cooking_ingredients enable row level security;
alter table cooking_inventory   enable row level security;

-- Clerk user ids ("user_…") are not UUIDs, so we read the JWT `sub` directly
-- rather than calling auth.uid() (which casts sub to uuid).
drop policy if exists "owner manages own cooking_ingredients" on cooking_ingredients;
create policy "owner manages own cooking_ingredients" on cooking_ingredients
  for all
  to authenticated
  using ((auth.jwt() ->> 'sub') = user_id)
  with check ((auth.jwt() ->> 'sub') = user_id);

drop policy if exists "owner manages own cooking_inventory" on cooking_inventory;
create policy "owner manages own cooking_inventory" on cooking_inventory
  for all
  to authenticated
  using ((auth.jwt() ->> 'sub') = user_id)
  with check ((auth.jwt() ->> 'sub') = user_id);
