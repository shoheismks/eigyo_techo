-- Eigyo Techo Supabase migration: Step28 quote PDF fields
-- Data preserving: extends quote records for PDF generation and financial details.

alter table public.quotes add column if not exists quantity numeric;
alter table public.quotes add column if not exists unit_price numeric;
alter table public.quotes add column if not exists unit text;
alter table public.quotes add column if not exists cost_price numeric;
alter table public.quotes add column if not exists gross_margin_amount numeric;
alter table public.quotes add column if not exists pdf_url text;
alter table public.quotes add column if not exists pdf_file_name text;
alter table public.quotes add column if not exists pdf_storage_path text;
alter table public.quotes add column if not exists pdf_generated_at timestamptz;
alter table public.quotes add column if not exists payment_terms text;
alter table public.quotes add column if not exists delivery_terms text;
alter table public.quotes add column if not exists remarks text;

create index if not exists idx_quotes_user_pdf_generated_at on public.quotes (user_id, pdf_generated_at desc);
