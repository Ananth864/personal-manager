-- 0003_recipes.sql
-- Cooking > Recipes (T03).
-- Same Clerk native Supabase integration as 0002_inventory.sql: user_id is the
-- JWT `sub` (Clerk user id), read via auth.jwt() ->> 'sub'.

-- A Recipe is a named, reusable collection of ingredients with required
-- quantities. Soft-deleted via `hidden` so archived Weeks stay legible after a
-- recipe is removed from the catalog.
create table if not exists cooking_recipes (
  id         uuid primary key default gen_random_uuid(),
  user_id    text not null default auth.jwt() ->> 'sub',
  name       text not null,
  servings   integer not null default 2 check (servings >= 1),
  notes      text,
  hidden     boolean not null default false,
  created_by text not null default 'user',  -- 'user' | 'agent'
  created_at timestamptz not null default now()
);

create index if not exists cooking_recipes_user_idx
  on cooking_recipes (user_id, hidden);

-- A recipe line: one ingredient and the quantity required (in the ingredient's
-- canonical unit). The (recipe_id, ingredient_id) primary key prevents a recipe
-- from listing the same ingredient twice.
create table if not exists cooking_recipe_ingredients (
  recipe_id     uuid not null references cooking_recipes(id) on delete cascade,
  ingredient_id uuid not null references cooking_ingredients(id) on delete cascade,
  quantity      numeric(14, 3) not null check (quantity > 0),
  primary key (recipe_id, ingredient_id)
);

create index if not exists cooking_recipe_ingredients_ingredient_idx
  on cooking_recipe_ingredients (ingredient_id);

alter table cooking_recipes            enable row level security;
alter table cooking_recipe_ingredients enable row level security;

drop policy if exists "owner manages own cooking_recipes" on cooking_recipes;
create policy "owner manages own cooking_recipes" on cooking_recipes
  for all
  to authenticated
  using ((auth.jwt() ->> 'sub') = user_id)
  with check ((auth.jwt() ->> 'sub') = user_id);

-- recipe_ingredients has no user_id column; ownership is derived from the
-- parent recipe (and the referenced ingredient must also be the user's own).
drop policy if exists "owner manages own cooking_recipe_ingredients" on cooking_recipe_ingredients;
create policy "owner manages own cooking_recipe_ingredients" on cooking_recipe_ingredients
  for all
  to authenticated
  using (
    exists (
      select 1 from cooking_recipes r
      where r.id = cooking_recipe_ingredients.recipe_id
        and (auth.jwt() ->> 'sub') = r.user_id
    )
  )
  with check (
    exists (
      select 1 from cooking_recipes r
      where r.id = cooking_recipe_ingredients.recipe_id
        and (auth.jwt() ->> 'sub') = r.user_id
    )
    and exists (
      select 1 from cooking_ingredients i
      where i.id = cooking_recipe_ingredients.ingredient_id
        and (auth.jwt() ->> 'sub') = i.user_id
    )
  );
