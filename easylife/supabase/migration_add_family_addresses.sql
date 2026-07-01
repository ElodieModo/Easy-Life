-- Safe migration: useful family addresses shared by all family members.
-- Idempotent migration for existing databases.

create extension if not exists "pgcrypto";

create table if not exists public.family_useful_addresses (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  category text not null check (category in ('maison', 'ecole', 'travail', 'autre')),
  label text not null,
  address text not null,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_family_useful_addresses_family_id
  on public.family_useful_addresses(family_id);
create index if not exists idx_family_useful_addresses_category
  on public.family_useful_addresses(category);

create or replace function public.set_family_useful_addresses_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_set_family_useful_addresses_updated_at on public.family_useful_addresses;
create trigger trg_set_family_useful_addresses_updated_at
before update on public.family_useful_addresses
for each row
execute function public.set_family_useful_addresses_updated_at();

alter table public.family_useful_addresses enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'family_useful_addresses'
      and policyname = 'Family members can read useful addresses'
  ) then
    create policy "Family members can read useful addresses"
    on public.family_useful_addresses
    for select
    using (public.is_family_member(family_id));
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'family_useful_addresses'
      and policyname = 'Family members can add useful addresses'
  ) then
    create policy "Family members can add useful addresses"
    on public.family_useful_addresses
    for insert
    with check (public.is_family_member(family_id) and auth.uid() = created_by);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'family_useful_addresses'
      and policyname = 'Family members can update useful addresses'
  ) then
    create policy "Family members can update useful addresses"
    on public.family_useful_addresses
    for update
    using (public.is_family_member(family_id))
    with check (public.is_family_member(family_id));
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'family_useful_addresses'
      and policyname = 'Family members can delete useful addresses'
  ) then
    create policy "Family members can delete useful addresses"
    on public.family_useful_addresses
    for delete
    using (public.is_family_member(family_id));
  end if;
end
$$;
