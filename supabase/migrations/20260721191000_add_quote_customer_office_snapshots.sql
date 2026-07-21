-- Keep customer office, billing, and shipping snapshots on quotes.

alter table public.quotes
  add column if not exists transaction_customer_snapshot jsonb,
  add column if not exists billing_customer_id text,
  add column if not exists billing_customer_snapshot jsonb,
  add column if not exists shipping_customer_id text,
  add column if not exists shipping_customer_snapshot jsonb;

create index if not exists idx_quotes_billing_customer_id
  on public.quotes (user_id, billing_customer_id);

create index if not exists idx_quotes_shipping_customer_id
  on public.quotes (user_id, shipping_customer_id);
