alter table public.quotes
  add column if not exists project_name text,
  add column if not exists quote_lines jsonb not null default '[]'::jsonb,
  add column if not exists issue_date date,
  add column if not exists freight numeric,
  add column if not exists discount numeric,
  add column if not exists tax_rate numeric default 10,
  add column if not exists subtotal numeric,
  add column if not exists tax_amount numeric,
  add column if not exists grand_total numeric,
  add column if not exists pdf_history jsonb not null default '[]'::jsonb,
  add column if not exists submitted_at timestamptz,
  add column if not exists accepted_at timestamptz,
  add column if not exists updated_by uuid,
  add column if not exists updated_by_name text;

create index if not exists quotes_user_status_idx on public.quotes(user_id, status);
create index if not exists quotes_user_valid_until_idx on public.quotes(user_id, valid_until);
create index if not exists quotes_user_quote_number_idx on public.quotes(user_id, quote_number);
create index if not exists quotes_quote_lines_gin_idx on public.quotes using gin (quote_lines);

grant select, insert, update, delete on public.quotes to authenticated;

select pg_notify('pgrst', 'reload schema');
