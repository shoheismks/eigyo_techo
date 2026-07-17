alter table public.issuers
  add column if not exists default_quote_terms_summary text default 'Final confirmation will be based on a separate confirmation document and applicable terms.';

alter table public.quotes
  add column if not exists quote_terms_summary text default 'Final confirmation will be based on a separate confirmation document and applicable terms.',
  add column if not exists pdf_generated_by uuid,
  add column if not exists pdf_generated_by_name text default '',
  add column if not exists confirmation_pdf_url text default '',
  add column if not exists confirmation_pdf_file_name text default '',
  add column if not exists confirmation_pdf_storage_path text default '',
  add column if not exists confirmation_pdf_generated_at timestamptz,
  add column if not exists confirmation_generated_by uuid,
  add column if not exists confirmation_generated_by_name text default '',
  add column if not exists confirmation_pdf_history jsonb not null default '[]'::jsonb;

update public.issuers
set default_quote_terms_summary = 'Final confirmation will be based on a separate confirmation document and applicable terms.'
where default_quote_terms_summary is null or default_quote_terms_summary = '';

update public.quotes
set quote_terms_summary = 'Final confirmation will be based on a separate confirmation document and applicable terms.'
where quote_terms_summary is null or quote_terms_summary = '';

create index if not exists idx_quotes_confirmation_pdf_generated_at
  on public.quotes (confirmation_pdf_generated_at);

notify pgrst, 'reload schema';
