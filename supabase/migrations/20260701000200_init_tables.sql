-- Eigyo Techo Supabase migration: tables
-- This migration keeps the current app-compatible schema.
-- IDs remain text because the React app currently generates string UUIDs client-side.

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

alter table public.customers add column if not exists user_id uuid;
alter table public.customers add column if not exists place_id text;
alter table public.customers add column if not exists corporate_number text;
alter table public.customers add column if not exists company_name text;
alter table public.customers add column if not exists industry text;
alter table public.customers add column if not exists area text;
alter table public.customers add column if not exists address text;
alter table public.customers add column if not exists phone text;
alter table public.customers add column if not exists website text;
alter table public.customers add column if not exists email text;
alter table public.customers add column if not exists email_type text;
alter table public.customers add column if not exists inquiry_url text;
alter table public.customers add column if not exists status text;
alter table public.customers add column if not exists tags jsonb;
alter table public.customers add column if not exists memo text;
alter table public.customers add column if not exists company_note text;
alter table public.customers add column if not exists next_follow_up_date date;
alter table public.customers add column if not exists is_do_not_contact boolean default false;
alter table public.customers add column if not exists do_not_contact_reason text;
alter table public.customers add column if not exists deal_histories jsonb;
alter table public.customers add column if not exists proposed_products jsonb;
alter table public.customers add column if not exists source text;
alter table public.customers add column if not exists contact_status text;
alter table public.customers add column if not exists last_contact_date date;
alter table public.customers add column if not exists next_follow_date date;
alter table public.customers add column if not exists pipeline_memo text;
alter table public.customers add column if not exists score integer;
alter table public.customers add column if not exists rank text;
alter table public.customers add column if not exists score_reasons jsonb;
alter table public.customers add column if not exists created_at timestamptz;
alter table public.customers add column if not exists updated_at timestamptz;

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
alter table public.mail_drafts add column if not exists customer_id text;
alter table public.mail_drafts add column if not exists customer_name text;
alter table public.mail_drafts add column if not exists title text;
alter table public.mail_drafts add column if not exists subject text;
alter table public.mail_drafts add column if not exists body text;
alter table public.mail_drafts add column if not exists product_name text;
alter table public.mail_drafts add column if not exists purpose text;
alter table public.mail_drafts add column if not exists source text;
alter table public.mail_drafts add column if not exists created_at timestamptz;
alter table public.mail_drafts add column if not exists updated_at timestamptz;

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
alter table public.products add column if not exists name text;
alter table public.products add column if not exists category text;
alter table public.products add column if not exists manufacturer_name text;
alter table public.products add column if not exists origin text;
alter table public.products add column if not exists temperature_zone text;
alter table public.products add column if not exists package_style text;
alter table public.products add column if not exists tags jsonb;
alter table public.products add column if not exists cost_price numeric;
alter table public.products add column if not exists cost_unit text;
alter table public.products add column if not exists desired_selling_price numeric;
alter table public.products add column if not exists selling_price_unit text;
alter table public.products add column if not exists gross_margin_rate text;
alter table public.products add column if not exists description text;
alter table public.products add column if not exists memo text;
alter table public.products add column if not exists image_file jsonb;
alter table public.products add column if not exists product_material_file jsonb;
alter table public.products add column if not exists spec_sheet_file jsonb;
alter table public.products add column if not exists attachments jsonb;
alter table public.products add column if not exists created_at timestamptz;
alter table public.products add column if not exists updated_at timestamptz;

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
  mobile text,
  decision_power text,
  memo text,
  tags jsonb,
  importance_score integer,
  importance_rank text,
  importance_reasons jsonb,
  created_at timestamptz,
  updated_at timestamptz
);

alter table public.contacts add column if not exists user_id uuid;
alter table public.contacts add column if not exists customer_id text;
alter table public.contacts add column if not exists company_name text;
alter table public.contacts add column if not exists name text;
alter table public.contacts add column if not exists department text;
alter table public.contacts add column if not exists role text;
alter table public.contacts add column if not exists company_size text;
alter table public.contacts add column if not exists email text;
alter table public.contacts add column if not exists phone text;
alter table public.contacts add column if not exists mobile text;
alter table public.contacts add column if not exists decision_power text;
alter table public.contacts add column if not exists memo text;
alter table public.contacts add column if not exists tags jsonb;
alter table public.contacts add column if not exists importance_score integer;
alter table public.contacts add column if not exists importance_rank text;
alter table public.contacts add column if not exists importance_reasons jsonb;
alter table public.contacts add column if not exists created_at timestamptz;
alter table public.contacts add column if not exists updated_at timestamptz;

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

alter table public.suppliers add column if not exists user_id uuid;
alter table public.suppliers add column if not exists name text;
alter table public.suppliers add column if not exists area text;
alter table public.suppliers add column if not exists address text;
alter table public.suppliers add column if not exists phone text;
alter table public.suppliers add column if not exists email text;
alter table public.suppliers add column if not exists website text;
alter table public.suppliers add column if not exists tags jsonb;
alter table public.suppliers add column if not exists memo text;
alter table public.suppliers add column if not exists deal_histories jsonb;
alter table public.suppliers add column if not exists created_at timestamptz;
alter table public.suppliers add column if not exists updated_at timestamptz;

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

alter table public.business_cards add column if not exists user_id uuid;
alter table public.business_cards add column if not exists contact_id text;
alter table public.business_cards add column if not exists customer_id text;
alter table public.business_cards add column if not exists raw_text text;
alter table public.business_cards add column if not exists image_file jsonb;
alter table public.business_cards add column if not exists extracted jsonb;
alter table public.business_cards add column if not exists created_at timestamptz;
alter table public.business_cards add column if not exists updated_at timestamptz;

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

