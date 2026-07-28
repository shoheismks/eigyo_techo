-- Repair production schema drift for calendar events and price history sync.
-- Safe to run multiple times and preserves existing data.

create table if not exists public.events (
  id text primary key,
  user_id uuid not null,
  title text not null default '',
  event_type text not null default 'other',
  customer_id text,
  contact_ids jsonb not null default '[]'::jsonb,
  deal_id text,
  project_id text,
  location text,
  start_at timestamptz,
  end_at timestamptz,
  all_day boolean not null default false,
  priority text not null default 'normal',
  color text not null default '#2878ff',
  memo text,
  next_follow_date date,
  reminder text,
  status text not null default 'scheduled',
  postponed_from_event_id text,
  postponed_original_start_at timestamptz,
  postponed_original_end_at timestamptz,
  completed_at timestamptz,
  created_by uuid,
  created_by_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.events add column if not exists user_id uuid;
alter table public.events add column if not exists title text not null default '';
alter table public.events add column if not exists event_type text not null default 'other';
alter table public.events add column if not exists customer_id text;
alter table public.events add column if not exists contact_ids jsonb not null default '[]'::jsonb;
alter table public.events add column if not exists deal_id text;
alter table public.events add column if not exists project_id text;
alter table public.events add column if not exists location text;
alter table public.events add column if not exists start_at timestamptz;
alter table public.events add column if not exists end_at timestamptz;
alter table public.events add column if not exists all_day boolean not null default false;
alter table public.events add column if not exists priority text not null default 'normal';
alter table public.events add column if not exists color text not null default '#2878ff';
alter table public.events add column if not exists memo text;
alter table public.events add column if not exists next_follow_date date;
alter table public.events add column if not exists reminder text;
alter table public.events add column if not exists status text not null default 'scheduled';
alter table public.events add column if not exists postponed_from_event_id text;
alter table public.events add column if not exists postponed_original_start_at timestamptz;
alter table public.events add column if not exists postponed_original_end_at timestamptz;
alter table public.events add column if not exists completed_at timestamptz;
alter table public.events add column if not exists created_by uuid;
alter table public.events add column if not exists created_by_name text;
alter table public.events add column if not exists created_at timestamptz not null default now();
alter table public.events add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_events_user_start_at on public.events (user_id, start_at);
create index if not exists idx_events_user_next_follow_date on public.events (user_id, next_follow_date);
create index if not exists idx_events_user_customer on public.events (user_id, customer_id);
create index if not exists idx_events_user_status on public.events (user_id, status);
create index if not exists idx_events_user_updated_at on public.events (user_id, updated_at desc);
create index if not exists idx_events_user_project on public.events (user_id, project_id);

alter table public.events enable row level security;

grant select, insert, update, delete on public.events to authenticated;

drop policy if exists "Allow authenticated read own events" on public.events;
drop policy if exists "Allow authenticated insert own events" on public.events;
drop policy if exists "Allow authenticated update own events" on public.events;
drop policy if exists "Allow authenticated delete own events" on public.events;

create policy "Allow authenticated read own events"
  on public.events
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Allow authenticated insert own events"
  on public.events
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Allow authenticated update own events"
  on public.events
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Allow authenticated delete own events"
  on public.events
  for delete to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.customer_product_price_history to authenticated;

create index if not exists customer_product_price_history_created_at_idx
  on public.customer_product_price_history (user_id, created_at desc);
