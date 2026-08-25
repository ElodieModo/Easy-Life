-- Increase the family children planning capacity from 3 to 4.
-- Idempotent migration for existing databases.

create or replace function public.enforce_max_three_children_per_family()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  child_count integer;
begin
  select count(*)
  into child_count
  from public.family_children fc
  where fc.family_id = new.family_id;

  if child_count >= 4 then
    raise exception 'Maximum 4 children per family is allowed';
  end if;

  return new;
end;
$$;
