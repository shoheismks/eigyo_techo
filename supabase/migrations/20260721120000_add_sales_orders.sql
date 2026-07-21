create table if not exists public.sales_orders (
  id text primary key,
  user_id uuid not null,
  sales_order_number text,
  issuer_id text,
  issuer_snapshot jsonb,
  customer_id text,
  customer_snapshot jsonb,
  contact_id text,
  project_id text,
  quote_id text,
  confirmation_quote_id text,
  source_type text not null default 'manual',
  source_snapshot jsonb,
  subject text default '',
  order_date date,
  expected_delivery_date date,
  status text not null default '下書き',
  currency text not null default 'JPY',
  subtotal numeric default 0,
  tax_amount numeric default 0,
  grand_total numeric default 0,
  memo text default '',
  created_by uuid,
  created_by_name text default '',
  updated_by uuid,
  updated_by_name text default '',
  confirmed_at timestamptz,
  is_deleted boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sales_orders_source_type_check check (source_type in ('manual', 'quote', 'confirmation')),
  constraint sales_orders_status_check check (status in ('下書き', '受注確定', '変更中', '完了', '取消'))
);

create table if not exists public.sales_order_lines (
  id text primary key,
  user_id uuid not null,
  sales_order_id text not null references public.sales_orders(id) on delete cascade,
  product_id text,
  inventory_id text,
  line_number integer not null default 1,
  product_code text default '',
  product_name text default '',
  specification text default '',
  temperature_zone text default '',
  expiration_text text default '',
  quantity numeric,
  unit text default '',
  unit_price numeric,
  tax_rate numeric,
  amount numeric default 0,
  tax_amount numeric default 0,
  tax_included_amount numeric default 0,
  memo text default '',
  source_line_snapshot jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sales_order_history (
  id text primary key,
  user_id uuid not null,
  sales_order_id text not null references public.sales_orders(id) on delete cascade,
  event_type text not null default 'updated',
  summary text default '',
  before_snapshot jsonb,
  after_snapshot jsonb,
  created_by uuid,
  created_by_name text default '',
  created_at timestamptz not null default now()
);

create unique index if not exists sales_orders_user_issuer_number_unique
  on public.sales_orders (user_id, coalesce(issuer_id, ''), lower(sales_order_number))
  where sales_order_number is not null and sales_order_number <> '' and is_deleted = false;

create index if not exists sales_orders_user_customer_idx on public.sales_orders (user_id, customer_id);
create index if not exists sales_orders_user_project_idx on public.sales_orders (user_id, project_id);
create index if not exists sales_orders_user_quote_idx on public.sales_orders (user_id, quote_id);
create index if not exists sales_orders_user_confirmation_idx on public.sales_orders (user_id, confirmation_quote_id);
create index if not exists sales_orders_user_updated_idx on public.sales_orders (user_id, updated_at desc);
create index if not exists sales_order_lines_order_idx on public.sales_order_lines (user_id, sales_order_id, line_number);
create index if not exists sales_order_history_order_idx on public.sales_order_history (user_id, sales_order_id, created_at desc);

alter table public.sales_orders enable row level security;
alter table public.sales_order_lines enable row level security;
alter table public.sales_order_history enable row level security;

drop policy if exists "sales_orders_select_own" on public.sales_orders;
create policy "sales_orders_select_own"
  on public.sales_orders
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "sales_orders_insert_own" on public.sales_orders;
create policy "sales_orders_insert_own"
  on public.sales_orders
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "sales_orders_update_own" on public.sales_orders;
create policy "sales_orders_update_own"
  on public.sales_orders
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "sales_orders_delete_own" on public.sales_orders;
create policy "sales_orders_delete_own"
  on public.sales_orders
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "sales_order_lines_select_own" on public.sales_order_lines;
create policy "sales_order_lines_select_own"
  on public.sales_order_lines
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "sales_order_lines_insert_own" on public.sales_order_lines;
create policy "sales_order_lines_insert_own"
  on public.sales_order_lines
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "sales_order_lines_update_own" on public.sales_order_lines;
create policy "sales_order_lines_update_own"
  on public.sales_order_lines
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "sales_order_lines_delete_own" on public.sales_order_lines;
create policy "sales_order_lines_delete_own"
  on public.sales_order_lines
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "sales_order_history_select_own" on public.sales_order_history;
create policy "sales_order_history_select_own"
  on public.sales_order_history
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "sales_order_history_insert_own" on public.sales_order_history;
create policy "sales_order_history_insert_own"
  on public.sales_order_history
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "sales_order_history_update_own" on public.sales_order_history;
create policy "sales_order_history_update_own"
  on public.sales_order_history
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "sales_order_history_delete_own" on public.sales_order_history;
create policy "sales_order_history_delete_own"
  on public.sales_order_history
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.sales_orders to authenticated;
grant select, insert, update, delete on public.sales_order_lines to authenticated;
grant select, insert, update, delete on public.sales_order_history to authenticated;
