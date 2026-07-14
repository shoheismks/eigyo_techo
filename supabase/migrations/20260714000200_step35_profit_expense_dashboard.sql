alter table public.quotes
  add column if not exists storage_fee numeric,
  add column if not exists customs_fee numeric,
  add column if not exists inspection_fee numeric,
  add column if not exists processing_fee numeric,
  add column if not exists sales_commission numeric,
  add column if not exists disposal_loss numeric,
  add column if not exists fx_gain_loss numeric,
  add column if not exists other_expense numeric,
  add column if not exists common_expense_amount numeric,
  add column if not exists allocation_basis text default 'sales',
  add column if not exists expense_memo text;

create index if not exists quotes_user_allocation_basis_idx on public.quotes(user_id, allocation_basis);

grant select, insert, update, delete on public.quotes to authenticated;

select pg_notify('pgrst', 'reload schema');
