create table if not exists public.customers (
  id text primary key,
  user_id uuid,
  place_id text,
  corporate_number text,
  company_name text,
  industry text,
  area text,
  address text,
  phone text,
  website text,
  email text,
  email_type text,
  inquiry_url text,
  status text,
  tags jsonb,
  memo text,
  company_note text,
  next_follow_up_date date,
  is_do_not_contact boolean default false,
  do_not_contact_reason text,
  deal_histories jsonb,
  proposed_products jsonb,
  source text,
  contact_status text,
  last_contact_date date,
  next_follow_date date,
  pipeline_memo text,
  score integer,
  rank text,
  score_reasons jsonb,
  created_at timestamptz,
  updated_at timestamptz
);

alter table public.customers add column if not exists corporate_number text;
alter table public.customers add column if not exists user_id uuid;
alter table public.customers add column if not exists tags jsonb;
alter table public.customers add column if not exists company_note text;
alter table public.customers add column if not exists next_follow_up_date date;
alter table public.customers add column if not exists is_do_not_contact boolean default false;
alter table public.customers add column if not exists do_not_contact_reason text;
alter table public.customers add column if not exists deal_histories jsonb;
alter table public.customers add column if not exists proposed_products jsonb;

alter table public.customers enable row level security;

drop policy if exists "Allow anon read customers" on public.customers;
drop policy if exists "Allow authenticated read own customers" on public.customers;
create policy "Allow authenticated read own customers"
on public.customers
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Allow anon insert customers" on public.customers;
drop policy if exists "Allow authenticated insert own customers" on public.customers;
create policy "Allow authenticated insert own customers"
on public.customers
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Allow anon update customers" on public.customers;
drop policy if exists "Allow authenticated update own customers" on public.customers;
create policy "Allow authenticated update own customers"
on public.customers
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Allow anon delete customers" on public.customers;
drop policy if exists "Allow authenticated delete own customers" on public.customers;
create policy "Allow authenticated delete own customers"
on public.customers
for delete
to authenticated
using (auth.uid() = user_id);

create table if not exists public.mail_drafts (
  id text primary key,
  user_id uuid,
  customer_id text,
  customer_name text,
  title text,
  subject text,
  body text,
  product_name text,
  purpose text,
  source text,
  created_at timestamptz,
  updated_at timestamptz
);

alter table public.mail_drafts add column if not exists user_id uuid;

alter table public.mail_drafts enable row level security;

drop policy if exists "Allow anon read mail_drafts" on public.mail_drafts;
drop policy if exists "Allow authenticated read own mail_drafts" on public.mail_drafts;
create policy "Allow authenticated read own mail_drafts"
on public.mail_drafts
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Allow anon insert mail_drafts" on public.mail_drafts;
drop policy if exists "Allow authenticated insert own mail_drafts" on public.mail_drafts;
create policy "Allow authenticated insert own mail_drafts"
on public.mail_drafts
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Allow anon update mail_drafts" on public.mail_drafts;
drop policy if exists "Allow authenticated update own mail_drafts" on public.mail_drafts;
create policy "Allow authenticated update own mail_drafts"
on public.mail_drafts
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Allow anon delete mail_drafts" on public.mail_drafts;
drop policy if exists "Allow authenticated delete own mail_drafts" on public.mail_drafts;
create policy "Allow authenticated delete own mail_drafts"
on public.mail_drafts
for delete
to authenticated
using (auth.uid() = user_id);
