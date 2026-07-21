-- 0005_cook.sql
-- Cooking > Cook (T05). Cook is the ONLY operation that mutates Tracked
-- Ingredient Inventory and the only one that produces Food Bank portions
-- (CONTEXT.md → Cook; ADR-0001 / ADR-0002).

-- A Meal Slot that has been cooked is marked so it can't be cooked twice.
alter table cooking_meal_slots
  add column if not exists cooked boolean not null default false;

-- The Food Bank: prepared portions, tracked per Recipe and commingled across
-- Cooks of the same Recipe (CONTEXT.md → Food Bank). Reservations land in T06;
-- T05 only produces portions here. Ad-hoc Cooks produce no portions (an ad-hoc
-- has no catalog identity to commingle under and no servings).
create table if not exists cooking_food_bank (
  id        uuid primary key default gen_random_uuid(),
  user_id   text not null default auth.jwt() ->> 'sub',
  recipe_id uuid not null references cooking_recipes(id) on delete cascade,
  portions  integer not null default 0 check (portions >= 0),
  unique (user_id, recipe_id)
);

alter table cooking_food_bank enable row level security;

drop policy if exists "owner manages own cooking_food_bank" on cooking_food_bank;
create policy "owner manages own cooking_food_bank" on cooking_food_bank
  for all
  to authenticated
  using ((auth.jwt() ->> 'sub') = user_id)
  with check ((auth.jwt() ->> 'sub') = user_id);

-- Atomic portion increment. Runs as the authenticated caller (security
-- invoker) with RLS, so a user only ever adds to their own row; the unique
-- (user_id, recipe_id) constraint commingles portions across Cooks.
create or replace function cooking_add_portions(p_recipe uuid, p_portions integer)
returns void
language plpgsql
as $$
declare
  v_user text := auth.jwt() ->> 'sub';
begin
  insert into cooking_food_bank (user_id, recipe_id, portions)
  values (v_user, p_recipe, p_portions)
  on conflict (user_id, recipe_id) do update
    set portions = cooking_food_bank.portions + p_portions;
end;
$$;
