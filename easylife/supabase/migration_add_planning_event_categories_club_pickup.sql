-- Extend children planning event categories with club and pick up time.

alter table public.family_child_planning_events
drop constraint if exists family_child_planning_events_category_check;

alter table public.family_child_planning_events
add constraint family_child_planning_events_category_check
check (category in ('sport', 'ecole', 'club', 'pick_up_time', 'autre'));