-- 0008_ingredient_ledger.sql
-- The Ingredient Ledger (CONTEXT.md → Ingredient Ledger; ADR-0008). An
-- append-only record of the quantity changes a Cook applies to Tracked
-- ingredients, so a Cook can be reversed by Uncook. Records the ACTUAL delta
-- (post-clamp), not the recipe's requested quantity.

create table if not exists cooking_ingredient_ledger (
  id            uuid primary key default gen_random_uuid(),
  user_id       text not null default auth.jwt() ->> 'sub',
  ingredient_id uuid not null references cooking_ingredients(id) on delete cascade,
  -- The actual quantity change applied (negative for a Cook's consumption).
  delta         integer not null,
  -- Which Meal Slot's Cook produced this entry.
  source_date   date not null,
  source_meal   text not null check (source_meal in ('lunch', 'dinner')),
  reversed      boolean not null default false,
  created_at    timestamptz not null default now()
);

alter table cooking_ingredient_ledger enable row level security;

drop policy if exists "owner manages own cooking_ingredient_ledger" on cooking_ingredient_ledger;
create policy "owner manages own cooking_ingredient_ledger" on cooking_ingredient_ledger
  for all
  to authenticated
  using ((auth.jwt() ->> 'sub') = user_id)
  with check ((auth.jwt() ->> 'sub') = user_id);

-- Look up a slot's active entries on Uncook.
create index if not exists cooking_ingredient_ledger_slot_idx
  on cooking_ingredient_ledger (source_date, source_meal);
