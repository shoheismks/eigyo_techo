create table if not exists public.customer_product_prices (
  id text primary key,
  user_id uuid not null,
  customer_id text,
  parent_customer_id text,
  product_id text,
  brand_id text,
  price_type text not null default 'regular',
  unit_price numeric,
  price_unit text not null default 'kg',
  currency text not null default 'JPY',
  tax_rate numeric default 8,
  minimum_quantity numeric,
  maximum_quantity numeric,
  valid_from date,
  valid_to date,
  priority integer not null default 0,
  notes text not null default '',
  apply_to_child_customers boolean not null default false,
  office_scope text not null default 'customer',
  case_price numeric,
  kg_price numeric,
  piece_price numeric,
  pack_price numeric,
  is_active boolean not null default true,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_product_prices_type_check check (price_type in ('regular', 'special', 'campaign', 'contract', 'spot', 'sample', 'other')),
  constraint customer_product_prices_unit_check check (price_unit in ('kg', 'case', 'piece', 'pack', 'unit')),
  constraint customer_product_prices_qty_check check (minimum_quantity is null or maximum_quantity is null or minimum_quantity <= maximum_quantity),
  constraint customer_product_prices_period_check check (valid_from is null or valid_to is null or valid_from <= valid_to)
);

create table if not exists public.customer_product_price_history (
  id text primary key,
  user_id uuid not null,
  customer_product_price_id text not null,
  action text not null,
  before_data jsonb,
  after_data jsonb,
  reason text not null default '',
  changed_by uuid,
  created_at timestamptz not null default now()
);

alter table if exists public.sales_order_lines
  add column if not exists original_unit_price numeric,
  add column if not exists price_source text,
  add column if not exists price_type text,
  add column if not exists price_master_id text,
  add column if not exists price_unit text,
  add column if not exists price_valid_from date,
  add column if not exists price_valid_to date,
  add column if not exists price_matched_rule text,
  add column if not exists price_warning text,
  add column if not exists is_manual_price boolean not null default false,
  add column if not exists price_override_reason text,
  add column if not exists price_overridden_at timestamptz;

create index if not exists customer_product_prices_user_customer_idx
  on public.customer_product_prices (user_id, customer_id)
  where deleted_at is null;

create index if not exists customer_product_prices_user_product_idx
  on public.customer_product_prices (user_id, product_id)
  where deleted_at is null;

create index if not exists customer_product_prices_user_period_idx
  on public.customer_product_prices (user_id, valid_from, valid_to)
  where deleted_at is null;

create index if not exists customer_product_prices_parent_scope_idx
  on public.customer_product_prices (user_id, parent_customer_id, apply_to_child_customers)
  where deleted_at is null;

create index if not exists customer_product_price_history_price_idx
  on public.customer_product_price_history (user_id, customer_product_price_id, created_at desc);

create unique index if not exists customer_product_prices_exact_unique_idx
  on public.customer_product_prices (
    user_id,
    coalesce(customer_id, ''),
    coalesce(product_id, ''),
    coalesce(price_unit, ''),
    coalesce(minimum_quantity, -1),
    coalesce(maximum_quantity, -1),
    coalesce(valid_from, date '1900-01-01'),
    coalesce(valid_to, date '9999-12-31'),
    priority
  )
  where deleted_at is null;

alter table public.customer_product_prices enable row level security;
alter table public.customer_product_price_history enable row level security;

grant select, insert, update, delete on public.customer_product_prices to authenticated;
grant select, insert, update, delete on public.customer_product_price_history to authenticated;

drop policy if exists "customer_product_prices_select_own" on public.customer_product_prices;
create policy "customer_product_prices_select_own"
  on public.customer_product_prices
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "customer_product_prices_insert_own" on public.customer_product_prices;
create policy "customer_product_prices_insert_own"
  on public.customer_product_prices
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "customer_product_prices_update_own" on public.customer_product_prices;
create policy "customer_product_prices_update_own"
  on public.customer_product_prices
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "customer_product_prices_delete_own" on public.customer_product_prices;
create policy "customer_product_prices_delete_own"
  on public.customer_product_prices
  for delete to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "customer_product_price_history_select_own" on public.customer_product_price_history;
