-- 0009_cook_banked_portions.sql
-- Records the portions a Cook banked to the Food Bank on the slot itself, so
-- Uncook reverses exactly what was banked (ADR-0008) instead of re-deriving it
-- from the recipe's servings — which is mutable and could be edited between the
-- Cook and the Uncook. Set by claimForCook at cook time; read by uncook.

alter table cooking_meal_slots
  add column if not exists banked_portions integer;