alter table public.complaints add column if not exists user_id uuid;
alter table public.complaints add column if not exists customer_id text;
alter table public.complaints add column if not exists customer_name text;
alter table public.complaints add column if not exists title text;
alter table public.complaints add column if not exists status text;
alter table public.complaints add column if not exists severity text;
alter table public.complaints add column if not exists memo text;
alter table public.complaints add column if not exists created_by uuid;
alter table public.complaints add column if not exists created_by_name text;
alter table public.complaints add column if not exists attachments jsonb;
alter table public.complaints add column if not exists created_at timestamptz;
alter table public.complaints add column if not exists updated_at timestamptz;

create table if not exists public.samples (
  id text primary key,
  user_id uuid,
  customer_id text,
  contact_ids jsonb,
  product_ids jsonb,
  sample_name text,
  shipped_date date,
  arrival_date date,
  follow_up_date date,
  status text,
  feedback text,
  next_action text,
  shipping_method text,
  tracking_number text,
  memo text,
  created_by uuid,
  created_by_name text,
  created_at timestamptz,
  updated_at timestamptz
);

alter table public.samples add column if not exists user_id uuid;
alter table public.samples add column if not exists customer_id text;
alter table public.samples add column if not exists contact_ids jsonb;
alter table public.samples add column if not exists product_ids jsonb;
alter table public.samples add column if not exists sample_name text;
alter table public.samples add column if not exists shipped_date date;
alter table public.samples add column if not exists arrival_date date;
alter table public.samples add column if not exists follow_up_date date;
alter table public.samples add column if not exists status text;
alter table public.samples add column if not exists feedback text;
alter table public.samples add column if not exists next_action text;
alter table public.samples add column if not exists shipping_method text;
alter table public.samples add column if not exists tracking_number text;
alter table public.samples add column if not exists memo text;
alter table public.samples add column if not exists created_by uuid;
alter table public.samples add column if not exists created_by_name text;
alter table public.samples add column if not exists created_at timestamptz;
alter table public.samples add column if not exists updated_at timestamptz;

create table if not exists public.quotes (
  id text primary key,
  user_id uuid,
  customer_id text,
  supplier_id text,
  product_ids jsonb,
  contact_ids jsonb,
  quote_number text,
  submitted_date date,
  valid_until date,
  currency text,
  total_amount text,
  gross_margin_rate text,
  status text,
  file_url text,
  file_name text,
  memo text,
  lost_reason text,
  created_by uuid,
  created_by_name text,
  created_at timestamptz,
  updated_at timestamptz
);

alter table public.quotes add column if not exists user_id uuid;
alter table public.quotes add column if not exists customer_id text;
alter table public.quotes add column if not exists supplier_id text;
alter table public.quotes add column if not exists product_ids jsonb;
alter table public.quotes add column if not exists contact_ids jsonb;
alter table public.quotes add column if not exists quote_number text;
alter table public.quotes add column if not exists submitted_date date;
alter table public.quotes add column if not exists valid_until date;
alter table public.quotes add column if not exists currency text;
alter table public.quotes add column if not exists total_amount text;
alter table public.quotes add column if not exists gross_margin_rate text;
alter table public.quotes add column if not exists status text;
alter table public.quotes add column if not exists file_url text;
alter table public.quotes add column if not exists file_name text;
alter table public.quotes add column if not exists memo text;
alter table public.quotes add column if not exists lost_reason text;
alter table public.quotes add column if not exists created_by uuid;
alter table public.quotes add column if not exists created_by_name text;
alter table public.quotes add column if not exists created_at timestamptz;
alter table public.quotes add column if not exists updated_at timestamptz;

create table if not exists public.adoptions (
  id text primary key,
  user_id uuid,
  customer_id text,
  product_id text,
  adopted_date date,
  status text,
  monthly_volume text,
  selling_price text,
  unit text,
  gross_margin_rate text,
  memo text,
  created_at timestamptz,
  updated_at timestamptz
);

alter table public.adoptions add column if not exists user_id uuid;
alter table public.adoptions add column if not exists customer_id text;
alter table public.adoptions add column if not exists product_id text;
alter table public.adoptions add column if not exists adopted_date date;
alter table public.adoptions add column if not exists status text;
alter table public.adoptions add column if not exists monthly_volume text;
alter table public.adoptions add column if not exists selling_price text;
alter table public.adoptions add column if not exists unit text;
alter table public.adoptions add column if not exists gross_margin_rate text;
alter table public.adoptions add column if not exists memo text;
alter table public.adoptions add column if not exists created_at timestamptz;
alter table public.adoptions add column if not exists updated_at timestamptz;

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

alter table public.attachments add column if not exists user_id uuid;
alter table public.attachments add column if not exists owner_type text;
alter table public.attachments add column if not exists owner_id text;
alter table public.attachments add column if not exists field text;
alter table public.attachments add column if not exists name text;
alter table public.attachments add column if not exists content_type text;
alter table public.attachments add column if not exists size_bytes integer;
alter table public.attachments add column if not exists storage_bucket text;
alter table public.attachments add column if not exists storage_path text;
alter table public.attachments add column if not exists public_url text;
alter table public.attachments add column if not exists metadata jsonb;
alter table public.attachments add column if not exists created_at timestamptz;
alter table public.attachments add column if not exists updated_at timestamptz;
