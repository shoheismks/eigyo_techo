alter table public.sales_orders
  add column if not exists billing_customer_id text,
  add column if not exists billing_customer_snapshot jsonb,
  add column if not exists shipping_customer_id text,
  add column if not exists shipping_customer_snapshot jsonb;

create index if not exists idx_sales_orders_user_billing_customer_id
  on public.sales_orders (user_id, billing_customer_id);

create index if not exists idx_sales_orders_user_shipping_customer_id
  on public.sales_orders (user_id, shipping_customer_id);