create policy "customer_product_price_history_select_own"
  on public.customer_product_price_history
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "customer_product_price_history_insert_own" on public.customer_product_price_history;
create policy "customer_product_price_history_insert_own"
  on public.customer_product_price_history
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "customer_product_price_history_update_own" on public.customer_product_price_history;
create policy "customer_product_price_history_update_own"
  on public.customer_product_price_history
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "customer_product_price_history_delete_own" on public.customer_product_price_history;
create policy "customer_product_price_history_delete_own"
  on public.customer_product_price_history
  for delete to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.resolve_customer_product_price(
  p_customer_id text,
  p_product_id text,
  p_quantity numeric default null,
  p_price_unit text default null,
  p_target_date date default current_date
)
returns table (
  unit_price numeric,
  price_type text,
  price_master_id text,
  price_source text,
  price_unit text,
  valid_from date,
  valid_to date,
  matched_rule text,
  warning text
)
language sql
stable
set search_path = public
as $$
  with current_customer as (
    select id, parent_customer_id
    from public.customers
    where id = p_customer_id
      and user_id = (select auth.uid())
    limit 1
  ),
  candidates as (
    select
      cpp.*,
      case
        when cpp.customer_id = p_customer_id then 400
        when cpp.apply_to_child_customers = true and cpp.customer_id = (select parent_customer_id from current_customer) then 300
        when cpp.parent_customer_id is not null and cpp.parent_customer_id = (select parent_customer_id from current_customer) then 200
        else 0
      end as scope_rank
    from public.customer_product_prices cpp
    where cpp.user_id = (select auth.uid())
      and cpp.deleted_at is null
      and cpp.is_active = true
      and cpp.product_id = p_product_id
      and (p_price_unit is null or cpp.price_unit = p_price_unit)
      and (cpp.valid_from is null or cpp.valid_from <= p_target_date)
      and (cpp.valid_to is null or cpp.valid_to >= p_target_date)
      and (p_quantity is null or cpp.minimum_quantity is null or cpp.minimum_quantity <= p_quantity)
      and (p_quantity is null or cpp.maximum_quantity is null or cpp.maximum_quantity >= p_quantity)
  ),
  ranked as (
    select *
    from candidates
    where scope_rank > 0
    order by
      scope_rank desc,
      case when valid_from is not null or valid_to is not null then 1 else 0 end desc,
      case when minimum_quantity is not null or maximum_quantity is not null then 1 else 0 end desc,
      priority desc,
      valid_from desc nulls last,
      updated_at desc
    limit 1
  ),
  product_fallback as (
    select desired_selling_price, selling_price_unit
    from public.products
    where id = p_product_id
      and user_id = (select auth.uid())
    limit 1
  )
  select
    coalesce((select unit_price from ranked), (select desired_selling_price from product_fallback)) as unit_price,
    coalesce((select price_type from ranked), 'standard') as price_type,
    coalesce((select id from ranked), '') as price_master_id,
    case
      when exists(select 1 from ranked where customer_id = p_customer_id) then 'customer_price'
      when exists(select 1 from ranked where apply_to_child_customers = true) then 'head_office_price'
      when exists(select 1 from ranked) then 'customer_group_price'
      when exists(select 1 from product_fallback where desired_selling_price is not null) then 'product_standard'
      else 'none'
    end as price_source,
    coalesce((select price_unit from ranked), (select selling_price_unit from product_fallback), p_price_unit, 'kg') as price_unit,
    (select valid_from from ranked) as valid_from,
    (select valid_to from ranked) as valid_to,
    coalesce((select notes from ranked), '') as matched_rule,
    '' as warning;
$$;

revoke all on function public.resolve_customer_product_price(text, text, numeric, text, date) from public, anon;
grant execute on function public.resolve_customer_product_price(text, text, numeric, text, date) to authenticated;
