-- 0006_adhoc_servings.sql
-- T05 follow-up: Ad-hoc Cooks now produce Food Bank portions (ADR-0002), so
-- ad-hoc meals carry a servings value, and the Food Bank accepts a NULL
-- recipe_id (the commingled "ad-hoc pool"). Also hardens cooking_add_portions.

-- Ad-hoc meals capture a servings count (null for non-adhoc slots).
alter table cooking_meal_slots
  add column if not exists adhoc_servings integer
  check (adhoc_servings is null or adhoc_servings >= 1);

-- The Food Bank's recipe_id becomes nullable: NULL means the commingled
-- ad-hoc pool (portions from one-off Cooks with no catalog identity).
alter table cooking_food_bank alter column recipe_id drop not null;

-- Replace the (user_id, recipe_id) unique constraint with a NULLS NOT DISTINCT
-- index so all of a user's ad-hoc portions commingle into a single NULL row
-- (without this, NULLs are distinct and each ad-hoc Cook would create a row).
-- Requires Postgres 15+ (Supabase default).
alter table cooking_food_bank
  drop constraint if exists cooking_food_bank_user_id_recipe_id_key;
create unique index if not exists cooking_food_bank_user_recipe_uniq
  on cooking_food_bank (user_id, recipe_id) NULLS NOT DISTINCT;

-- Recreate the portion-increment function: nullable p_recipe (NULL = ad-hoc
-- pool), a non-positive guard, and an explicit SECURITY INVOKER (runs as the
-- authenticated caller with RLS, so a user only ever writes their own row).
create or replace function cooking_add_portions(p_recipe uuid, p_portions integer)
returns void
language plpgsql
security invoker
as $$
declare
  v_user text := auth.jwt() ->> 'sub';
begin
  if p_portions is null or p_portions <= 0 then
    return;
  end if;
  insert into cooking_food_bank (user_id, recipe_id, portions)
  values (v_user, p_recipe, p_portions)
  on conflict (user_id, recipe_id) do update
    set portions = cooking_food_bank.portions + p_portions;
end;
$$;
