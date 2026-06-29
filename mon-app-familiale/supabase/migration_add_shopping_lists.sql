-- Safe migration: enable multiple shopping lists per family.
-- This migration is idempotent and can be run on an existing project.

create extension if not exists "pgcrypto";

create table if not exists public.shopping_lists (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  name text not null,
  created_at timestamptz not null default now(),
  unique (family_id, name)
);

alter table public.shopping_lists enable row level security;

alter table public.shopping_items
  add column if not exists list_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'shopping_items'
      and c.contype = 'f'
      and c.conname = 'shopping_items_list_id_fkey'
  ) then
    alter table public.shopping_items
      add constraint shopping_items_list_id_fkey
      foreign key (list_id)
      references public.shopping_lists(id)
      on delete cascade;
  end if;
end
$$;

-- Create a default list per family if none exists.
insert into public.shopping_lists (family_id, created_by, name)
select si.family_id, min(si.created_by), 'Liste principale'
from public.shopping_items si
where si.family_id is not null
  and not exists (
    select 1
    from public.shopping_lists sl
    where sl.family_id = si.family_id
  )
group by si.family_id;

-- Backfill list_id for existing rows.
update public.shopping_items si
set list_id = sl.id
from public.shopping_lists sl
where si.list_id is null
  and sl.family_id = si.family_id
  and sl.name = 'Liste principale';

-- Ensure no remaining null list_id for rows with a family.
update public.shopping_items si
set list_id = sl.id
from (
  select distinct on (family_id) family_id, id
  from public.shopping_lists
  order by family_id, created_at asc
) sl
where si.list_id is null
  and si.family_id = sl.family_id;

alter table public.shopping_items
  alter column list_id set not null;

create index if not exists idx_shopping_lists_family_id on public.shopping_lists(family_id);
create index if not exists idx_shopping_items_list_id on public.shopping_items(list_id);

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'shopping_lists'
      and policyname = 'Family members can read shopping lists'
  ) then
    create policy "Family members can read shopping lists"
    on public.shopping_lists
    for select
    using (public.is_family_member(family_id));
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'shopping_lists'
      and policyname = 'Family members can add shopping lists'
  ) then
    create policy "Family members can add shopping lists"
    on public.shopping_lists
    for insert
    with check (public.is_family_member(family_id) and auth.uid() = created_by);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'shopping_lists'
      and policyname = 'Family members can update shopping lists'
  ) then
    create policy "Family members can update shopping lists"
    on public.shopping_lists
    for update
    using (public.is_family_member(family_id))
    with check (public.is_family_member(family_id));
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'shopping_lists'
      and policyname = 'Family members can delete shopping lists'
  ) then
    create policy "Family members can delete shopping lists"
    on public.shopping_lists
    for delete
    using (public.is_family_member(family_id));
  end if;
end
$$;

-- Replace item policies with list-aware checks.
drop policy if exists "Family members can add shopping items" on public.shopping_items;
create policy "Family members can add shopping items"
on public.shopping_items
for insert
with check (
  public.is_family_member(family_id)
  and auth.uid() = created_by
  and exists (
    select 1
    from public.shopping_lists sl
    where sl.id = shopping_items.list_id
      and sl.family_id = shopping_items.family_id
  )
);

drop policy if exists "Family members can update shopping items" on public.shopping_items;
create policy "Family members can update shopping items"
on public.shopping_items
for update
using (public.is_family_member(family_id))
with check (
  public.is_family_member(family_id)
  and exists (
    select 1
    from public.shopping_lists sl
    where sl.id = shopping_items.list_id
      and sl.family_id = shopping_items.family_id
  )
);