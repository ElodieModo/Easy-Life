-- Post-migration checks for shopping lists feature.
-- Run these queries in Supabase SQL Editor after migration_add_shopping_lists.sql.

-- 1) Ensure all shopping items are linked to a list.
-- Expected: missing_list_id = 0
select count(*) as missing_list_id
from public.shopping_items
where list_id is null;

-- 2) Ensure every item points to a list in the same family.
-- Expected: cross_family_links = 0
select count(*) as cross_family_links
from public.shopping_items si
join public.shopping_lists sl on sl.id = si.list_id
where si.family_id <> sl.family_id;

-- 3) Ensure each family has at least one shopping list.
-- Expected: families_without_list = 0
select count(*) as families_without_list
from public.families f
where not exists (
  select 1
  from public.shopping_lists sl
  where sl.family_id = f.id
);
