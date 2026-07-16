-- Eigyo Techo: quote issuer master and quote issuer snapshots.

create table if not exists public.issuers (
  id text primary key,
  user_id uuid not null,
  name text not null default '',
  legal_name text default '',
  logo_url text default '',
  logo_file_name text default '',
  logo_storage_path text default '',
  address text default '',
  phone text default '',
  email text default '',
  registration_number text default '',
  bank_account text default '',
  contact_person text default '',
  seal_url text default '',
  seal_file_name text default '',
  seal_storage_path text default '',
  default_tax_rate numeric default 10,
  default_payment_terms text default '',
  default_delivery_terms text default '',
  default_remarks text default '',
  default_pdf_template text default 'standard',
  is_default boolean default false,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.customers
  add column if not exists default_issuer_id text;

alter table public.projects
  add column if not exists default_issuer_id text;

alter table public.quotes
  add column if not exists project_id text,
  add column if not exists issuer_id text,
  add column if not exists issuer_snapshot jsonb,
  add column if not exists pdf_template text default 'standard';

create index if not exists idx_issuers_user_id on public.issuers (user_id);
create index if not exists idx_issuers_active on public.issuers (user_id, is_active);
create index if not exists idx_issuers_default on public.issuers (user_id, is_default) where is_default = true;
create index if not exists idx_customers_default_issuer_id on public.customers (default_issuer_id);
create index if not exists idx_projects_default_issuer_id on public.projects (default_issuer_id);
create index if not exists idx_quotes_issuer_id on public.quotes (issuer_id);
create index if not exists idx_quotes_project_id on public.quotes (project_id);

alter table public.issuers enable row level security;

grant select, insert, update, delete on table public.issuers to authenticated;

drop policy if exists "Allow authenticated read own issuers" on public.issuers;
create policy "Allow authenticated read own issuers"
on public.issuers for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Allow authenticated insert own issuers" on public.issuers;
create policy "Allow authenticated insert own issuers"
on public.issuers for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Allow authenticated update own issuers" on public.issuers;
create policy "Allow authenticated update own issuers"
on public.issuers for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Allow authenticated delete own issuers" on public.issuers;
create policy "Allow authenticated delete own issuers"
on public.issuers for delete
to authenticated
using (auth.uid() = user_id);

update public.quotes
set pdf_template = coalesce(pdf_template, 'standard')
where pdf_template is null;
