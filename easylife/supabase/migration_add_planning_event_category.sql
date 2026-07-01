-- Add activity category to children planning events (idempotent).

alter table public.family_child_planning_events
add column if not exists category text;

update public.family_child_planning_events
set category = 'autre'
where category is null;

alter table public.family_child_planning_events
alter column category set default 'autre';

alter table public.family_child_planning_events
alter column category set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'family_child_planning_events_category_check'
  ) then
    alter table public.family_child_planning_events
    add constraint family_child_planning_events_category_check
    check (category in ('sport', 'ecole', 'autre'));
  end if;
end
$$;

create index if not exists idx_family_child_planning_events_category
on public.family_child_planning_events(category);
