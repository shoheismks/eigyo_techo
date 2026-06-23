create table if not exists public.customers (
  id text primary key,
  place_id text,
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

alter table public.customers enable row level security;

create policy "Allow anon read customers"
on public.customers
for select
to anon
using (true);

create policy "Allow anon insert customers"
on public.customers
for insert
to anon
with check (true);

create policy "Allow anon update customers"
on public.customers
for update
to anon
using (true)
with check (true);

create policy "Allow anon delete customers"
on public.customers
for delete
to anon
using (true);
