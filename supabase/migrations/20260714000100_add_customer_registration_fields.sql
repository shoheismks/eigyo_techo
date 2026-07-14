alter table public.customers add column if not exists company_kana text;
alter table public.customers add column if not exists postal_code text;
alter table public.customers add column if not exists fax text;
alter table public.customers add column if not exists sales_owner text;
alter table public.customers add column if not exists importance_rank text;
alter table public.customers add column if not exists referral_source text;
alter table public.customers add column if not exists prospect_rank text;
alter table public.customers add column if not exists payment_terms text;
alter table public.customers add column if not exists closing_day text;
alter table public.customers add column if not exists delivery_destination text;
alter table public.customers add column if not exists billing_destination text;
alter table public.customers add column if not exists credit_memo text;

notify pgrst, 'reload schema';
