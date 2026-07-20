-- 0004_schedule.sql
-- Cooking > Schedule (T04).
-- One row per *assigned* Meal Slot. No row => the slot is unassigned (a planning
-- gap). A 'nocook' row is an explicit decision to not cook (distinct from
-- unassigned). Mutating the Schedule never touches Inventory (ADR-0001); the
-- user_id default + RLS scope each slot to the authenticated user.

create table if not exists cooking_meal_slots (
  id                uuid primary key default gen_random_uuid(),
  user_id           text not null default auth.jwt() ->> 'sub',
  slot_date         date not null,
  meal              text not null check (meal in ('lunch', 'dinner')),
  assignment_type   text not null check (assignment_type in ('recipe', 'adhoc', 'foodbank', 'nocook')),
  -- 'recipe'
  recipe_id         uuid references cooking_recipes(id) on delete set null,
  -- 'adhoc' (a one-off ingredient list bound to this slot, not saved to the catalog)
  adhoc_name        text,
  adhoc_ingredients jsonb,  -- [{ ingredientId: string, quantity: number }]
  created_at        timestamptz not null default now(),
  unique (user_id, slot_date, meal)
);

create index if not exists cooking_meal_slots_user_date_idx
  on cooking_meal_slots (user_id, slot_date);

alter table cooking_meal_slots enable row level security;

drop policy if exists "owner manages own cooking_meal_slots" on cooking_meal_slots;
create policy "owner manages own cooking_meal_slots" on cooking_meal_slots
  for all
  to authenticated
  using ((auth.jwt() ->> 'sub') = user_id)
  with check ((auth.jwt() ->> 'sub') = user_id);
