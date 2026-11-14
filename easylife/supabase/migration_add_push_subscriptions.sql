create table if not exists public.family_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  subscription jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_family_push_subscriptions_family_user
  on public.family_push_subscriptions(family_id, user_id);

alter table public.family_push_subscriptions enable row level security;
