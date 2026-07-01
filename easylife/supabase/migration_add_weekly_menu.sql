-- Safe migration: add weekly family menu planning.
-- This migration is idempotent and can be run on an existing project.

create extension if not exists "pgcrypto";

create table if not exists public.family_weekly_menu_items (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  week_start_date date not null,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  meal_slot text not null check (meal_slot in ('petit-dejeuner', 'dejeuner', 'gouter', 'diner')),
  title text not null,
  notes text,
  ingredients text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (family_id, week_start_date, day_of_week, meal_slot)
);

create index if not exists idx_family_weekly_menu_items_family_id
  on public.family_weekly_menu_items(family_id);

create index if not exists idx_family_weekly_menu_items_week_start_date
  on public.family_weekly_menu_items(week_start_date);

alter table public.family_weekly_menu_items enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'family_weekly_menu_items'
      and policyname = 'Family members can read weekly menu items'
  ) then
    create policy "Family members can read weekly menu items"
    on public.family_weekly_menu_items
    for select
    using (public.is_family_member(family_id));
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'family_weekly_menu_items'
      and policyname = 'Family members can insert weekly menu items'
  ) then
    create policy "Family members can insert weekly menu items"
    on public.family_weekly_menu_items
    for insert
    with check (public.is_family_member(family_id) and auth.uid() = created_by);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'family_weekly_menu_items'
      and policyname = 'Family members can update weekly menu items'
  ) then
    create policy "Family members can update weekly menu items"
    on public.family_weekly_menu_items
    for update
    using (public.is_family_member(family_id))
    with check (public.is_family_member(family_id));
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'family_weekly_menu_items'
      and policyname = 'Family members can delete weekly menu items'
  ) then
    create policy "Family members can delete weekly menu items"
    on public.family_weekly_menu_items
    for delete
    using (public.is_family_member(family_id));
  end if;
end
$$;
