create table if not exists public.projects (
  id text primary key,
  user_id uuid,
  title text not null default '',
  customer_id text,
  supplier_id text,
  contact_ids jsonb not null default '[]'::jsonb,
  type text not null default '新規提案',
  status text not null default 'リード',
  priority text not null default '通常',
  owner_user_id text,
  product_ids jsonb not null default '[]'::jsonb,
  inventory_ids jsonb not null default '[]'::jsonb,
  quote_ids jsonb not null default '[]'::jsonb,
  sample_ids jsonb not null default '[]'::jsonb,
  complaint_ids jsonb not null default '[]'::jsonb,
  start_date date,
  expected_close_date date,
  next_action_date date,
  expected_sales numeric,
  expected_gross_profit numeric,
  expected_operating_profit numeric,
  memo text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint projects_customer_or_supplier_check check (
    nullif(customer_id, '') is not null or nullif(supplier_id, '') is not null
  )
);

alter table public.projects add column if not exists user_id uuid;
alter table public.projects add column if not exists title text not null default '';
alter table public.projects add column if not exists customer_id text;
alter table public.projects add column if not exists supplier_id text;
alter table public.projects add column if not exists contact_ids jsonb not null default '[]'::jsonb;
alter table public.projects add column if not exists type text not null default '新規提案';
alter table public.projects add column if not exists status text not null default 'リード';
alter table public.projects add column if not exists priority text not null default '通常';
alter table public.projects add column if not exists owner_user_id text;
alter table public.projects add column if not exists product_ids jsonb not null default '[]'::jsonb;
alter table public.projects add column if not exists inventory_ids jsonb not null default '[]'::jsonb;
alter table public.projects add column if not exists quote_ids jsonb not null default '[]'::jsonb;
alter table public.projects add column if not exists sample_ids jsonb not null default '[]'::jsonb;
alter table public.projects add column if not exists complaint_ids jsonb not null default '[]'::jsonb;
alter table public.projects add column if not exists start_date date;
alter table public.projects add column if not exists expected_close_date date;
alter table public.projects add column if not exists next_action_date date;
alter table public.projects add column if not exists expected_sales numeric;
alter table public.projects add column if not exists expected_gross_profit numeric;
alter table public.projects add column if not exists expected_operating_profit numeric;
alter table public.projects add column if not exists memo text;
alter table public.projects add column if not exists created_by text;
alter table public.projects add column if not exists created_at timestamptz not null default now();
alter table public.projects add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if to_regclass('public.quotes') is not null then
    alter table public.quotes add column if not exists project_id text;
  end if;
  if to_regclass('public.samples') is not null then
    alter table public.samples add column if not exists project_id text;
  end if;
  if to_regclass('public.complaints') is not null then
    alter table public.complaints add column if not exists project_id text;
  end if;
  if to_regclass('public.events') is not null then
    alter table public.events add column if not exists project_id text;
  end if;
  if to_regclass('public.attachments') is not null then
    alter table public.attachments add column if not exists project_id text;
  end if;
end $$;

create index if not exists projects_user_id_idx on public.projects(user_id);
create index if not exists projects_customer_id_idx on public.projects(customer_id);
create index if not exists projects_supplier_id_idx on public.projects(supplier_id);
create index if not exists projects_status_idx on public.projects(status);
create index if not exists projects_next_action_date_idx on public.projects(next_action_date);

alter table public.projects enable row level security;

drop policy if exists "Allow authenticated select own projects" on public.projects;
create policy "Allow authenticated select own projects"
on public.projects for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Allow authenticated insert own projects" on public.projects;
create policy "Allow authenticated insert own projects"
on public.projects for insert to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Allow authenticated update own projects" on public.projects;
create policy "Allow authenticated update own projects"
on public.projects for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Allow authenticated delete own projects" on public.projects;
create policy "Allow authenticated delete own projects"
on public.projects for delete to authenticated
using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.projects to authenticated;

notify pgrst, 'reload schema';
