-- Calendar recurrence: weekdays, selected weekdays, and monthly day.

alter table public.events
  add column if not exists recurrence_weekdays jsonb not null default '[]'::jsonb;

alter table public.events
  add column if not exists recurrence_month_day integer;

alter table public.events
  drop constraint if exists events_recurrence_frequency_check;

alter table public.events
  add constraint events_recurrence_frequency_check
  check (
    recurrence_frequency in (
      'none',
      'daily',
      'weekly',
      'biweekly',
      'monthly',
      'weekdays',
      'weekday_select',
      'monthly_day'
    )
  );

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'events_recurrence_month_day_check'
  ) then
    alter table public.events
      add constraint events_recurrence_month_day_check
      check (recurrence_month_day is null or recurrence_month_day between 1 and 31);
  end if;
end $$;
