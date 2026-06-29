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

create table if not exists public.products (
  id text primary key,
  user_id uuid,
  name text,
  category text,
  manufacturer_name text,
  origin text,
  temperature_zone text,
  package_style text,
  tags jsonb,
  cost_price numeric,
  cost_unit text,
  desired_selling_price numeric,
  selling_price_unit text,
  gross_margin_rate text,
  description text,
  memo text,
  image_file jsonb,
  product_material_file jsonb,
  spec_sheet_file jsonb,
  attachments jsonb,
  created_at timestamptz,
  updated_at timestamptz
);

alter table public.products add column if not exists user_id uuid;
alter table public.products add column if not exists tags jsonb;
alter table public.products add column if not exists attachments jsonb;
alter table public.products enable row level security;

drop policy if exists "Allow authenticated read own products" on public.products;
create policy "Allow authenticated read own products" on public.products
for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Allow authenticated insert own products" on public.products;
create policy "Allow authenticated insert own products" on public.products
for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Allow authenticated update own products" on public.products;
create policy "Allow authenticated update own products" on public.products
for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Allow authenticated delete own products" on public.products;
create policy "Allow authenticated delete own products" on public.products
for delete to authenticated using (auth.uid() = user_id);

create table if not exists public.contacts (
  id text primary key,
  user_id uuid,
  customer_id text,
  company_name text,
  name text,
  department text,
  role text,
  company_size text,
  email text,
  phone text,
  memo text,
  tags jsonb,
  importance_score integer,
  importance_rank text,
  importance_reasons jsonb,
  created_at timestamptz,
  updated_at timestamptz
);

alter table public.contacts enable row level security;
drop policy if exists "Allow authenticated read own contacts" on public.contacts;
create policy "Allow authenticated read own contacts" on public.contacts
for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Allow authenticated insert own contacts" on public.contacts;
create policy "Allow authenticated insert own contacts" on public.contacts
for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Allow authenticated update own contacts" on public.contacts;
create policy "Allow authenticated update own contacts" on public.contacts
for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Allow authenticated delete own contacts" on public.contacts;
create policy "Allow authenticated delete own contacts" on public.contacts
for delete to authenticated using (auth.uid() = user_id);

create table if not exists public.suppliers (
  id text primary key,
  user_id uuid,
  name text,
  area text,
  address text,
  phone text,
  email text,
  website text,
  tags jsonb,
  memo text,
  deal_histories jsonb,
  created_at timestamptz,
  updated_at timestamptz
);

alter table public.suppliers enable row level security;
drop policy if exists "Allow authenticated read own suppliers" on public.suppliers;
create policy "Allow authenticated read own suppliers" on public.suppliers
for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Allow authenticated insert own suppliers" on public.suppliers;
create policy "Allow authenticated insert own suppliers" on public.suppliers
for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Allow authenticated update own suppliers" on public.suppliers;
create policy "Allow authenticated update own suppliers" on public.suppliers
for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Allow authenticated delete own suppliers" on public.suppliers;
create policy "Allow authenticated delete own suppliers" on public.suppliers
for delete to authenticated using (auth.uid() = user_id);

create table if not exists public.business_cards (
  id text primary key,
  user_id uuid,
  contact_id text,
  customer_id text,
  raw_text text,
  image_file jsonb,
  extracted jsonb,
  created_at timestamptz,
  updated_at timestamptz
);

alter table public.business_cards enable row level security;
drop policy if exists "Allow authenticated read own business_cards" on public.business_cards;
create policy "Allow authenticated read own business_cards" on public.business_cards
for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Allow authenticated insert own business_cards" on public.business_cards;
create policy "Allow authenticated insert own business_cards" on public.business_cards
for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Allow authenticated update own business_cards" on public.business_cards;
create policy "Allow authenticated update own business_cards" on public.business_cards
for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Allow authenticated delete own business_cards" on public.business_cards;
create policy "Allow authenticated delete own business_cards" on public.business_cards
for delete to authenticated using (auth.uid() = user_id);

create table if not exists public.complaints (
  id text primary key,
  user_id uuid,
  customer_id text,
  customer_name text,
  title text,
  status text,
  severity text,
  memo text,
  created_by uuid,
  created_by_name text,
  attachments jsonb,
  created_at timestamptz,
  updated_at timestamptz
);

alter table public.complaints enable row level security;
drop policy if exists "Allow authenticated read own complaints" on public.complaints;
create policy "Allow authenticated read own complaints" on public.complaints
for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Allow authenticated insert own complaints" on public.complaints;
create policy "Allow authenticated insert own complaints" on public.complaints
for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Allow authenticated update own complaints" on public.complaints;
create policy "Allow authenticated update own complaints" on public.complaints
for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Allow authenticated delete own complaints" on public.complaints;
create policy "Allow authenticated delete own complaints" on public.complaints
for delete to authenticated using (auth.uid() = user_id);

create table if not exists public.attachments (
  id text primary key,
  user_id uuid,
  owner_type text,
  owner_id text,
  field text,
  name text,
  content_type text,
  size_bytes integer,
  storage_bucket text,
  storage_path text,
  public_url text,
  metadata jsonb,
  created_at timestamptz,
  updated_at timestamptz
);

alter table public.attachments enable row level security;
drop policy if exists "Allow authenticated read own attachments" on public.attachments;
create policy "Allow authenticated read own attachments" on public.attachments
for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Allow authenticated insert own attachments" on public.attachments;
create policy "Allow authenticated insert own attachments" on public.attachments
for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Allow authenticated update own attachments" on public.attachments;
create policy "Allow authenticated update own attachments" on public.attachments
for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Allow authenticated delete own attachments" on public.attachments;
create policy "Allow authenticated delete own attachments" on public.attachments
for delete to authenticated using (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('app-attachments', 'app-attachments', true)
on conflict (id) do nothing;

drop policy if exists "Allow authenticated upload own app attachments" on storage.objects;
create policy "Allow authenticated upload own app attachments"
on storage.objects for insert to authenticated
with check (bucket_id = 'app-attachments' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "Allow authenticated read own app attachments" on storage.objects;
create policy "Allow authenticated read own app attachments"
on storage.objects for select to authenticated
using (bucket_id = 'app-attachments' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "Allow authenticated update own app attachments" on storage.objects;
create policy "Allow authenticated update own app attachments"
on storage.objects for update to authenticated
using (bucket_id = 'app-attachments' and auth.uid()::text = (storage.foldername(name))[1])
with check (bucket_id = 'app-attachments' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "Allow authenticated delete own app attachments" on storage.objects;
create policy "Allow authenticated delete own app attachments"
on storage.objects for delete to authenticated
using (bucket_id = 'app-attachments' and auth.uid()::text = (storage.foldername(name))[1]);
