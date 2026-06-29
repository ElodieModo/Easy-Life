create extension if not exists "pgcrypto";

create table if not exists public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.family_members (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  joined_at timestamptz not null default now(),
  unique (family_id, user_id)
);

create table if not exists public.family_invites (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  email text not null,
  invited_by uuid not null references auth.users(id) on delete cascade,
  token text not null unique,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  unique (family_id, email, status)
);

create table if not exists public.shopping_lists (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  name text not null,
  created_at timestamptz not null default now(),
  unique (family_id, name)
);

create table if not exists public.shopping_items (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  list_id uuid references public.shopping_lists(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  name text not null,
  quantity text not null default '1',
  done boolean not null default false,
  created_at timestamptz not null default now()
);

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

alter table public.shopping_items
  add column if not exists list_id uuid references public.shopping_lists(id) on delete cascade;

insert into public.shopping_lists (family_id, created_by, name)
select si.family_id, min(si.created_by::text)::uuid, 'Liste principale'
from public.shopping_items si
where si.family_id is not null
  and not exists (
    select 1
    from public.shopping_lists sl
    where sl.family_id = si.family_id
  )
group by si.family_id;

update public.shopping_items si
set list_id = sl.id
from public.shopping_lists sl
where si.list_id is null
  and sl.family_id = si.family_id
  and sl.name = 'Liste principale';

alter table public.shopping_items
  alter column list_id set not null;

create index if not exists idx_family_members_user_id on public.family_members(user_id);
create index if not exists idx_family_members_family_id on public.family_members(family_id);
create index if not exists idx_family_invites_email on public.family_invites(email);
create index if not exists idx_shopping_lists_family_id on public.shopping_lists(family_id);
create index if not exists idx_shopping_items_family_id on public.shopping_items(family_id);
create index if not exists idx_shopping_items_list_id on public.shopping_items(list_id);
create index if not exists idx_family_calendar_connections_family_id on public.family_calendar_connections(family_id);
create index if not exists idx_family_calendar_events_family_id on public.family_calendar_events(family_id);
create index if not exists idx_family_calendar_events_start_at on public.family_calendar_events(start_at);
create index if not exists idx_family_children_family_id on public.family_children(family_id);
create index if not exists idx_family_child_planning_events_family_id on public.family_child_planning_events(family_id);
create index if not exists idx_family_child_planning_events_child_id on public.family_child_planning_events(child_id);
create index if not exists idx_family_child_planning_events_start_at on public.family_child_planning_events(start_at);

create or replace function public.is_family_member(target_family_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.family_members fm
    where fm.family_id = target_family_id
      and fm.user_id = auth.uid()
  );
$$;

create or replace function public.user_family_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select fm.family_id
  from public.family_members fm
  where fm.user_id = auth.uid()
  order by fm.joined_at desc
  limit 1;
$$;

create or replace function public.create_family(p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_family_id uuid;
  existing_family_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if coalesce(trim(p_name), '') = '' then
    raise exception 'Family name cannot be empty';
  end if;

  select public.user_family_id() into existing_family_id;
  if existing_family_id is not null then
    raise exception 'User already belongs to a family';
  end if;

  insert into public.families(name, created_by)
  values (trim(p_name), auth.uid())
  returning id into new_family_id;

  insert into public.family_members(family_id, user_id, role)
  values (new_family_id, auth.uid(), 'owner');

  return new_family_id;
end;
$$;

create or replace function public.create_family_invite(target_email text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  current_family_id uuid;
  invite_token text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if coalesce(trim(target_email), '') = '' then
    raise exception 'Target email cannot be empty';
  end if;

  select public.user_family_id() into current_family_id;
  if current_family_id is null then
    raise exception 'No family found for current user';
  end if;

  if not exists (
    select 1
    from public.family_members fm
    where fm.family_id = current_family_id
      and fm.user_id = auth.uid()
      and fm.role in ('owner', 'admin')
  ) then
    raise exception 'Only owners/admins can invite';
  end if;

  invite_token := gen_random_uuid()::text;

  insert into public.family_invites(family_id, email, invited_by, token, status)
  values (current_family_id, lower(trim(target_email)), auth.uid(), invite_token, 'pending');

  return invite_token;
end;
$$;

create or replace function public.accept_family_invite(invite_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  invite_row public.family_invites%rowtype;
  existing_family_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select *
  into invite_row
  from public.family_invites fi
  where fi.token = invite_token
    and fi.status = 'pending'
  order by fi.created_at desc
  limit 1;

  if invite_row.id is null then
    raise exception 'Invalid invite token';
  end if;

  select public.user_family_id() into existing_family_id;
  if existing_family_id is not null and existing_family_id <> invite_row.family_id then
    raise exception 'User already belongs to another family';
  end if;

  insert into public.family_members(family_id, user_id, role)
  values (invite_row.family_id, auth.uid(), 'member')
  on conflict (family_id, user_id) do nothing;

  update public.family_invites
  set status = 'accepted', accepted_at = now()
  where id = invite_row.id;

  return invite_row.family_id;
end;
$$;

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

alter table public.families enable row level security;
alter table public.family_members enable row level security;
alter table public.family_invites enable row level security;
alter table public.shopping_lists enable row level security;
alter table public.shopping_items enable row level security;
alter table public.family_calendar_connections enable row level security;
alter table public.family_calendar_events enable row level security;
alter table public.family_children enable row level security;
alter table public.family_child_planning_events enable row level security;

create policy "Family members can read families"
on public.families
for select
using (public.is_family_member(id));

create policy "Users can create families"
on public.families
for insert
with check (auth.uid() = created_by);

create policy "Family members can read member list"
on public.family_members
for select
using (public.is_family_member(family_id));

create policy "Users can insert themselves as members"
on public.family_members
for insert
with check (auth.uid() = user_id);

create policy "Owners/admins can update members"
on public.family_members
for update
using (
  exists (
    select 1
    from public.family_members fm
    where fm.family_id = family_members.family_id
      and fm.user_id = auth.uid()
      and fm.role in ('owner', 'admin')
  )
)
with check (
  exists (
    select 1
    from public.family_members fm
    where fm.family_id = family_members.family_id
      and fm.user_id = auth.uid()
      and fm.role in ('owner', 'admin')
  )
);

create policy "Owners/admins can create invites"
on public.family_invites
for insert
with check (
  exists (
    select 1
    from public.family_members fm
    where fm.family_id = family_invites.family_id
      and fm.user_id = auth.uid()
      and fm.role in ('owner', 'admin')
  )
);

create policy "Family members can read invites"
on public.family_invites
for select
using (public.is_family_member(family_id));

create policy "Owners/admins can update invites"
on public.family_invites
for update
using (
  exists (
    select 1
    from public.family_members fm
    where fm.family_id = family_invites.family_id
      and fm.user_id = auth.uid()
      and fm.role in ('owner', 'admin')
  )
)
with check (
  exists (
    select 1
    from public.family_members fm
    where fm.family_id = family_invites.family_id
      and fm.user_id = auth.uid()
      and fm.role in ('owner', 'admin')
  )
);

create policy "Family members can read shopping items"
on public.shopping_items
for select
using (public.is_family_member(family_id));

create policy "Family members can read shopping lists"
on public.shopping_lists
for select
using (public.is_family_member(family_id));

create policy "Family members can add shopping lists"
on public.shopping_lists
for insert
with check (public.is_family_member(family_id) and auth.uid() = created_by);

create policy "Family members can update shopping lists"
on public.shopping_lists
for update
using (public.is_family_member(family_id))
with check (public.is_family_member(family_id));

create policy "Family members can delete shopping lists"
on public.shopping_lists
for delete
using (public.is_family_member(family_id));

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

create policy "Family members can delete shopping items"
on public.shopping_items
for delete
using (public.is_family_member(family_id));

create policy "Family members can read family calendar connections"
on public.family_calendar_connections
for select
using (public.is_family_member(family_id));

create policy "Family members can create family calendar connections"
on public.family_calendar_connections
for insert
with check (public.is_family_member(family_id) and auth.uid() = created_by and is_read_only = true);

create policy "Family members can update family calendar connections"
on public.family_calendar_connections
for update
using (public.is_family_member(family_id))
with check (public.is_family_member(family_id) and is_read_only = true);

create policy "Family members can delete family calendar connections"
on public.family_calendar_connections
for delete
using (public.is_family_member(family_id));

create policy "Family members can read family calendar events"
on public.family_calendar_events
for select
using (public.is_family_member(family_id));

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

create policy "Family members can delete family calendar events"
on public.family_calendar_events
for delete
using (public.is_family_member(family_id));

create policy "Family members can read family children"
on public.family_children
for select
using (public.is_family_member(family_id));

create policy "Family members can add family children"
on public.family_children
for insert
with check (public.is_family_member(family_id) and auth.uid() = created_by);

create policy "Family members can update family children"
on public.family_children
for update
using (public.is_family_member(family_id))
with check (public.is_family_member(family_id));

create policy "Family members can delete family children"
on public.family_children
for delete
using (public.is_family_member(family_id));

create policy "Family members can read child planning events"
on public.family_child_planning_events
for select
using (public.is_family_member(family_id));

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

create policy "Family members can delete child planning events"
on public.family_child_planning_events
for delete
using (public.is_family_member(family_id));

grant execute on function public.create_family(text) to authenticated;
grant execute on function public.create_family_invite(text) to authenticated;
grant execute on function public.accept_family_invite(text) to authenticated;
grant execute on function public.user_family_id() to authenticated;