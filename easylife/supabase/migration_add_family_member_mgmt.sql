-- Migration: Ajout de la gestion avancée des membres de la famille
-- Fonctions : revoke_family_invite, get_family_members, get_family_pending_invites

-- Révoquer une invitation en attente (owner/admin seulement)
create or replace function public.revoke_family_invite(invite_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_family_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select public.user_family_id() into current_family_id;

  if not exists (
    select 1
    from public.family_members fm
    where fm.family_id = current_family_id
      and fm.user_id = auth.uid()
      and fm.role in ('owner', 'admin')
  ) then
    raise exception 'Only owners/admins can revoke invitations';
  end if;

  update public.family_invites fi
  set status = 'revoked'
  where fi.id = invite_id
    and fi.family_id = current_family_id
    and fi.status = 'pending';

  if not found then
    raise exception 'Invitation not found or already processed';
  end if;
end;
$$;

-- Lister les membres de la famille avec leurs informations utilisateur
create or replace function public.get_family_members()
returns table(
  id uuid,
  user_id uuid,
  role text,
  joined_at timestamptz,
  display_name text,
  email text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    fm.id,
    fm.user_id,
    fm.role,
    fm.joined_at,
    coalesce(u.raw_user_meta_data->>'display_name', '') as display_name,
    u.email
  from public.family_members fm
  join auth.users u on u.id = fm.user_id
  where fm.family_id = public.user_family_id()
  order by
    case fm.role when 'owner' then 0 when 'admin' then 1 else 2 end,
    fm.joined_at asc;
$$;

-- Lister les invitations en attente (owner/admin seulement)
create or replace function public.get_family_pending_invites()
returns table(
  id uuid,
  email text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select fi.id, fi.email, fi.created_at
  from public.family_invites fi
  where fi.family_id = public.user_family_id()
    and fi.status = 'pending'
    and exists (
      select 1 from public.family_members fm
      where fm.family_id = fi.family_id
        and fm.user_id = auth.uid()
        and fm.role in ('owner', 'admin')
    )
  order by fi.created_at desc;
$$;
