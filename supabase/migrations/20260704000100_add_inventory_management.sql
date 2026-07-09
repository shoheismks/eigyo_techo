-- Eigyo Techo Supabase migration: Step27 inventory management
-- Data preserving: creates inventories and extends quotes with inventory links.

create table if not exists public.inventories (
  id text primary key,
  user_id uuid,
  product_id text,
  supplier_id text,
  cost numeric,
  currency text,
  quantity numeric,
  unit text,
  stock_type text,
  owner text,
  inventory_status text,
  firm_deadline date,
  eta date,
  lot text,
  expiry_date date,
  memo text,
  created_by uuid,
  created_by_name text,
  created_at timestamptz,
  updated_at timestamptz
);

alter table public.inventories add column if not exists user_id uuid;
alter table public.inventories add column if not exists product_id text;
alter table public.inventories add column if not exists supplier_id text;
alter table public.inventories add column if not exists cost numeric;
alter table public.inventories add column if not exists currency text;
alter table public.inventories add column if not exists quantity numeric;
alter table public.inventories add column if not exists unit text;
alter table public.inventories add column if not exists stock_type text;
alter table public.inventories add column if not exists owner text;
alter table public.inventories add column if not exists inventory_status text;
alter table public.inventories add column if not exists firm_deadline date;
alter table public.inventories add column if not exists eta date;
alter table public.inventories add column if not exists lot text;
alter table public.inventories add column if not exists expiry_date date;
alter table public.inventories add column if not exists memo text;
alter table public.inventories add column if not exists created_by uuid;
alter table public.inventories add column if not exists created_by_name text;
alter table public.inventories add column if not exists created_at timestamptz;
alter table public.inventories add column if not exists updated_at timestamptz;

alter table public.quotes add column if not exists inventory_ids jsonb;
alter table public.quotes add column if not exists inventory_cost_total numeric;

create index if not exists idx_inventories_user_id on public.inventories (user_id);
create index if not exists idx_inventories_product_id on public.inventories (product_id);
create index if not exists idx_inventories_supplier_id on public.inventories (supplier_id);
create index if not exists idx_inventories_status on public.inventories (inventory_status);
create index if not exists idx_inventories_eta on public.inventories (eta);
create index if not exists idx_inventories_expiry_date on public.inventories (expiry_date);
create index if not exists idx_inventories_user_updated_at on public.inventories (user_id, updated_at desc);
create index if not exists idx_inventories_user_product_id on public.inventories (user_id, product_id);

alter table public.inventories enable row level security;

create or replace function pg_temp.eigyo_reset_inventory_policy(
  policy_name text,
  create_policy_sql text
) returns void
language plpgsql
as $$
begin
  execute format('drop policy if exists %I on public.inventories', policy_name);
  execute create_policy_sql;
end;
$$;

select pg_temp.eigyo_reset_inventory_policy(
  'Allow authenticated read own inventories',
  'create policy "Allow authenticated read own inventories" on public.inventories for select to authenticated using ((select auth.uid()) = user_id)'
);

select pg_temp.eigyo_reset_inventory_policy(
  'Allow authenticated insert own inventories',
  'create policy "Allow authenticated insert own inventories" on public.inventories for insert to authenticated with check ((select auth.uid()) = user_id)'
);

select pg_temp.eigyo_reset_inventory_policy(
  'Allow authenticated update own inventories',
  'create policy "Allow authenticated update own inventories" on public.inventories for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)'
);

select pg_temp.eigyo_reset_inventory_policy(
  'Allow authenticated delete own inventories',
  'create policy "Allow authenticated delete own inventories" on public.inventories for delete to authenticated using ((select auth.uid()) = user_id)'
);
