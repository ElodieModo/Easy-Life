-- Safe migration: shared family external calendar (read-only sync).
-- This migration is idempotent and can be run on an existing project.

create extension if not exists "pgcrypto";

create table if not exists public.family_calendar_connections (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null unique references public.families(id) on delete cascade,
  provider text not null check (provider in ('google', 'outlook', 'ical')),
  source_url text not null,
  is_read_only boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_synced_at timestamptz,
  last_sync_status text,
  last_sync_error text
);

create table if not exists public.family_calendar_events (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  connection_id uuid not null references public.family_calendar_connections(id) on delete cascade,
  external_id text not null,
  title text not null,
  description text,
  location text,
  start_at timestamptz not null,
  end_at timestamptz,
  is_all_day boolean not null default false,
  source_updated_at timestamptz,
  raw_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (connection_id, external_id)
);

create index if not exists idx_family_calendar_connections_family_id on public.family_calendar_connections(family_id);
create index if not exists idx_family_calendar_events_family_id on public.family_calendar_events(family_id);
create index if not exists idx_family_calendar_events_start_at on public.family_calendar_events(start_at);

alter table public.family_calendar_connections enable row level security;
alter table public.family_calendar_events enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'family_calendar_connections'
      and policyname = 'Family members can read family calendar connections'
  ) then
    create policy "Family members can read family calendar connections"
    on public.family_calendar_connections
    for select
    using (public.is_family_member(family_id));
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'family_calendar_connections'
      and policyname = 'Family members can create family calendar connections'
  ) then
    create policy "Family members can create family calendar connections"
    on public.family_calendar_connections
    for insert
    with check (public.is_family_member(family_id) and auth.uid() = created_by and is_read_only = true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'family_calendar_connections'
      and policyname = 'Family members can update family calendar connections'
  ) then
    create policy "Family members can update family calendar connections"
    on public.family_calendar_connections
    for update
    using (public.is_family_member(family_id))
    with check (public.is_family_member(family_id) and is_read_only = true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'family_calendar_connections'
      and policyname = 'Family members can delete family calendar connections'
  ) then
    create policy "Family members can delete family calendar connections"
    on public.family_calendar_connections
    for delete
    using (public.is_family_member(family_id));
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'family_calendar_events'
      and policyname = 'Family members can read family calendar events'
  ) then
    create policy "Family members can read family calendar events"
    on public.family_calendar_events
    for select
    using (public.is_family_member(family_id));
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'family_calendar_events'
      and policyname = 'Family members can write family calendar events'
  ) then
    create policy "Family members can write family calendar events"
    on public.family_calendar_events
    for insert
    with check (
      public.is_family_member(family_id)
      and exists (
        select 1
        from public.family_calendar_connections c
        where c.id = family_calendar_events.connection_id
          and c.family_id = family_calendar_events.family_id
      )
    );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'family_calendar_events'
      and policyname = 'Family members can update family calendar events'
  ) then
    create policy "Family members can update family calendar events"
    on public.family_calendar_events
    for update
    using (public.is_family_member(family_id))
    with check (
      public.is_family_member(family_id)
      and exists (
        select 1
        from public.family_calendar_connections c
        where c.id = family_calendar_events.connection_id
          and c.family_id = family_calendar_events.family_id
      )
    );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'family_calendar_events'
      and policyname = 'Family members can delete family calendar events'
  ) then
    create policy "Family members can delete family calendar events"
    on public.family_calendar_events
    for delete
    using (public.is_family_member(family_id));
  end if;
end
$$;
