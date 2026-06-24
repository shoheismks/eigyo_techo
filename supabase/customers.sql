create table if not exists public.customers (
  id text primary key,
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
  memo text,
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

alter table public.customers enable row level security;

drop policy if exists "Allow anon read customers" on public.customers;
create policy "Allow anon read customers"
on public.customers
for select
to anon
using (true);

drop policy if exists "Allow anon insert customers" on public.customers;
create policy "Allow anon insert customers"
on public.customers
for insert
to anon
with check (true);

drop policy if exists "Allow anon update customers" on public.customers;
create policy "Allow anon update customers"
on public.customers
for update
to anon
using (true)
with check (true);

drop policy if exists "Allow anon delete customers" on public.customers;
create policy "Allow anon delete customers"
on public.customers
for delete
to anon
using (true);

create table if not exists public.mail_drafts (
  id text primary key,
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

alter table public.mail_drafts enable row level security;

drop policy if exists "Allow anon read mail_drafts" on public.mail_drafts;
create policy "Allow anon read mail_drafts"
on public.mail_drafts
for select
to anon
using (true);

drop policy if exists "Allow anon insert mail_drafts" on public.mail_drafts;
create policy "Allow anon insert mail_drafts"
on public.mail_drafts
for insert
to anon
with check (true);

drop policy if exists "Allow anon update mail_drafts" on public.mail_drafts;
create policy "Allow anon update mail_drafts"
on public.mail_drafts
for update
to anon
using (true)
with check (true);

drop policy if exists "Allow anon delete mail_drafts" on public.mail_drafts;
create policy "Allow anon delete mail_drafts"
on public.mail_drafts
for delete
to anon
using (true);
