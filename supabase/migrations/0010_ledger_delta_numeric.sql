-- 0010_ledger_delta_numeric.sql
-- The Ingredient Ledger delta was integer, but inventory quantity is
-- numeric(14, 3). A Cook that consumes a fractional amount (e.g. 0.5 cups)
-- would have its delta truncated on write. Align the column to match.

alter table cooking_ingredient_ledger
  alter column delta type numeric(14, 3) using delta::numeric(14, 3);
