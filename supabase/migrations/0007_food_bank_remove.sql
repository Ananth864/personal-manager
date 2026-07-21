-- 0007_food_bank_remove.sql
-- Food Bank discard: reduce produced portions directly without assigning to a
-- meal slot (threw away / ate unplanned). Symmetric to cooking_add_portions.
-- The service layer enforces the reservation floor (produced may not drop below
-- the count reserved by Food Bank slots); this rpc only guards against going
-- negative and is idempotent on a missing row.

create or replace function cooking_remove_portions(p_recipe uuid, p_portions integer)
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
  update cooking_food_bank
    set portions = greatest(0, portions - p_portions)
    where user_id = v_user
      and recipe_id is not distinct from p_recipe;
end;
$$;
