-- Safe migration: add notes lists with family/private visibility.
-- This migration is idempotent and can be run on an existing project.

create extension if not exists "pgcrypto";

create table if not exists public.family_note_lists (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  title text not null,
  visibility text not null check (visibility in ('family', 'private')),
  owner_user_id uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.family_note_items (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  list_id uuid not null references public.family_note_lists(id) on delete cascade,
  content text not null,
  done boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_family_note_lists_family_id
  on public.family_note_lists(family_id);

create index if not exists idx_family_note_lists_visibility
  on public.family_note_lists(family_id, visibility);

create index if not exists idx_family_note_lists_owner_user_id
  on public.family_note_lists(owner_user_id);

create index if not exists idx_family_note_items_family_id
  on public.family_note_items(family_id);

create index if not exists idx_family_note_items_list_id
  on public.family_note_items(list_id);

alter table public.family_note_lists enable row level security;
alter table public.family_note_items enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'family_note_lists'
      and policyname = 'Family members can read visible note lists'
  ) then
    create policy "Family members can read visible note lists"
    on public.family_note_lists
    for select
    using (
      public.is_family_member(family_id)
      and (
        visibility = 'family'
        or owner_user_id = auth.uid()
      )
    );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'family_note_lists'
      and policyname = 'Family members can create note lists'
  ) then
    create policy "Family members can create note lists"
    on public.family_note_lists
    for insert
    with check (
      public.is_family_member(family_id)
      and auth.uid() = created_by
      and (
        (visibility = 'family' and (owner_user_id is null or owner_user_id = auth.uid()))
        or (visibility = 'private' and owner_user_id = auth.uid())
      )
    );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'family_note_lists'
      and policyname = 'Family members can update visible note lists'
  ) then
    create policy "Family members can update visible note lists"
    on public.family_note_lists
    for update
    using (
      public.is_family_member(family_id)
      and (
        visibility = 'family'
        or owner_user_id = auth.uid()
      )
    )
    with check (
      public.is_family_member(family_id)
      and (
        (visibility = 'family' and (owner_user_id is null or owner_user_id = auth.uid()))
        or (visibility = 'private' and owner_user_id = auth.uid())
      )
    );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'family_note_lists'
      and policyname = 'Family members can delete visible note lists'
  ) then
    create policy "Family members can delete visible note lists"
    on public.family_note_lists
    for delete
    using (
      public.is_family_member(family_id)
      and (
        visibility = 'family'
        or owner_user_id = auth.uid()
      )
    );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'family_note_items'
      and policyname = 'Family members can read note items from visible lists'
  ) then
    create policy "Family members can read note items from visible lists"
    on public.family_note_items
    for select
    using (
      public.is_family_member(family_id)
      and exists (
        select 1
        from public.family_note_lists fnl
        where fnl.id = family_note_items.list_id
          and fnl.family_id = family_note_items.family_id
          and (
            fnl.visibility = 'family'
            or fnl.owner_user_id = auth.uid()
          )
      )
    );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'family_note_items'
      and policyname = 'Family members can insert note items in visible lists'
  ) then
    create policy "Family members can insert note items in visible lists"
    on public.family_note_items
    for insert
    with check (
      public.is_family_member(family_id)
      and auth.uid() = created_by
      and exists (
        select 1
        from public.family_note_lists fnl
        where fnl.id = family_note_items.list_id
          and fnl.family_id = family_note_items.family_id
          and (
            fnl.visibility = 'family'
            or fnl.owner_user_id = auth.uid()
          )
      )
    );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'family_note_items'
      and policyname = 'Family members can update note items from visible lists'
  ) then
    create policy "Family members can update note items from visible lists"
    on public.family_note_items
    for update
    using (
      public.is_family_member(family_id)
      and exists (
        select 1
        from public.family_note_lists fnl
        where fnl.id = family_note_items.list_id
          and fnl.family_id = family_note_items.family_id
          and (
            fnl.visibility = 'family'
            or fnl.owner_user_id = auth.uid()
          )
      )
    )
    with check (
      public.is_family_member(family_id)
      and exists (
        select 1
        from public.family_note_lists fnl
        where fnl.id = family_note_items.list_id
          and fnl.family_id = family_note_items.family_id
          and (
            fnl.visibility = 'family'
            or fnl.owner_user_id = auth.uid()
          )
      )
    );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'family_note_items'
      and policyname = 'Family members can delete note items from visible lists'
  ) then
    create policy "Family members can delete note items from visible lists"
    on public.family_note_items
    for delete
    using (
      public.is_family_member(family_id)
      and exists (
        select 1
        from public.family_note_lists fnl
        where fnl.id = family_note_items.list_id
          and fnl.family_id = family_note_items.family_id
          and (
            fnl.visibility = 'family'
            or fnl.owner_user_id = auth.uid()
          )
      )
    );
  end if;
end
$$;
