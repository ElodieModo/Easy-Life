-- Safe migration: family children planning (shared by family), max 3 children.
-- Idempotent migration for existing databases.

create extension if not exists "pgcrypto";

create table if not exists public.family_children (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  name text not null,
  birth_date date,
  color text not null default '#38bdf8',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.family_child_planning_events (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  child_id uuid not null references public.family_children(id) on delete cascade,
  title text not null,
  notes text,
  start_at timestamptz not null,
  end_at timestamptz not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_at > start_at)
);

create index if not exists idx_family_children_family_id on public.family_children(family_id);
create index if not exists idx_family_child_planning_events_family_id on public.family_child_planning_events(family_id);
create index if not exists idx_family_child_planning_events_child_id on public.family_child_planning_events(child_id);
create index if not exists idx_family_child_planning_events_start_at on public.family_child_planning_events(start_at);

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

  if child_count >= 3 then
    raise exception 'Maximum 3 children per family is allowed';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_max_three_children on public.family_children;
create trigger trg_enforce_max_three_children
before insert on public.family_children
for each row
execute function public.enforce_max_three_children_per_family();

alter table public.family_children enable row level security;
alter table public.family_child_planning_events enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'family_children'
      and policyname = 'Family members can read family children'
  ) then
    create policy "Family members can read family children"
    on public.family_children
    for select
    using (public.is_family_member(family_id));
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'family_children'
      and policyname = 'Family members can add family children'
  ) then
    create policy "Family members can add family children"
    on public.family_children
    for insert
    with check (public.is_family_member(family_id) and auth.uid() = created_by);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'family_children'
      and policyname = 'Family members can update family children'
  ) then
    create policy "Family members can update family children"
    on public.family_children
    for update
    using (public.is_family_member(family_id))
    with check (public.is_family_member(family_id));
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'family_children'
      and policyname = 'Family members can delete family children'
  ) then
    create policy "Family members can delete family children"
    on public.family_children
    for delete
    using (public.is_family_member(family_id));
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'family_child_planning_events'
      and policyname = 'Family members can read child planning events'
  ) then
    create policy "Family members can read child planning events"
    on public.family_child_planning_events
    for select
    using (public.is_family_member(family_id));
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'family_child_planning_events'
      and policyname = 'Family members can add child planning events'
  ) then
    create policy "Family members can add child planning events"
    on public.family_child_planning_events
    for insert
    with check (
      public.is_family_member(family_id)
      and auth.uid() = created_by
      and exists (
        select 1
        from public.family_children fc
        where fc.id = family_child_planning_events.child_id
          and fc.family_id = family_child_planning_events.family_id
      )
    );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'family_child_planning_events'
      and policyname = 'Family members can update child planning events'
  ) then
    create policy "Family members can update child planning events"
    on public.family_child_planning_events
    for update
    using (public.is_family_member(family_id))
    with check (
      public.is_family_member(family_id)
      and exists (
        select 1
        from public.family_children fc
        where fc.id = family_child_planning_events.child_id
          and fc.family_id = family_child_planning_events.family_id
      )
    );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'family_child_planning_events'
      and policyname = 'Family members can delete child planning events'
  ) then
    create policy "Family members can delete child planning events"
    on public.family_child_planning_events
    for delete
    using (public.is_family_member(family_id));
  end if;
end
$$;
