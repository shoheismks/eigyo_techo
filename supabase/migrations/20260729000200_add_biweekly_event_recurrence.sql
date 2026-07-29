-- Calendar recurrence: add biweekly frequency.

alter table public.events
  drop constraint if exists events_recurrence_frequency_check;

alter table public.events
  add constraint events_recurrence_frequency_check
  check (recurrence_frequency in ('none', 'daily', 'weekly', 'biweekly', 'monthly'));
