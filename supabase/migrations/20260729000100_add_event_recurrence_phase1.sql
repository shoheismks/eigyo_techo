-- Calendar recurrence Phase 1.
-- Stores one master event and expands occurrences in the client for the visible range.

alter table public.events
  add column if not exists recurrence_frequency text not null default 'none';

alter table public.events
  add column if not exists recurrence_end_type text not null default 'none';

alter table public.events
  add column if not exists recurrence_end_date date;

update public.events
set recurrence_frequency = 'none'
where recurrence_frequency is null or recurrence_frequency = '';

update public.events
set recurrence_end_type = case
  when recurrence_end_date is not null then 'date'
  else 'none'
end
where recurrence_end_type is null or recurrence_end_type = '';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'events_recurrence_frequency_check'
  ) then
    alter table public.events
      add constraint events_recurrence_frequency_check
      check (recurrence_frequency in ('none', 'daily', 'weekly', 'monthly'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'events_recurrence_end_type_check'
  ) then
    alter table public.events
      add constraint events_recurrence_end_type_check
      check (recurrence_end_type in ('none', 'date'));
  end if;
end $$;

create index if not exists idx_events_user_recurrence
  on public.events (user_id, recurrence_frequency, recurrence_end_date)
  where recurrence_frequency <> 'none';

grant select, insert, update, delete on public.events to authenticated;
