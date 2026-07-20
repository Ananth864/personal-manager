-- 0002_inventory.sql
-- Cooking > Ingredients & Inventory (T02).
-- Each row is scoped to the Clerk user id via Row-Level Security
-- (user_id = auth.uid()::text). See supabase/README.md for the Clerk/JWT setup.

-- An Ingredient is the catalog identity: a name and its canonical unit.
-- It carries no quantity or availability itself (that lives in cooking_inventory).
create table if not exists cooking_ingredients (
  id         uuid primary key default gen_random_uuid(),
  user_id    text not null,
  name       text not null,
  unit       text not null,
  created_by text not null default 'user',  -- 'user' | 'agent'
  created_at timestamptz not null default now(),
  unique (user_id, lower(name))
);

-- An Inventory entry is the per-ingredient state in the user's kitchen.
-- Exactly one row per ingredient. The check constraint encodes the
-- Endless / Tracked / Unavailable state machine from CONTEXT.md.
create table if not exists cooking_inventory (
  ingredient_id uuid primary key references cooking_ingredients(id) on delete cascade,
  user_id       text not null,
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

drop policy if exists "owner manages own cooking_ingredients" on cooking_ingredients;
create policy "owner manages own cooking_ingredients" on cooking_ingredients
  for all
  using (user_id = auth.uid()::text)
  with check (user_id = auth.uid()::text);

drop policy if exists "owner manages own cooking_inventory" on cooking_inventory;
create policy "owner manages own cooking_inventory" on cooking_inventory
  for all
  using (user_id = auth.uid()::text)
  with check (user_id = auth.uid()::text);

-- Stamp user_id from the authenticated Clerk session (auth.uid() resolves to
-- the Clerk user id once the Supabase JWT is configured to trust Clerk — see
-- supabase/README.md). The app never sends user_id; the DB owns it, so a row
-- can never be written to the wrong user.
create or replace function cooking_set_user_id()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.user_id := auth.uid()::text;
  return new;
end;
$$;

drop trigger if exists cooking_ingredients_set_user_id on cooking_ingredients;
create trigger cooking_ingredients_set_user_id
  before insert on cooking_ingredients
  for each row execute function cooking_set_user_id();

drop trigger if exists cooking_inventory_set_user_id on cooking_inventory;
create trigger cooking_inventory_set_user_id
  before insert on cooking_inventory
  for each row execute function cooking_set_user_id();
