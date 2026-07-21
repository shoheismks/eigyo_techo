alter table if exists public.issuers
  add column if not exists default_invoice_due_days integer default 30,
  add column if not exists default_invoice_remarks text default '',
  add column if not exists default_transfer_fee_text text default '',
  add column if not exists invoice_rounding_mode text default 'round',
  add column if not exists invoice_number_rule text default 'INV-{YYYY}-{000000}',
  add column if not exists invoice_pdf_settings jsonb default '{}'::jsonb,
  add column if not exists default_bank_name text default '',
  add column if not exists default_bank_branch text default '',
  add column if not exists default_bank_account_type text default '',
  add column if not exists default_bank_account_number text default '',
  add column if not exists default_bank_account_holder text default '';

create table if not exists public.invoices (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  invoice_number text,
  issue_date date,
  invoice_date date,
  due_date date,
  transaction_date date,
  customer_id uuid,
  contact_id uuid,
  project_id uuid,
  quote_id uuid,
  confirmation_quote_id uuid,
  issuer_id uuid,
  subject text default '',
  billing_name text default '',
  billing_address text default '',
  billing_department text default '',
  billing_contact_name text default '',
  issuer_snapshot jsonb default '{}'::jsonb,
  customer_snapshot jsonb default '{}'::jsonb,
  source_quote_snapshot jsonb default '{}'::jsonb,
  source_confirmation_snapshot jsonb default '{}'::jsonb,
  bank_snapshot jsonb default '{}'::jsonb,
  payment_terms text default '',
  transfer_fee_text text default '',
  remarks text default '',
  status text default 'draft',
  status_history jsonb default '[]'::jsonb,
  invoice_lines jsonb default '[]'::jsonb,
  subtotal numeric default 0,
  tax_amount numeric default 0,
  tax_breakdown jsonb default '[]'::jsonb,
  grand_total numeric default 0,
  paid_amount numeric default 0,
  unpaid_amount numeric default 0,
  payments jsonb default '[]'::jsonb,
  invoice_pdf_url text default '',
  invoice_pdf_file_name text default '',
  invoice_pdf_storage_path text default '',
  invoice_pdf_generated_at timestamptz,
  invoice_pdf_history jsonb default '[]'::jsonb,
  created_by uuid,
  created_by_name text default '',
  updated_by uuid,
  updated_by_name text default '',
  is_deleted boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.invoice_lines (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  product_id uuid,
  inventory_id uuid,
  line_snapshot jsonb default '{}'::jsonb,
  sort_order integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.invoice_payments (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  paid_at date,
  amount numeric default 0,
  method text default '',
  memo text default '',
  created_by uuid,
  created_by_name text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.invoice_history (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  history_type text not null,
  payload jsonb default '{}'::jsonb,
  created_by uuid,
  created_by_name text default '',
  created_at timestamptz default now()
);

create unique index if not exists invoices_user_invoice_number_unique
  on public.invoices (user_id, lower(invoice_number))
  where invoice_number is not null and invoice_number <> '' and is_deleted = false;

create index if not exists invoices_user_due_date_idx on public.invoices (user_id, due_date);
create index if not exists invoices_user_status_idx on public.invoices (user_id, status);
create index if not exists invoices_customer_idx on public.invoices (customer_id);
create index if not exists invoices_project_idx on public.invoices (project_id);
create index if not exists invoice_lines_invoice_idx on public.invoice_lines (invoice_id);
create index if not exists invoice_payments_invoice_idx on public.invoice_payments (invoice_id);
create index if not exists invoice_history_invoice_idx on public.invoice_history (invoice_id);

alter table public.invoices enable row level security;
alter table public.invoice_lines enable row level security;
alter table public.invoice_payments enable row level security;
alter table public.invoice_history enable row level security;

grant select, insert, update, delete on public.invoices to authenticated;
grant select, insert, update, delete on public.invoice_lines to authenticated;
grant select, insert, update, delete on public.invoice_payments to authenticated;
grant select, insert on public.invoice_history to authenticated;

drop policy if exists "Allow authenticated select own invoices" on public.invoices;
create policy "Allow authenticated select own invoices"
on public.invoices for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Allow authenticated insert own invoices" on public.invoices;
create policy "Allow authenticated insert own invoices"
on public.invoices for insert to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Allow authenticated update own invoices" on public.invoices;
create policy "Allow authenticated update own invoices"
on public.invoices for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Allow authenticated delete own invoices" on public.invoices;
create policy "Allow authenticated delete own invoices"
on public.invoices for delete to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Allow authenticated select own invoice lines" on public.invoice_lines;
create policy "Allow authenticated select own invoice lines"
on public.invoice_lines for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Allow authenticated insert own invoice lines" on public.invoice_lines;
create policy "Allow authenticated insert own invoice lines"
on public.invoice_lines for insert to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Allow authenticated update own invoice lines" on public.invoice_lines;
create policy "Allow authenticated update own invoice lines"
on public.invoice_lines for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Allow authenticated delete own invoice lines" on public.invoice_lines;
create policy "Allow authenticated delete own invoice lines"
on public.invoice_lines for delete to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Allow authenticated select own invoice payments" on public.invoice_payments;
create policy "Allow authenticated select own invoice payments"
on public.invoice_payments for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Allow authenticated insert own invoice payments" on public.invoice_payments;
create policy "Allow authenticated insert own invoice payments"
on public.invoice_payments for insert to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Allow authenticated update own invoice payments" on public.invoice_payments;
create policy "Allow authenticated update own invoice payments"
on public.invoice_payments for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Allow authenticated delete own invoice payments" on public.invoice_payments;
create policy "Allow authenticated delete own invoice payments"
on public.invoice_payments for delete to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Allow authenticated select own invoice history" on public.invoice_history;
create policy "Allow authenticated select own invoice history"
on public.invoice_history for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Allow authenticated insert own invoice history" on public.invoice_history;
create policy "Allow authenticated insert own invoice history"
on public.invoice_history for insert to authenticated
with check ((select auth.uid()) = user_id);

notify pgrst, 'reload schema';
