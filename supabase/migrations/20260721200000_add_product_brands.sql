create table if not exists public.brands (
  id text primary key,
  user_id uuid not null,
  name text not null,
  manufacturer_id text,
  supplier_id text,
  country text default '',
  description text default '',
  website_url text default '',
  logo_url text default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint brands_name_not_blank check (btrim(name) <> '')
);

alter table public.products
  add column if not exists brand_id text,
  add column if not exists brand_name text;

alter table public.sales_order_lines
  add column if not exists brand_id text,
  add column if not exists brand_name text default '';

alter table public.invoice_lines
  add column if not exists brand_id text,
  add column if not exists brand_name text default '';

create index if not exists brands_user_updated_idx
  on public.brands (user_id, updated_at desc);

create index if not exists brands_user_supplier_idx
  on public.brands (user_id, supplier_id)
  where supplier_id is not null;

create unique index if not exists brands_user_name_unique_idx
  on public.brands (user_id, lower(name))
  where deleted_at is null;

create index if not exists products_user_brand_idx
  on public.products (user_id, brand_id)
  where brand_id is not null;

create index if not exists products_user_brand_name_idx
  on public.products (user_id, brand_name)
  where brand_name is not null and brand_name <> '';

alter table public.brands enable row level security;

grant select, insert, update, delete on public.brands to authenticated;

drop policy if exists "brands_select_own" on public.brands;
create policy "brands_select_own"
  on public.brands for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "brands_insert_own" on public.brands;
create policy "brands_insert_own"
  on public.brands for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "brands_update_own" on public.brands;
create policy "brands_update_own"
  on public.brands for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "brands_delete_own" on public.brands;
create policy "brands_delete_own"
  on public.brands for delete to authenticated
  using (auth.uid() = user_id);

create or replace function public.validate_product_brand_owner()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_brand public.brands%rowtype;
begin
  if new.brand_name is not null then
    new.brand_name := btrim(new.brand_name);
  end if;

  if new.brand_id is null or new.brand_id = '' then
    return new;
  end if;

  select * into v_brand
  from public.brands
  where id = new.brand_id
    and user_id = new.user_id
    and deleted_at is null;

  if not found then
    raise exception 'brand does not belong to this user';
  end if;

  if new.brand_name is null or new.brand_name = '' then
    new.brand_name := v_brand.name;
  end if;

  return new;
end;
$$;

drop trigger if exists products_validate_brand_owner on public.products;
create trigger products_validate_brand_owner
  before insert or update of brand_id, brand_name, user_id
  on public.products
  for each row
  execute function public.validate_product_brand_owner();

create or replace function public.create_delivery_note_from_shipment(
  p_shipment_id text,
  p_price_visible boolean default false,
  p_issue_date date default current_date
) returns jsonb
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_shipment public.shipments%rowtype;
  v_order public.sales_orders%rowtype;
  v_delivery_note_id text;
  v_delivery_note_number text;
  v_existing_id text;
  v_line_count integer := 0;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select * into v_shipment
  from public.shipments
  where id = p_shipment_id
    and user_id = v_user_id
    and is_deleted = false
  for update;

  if not found then
    raise exception 'shipment not found';
  end if;

  if v_shipment.status <> 'Shipped' then
    raise exception 'delivery note can be created only from shipped shipment';
  end if;

  select id into v_existing_id
  from public.delivery_notes
  where user_id = v_user_id
    and shipment_id = p_shipment_id
    and is_deleted = false
  limit 1;

  if v_existing_id is not null then
    return jsonb_build_object('deliveryNoteId', v_existing_id, 'alreadyExists', true);
  end if;

  select * into v_order
  from public.sales_orders
  where id = v_shipment.sales_order_id
    and user_id = v_user_id
    and is_deleted = false;

  if not found then
    raise exception 'sales order not found';
  end if;

  v_delivery_note_id := gen_random_uuid()::text;
  v_delivery_note_number := public.generate_delivery_note_number();

  insert into public.delivery_notes (
    id, user_id, delivery_note_number, shipment_id, sales_order_id, customer_id,
    issue_date, delivery_date, price_visible, status, snapshot,
    created_by, updated_by, created_at, updated_at
  ) values (
    v_delivery_note_id, v_user_id, v_delivery_note_number, p_shipment_id,
    v_shipment.sales_order_id, v_shipment.customer_id,
    coalesce(p_issue_date, current_date), coalesce(v_shipment.planned_delivery_date, v_shipment.shipment_date),
    coalesce(p_price_visible, false), 'Issued',
    jsonb_build_object(
      'shipment', to_jsonb(v_shipment),
      'salesOrder', to_jsonb(v_order),
      'customer', coalesce(v_order.customer_snapshot, '{}'::jsonb),
      'issuer', coalesce(v_order.issuer_snapshot, '{}'::jsonb),
      'snapshotCreatedAt', now()
    ),
    v_user_id, v_user_id, now(), now()
  );

  insert into public.delivery_note_lines (
    id, user_id, delivery_note_id, shipment_line_id, product_id, product_snapshot,
    quantity, unit, unit_price, amount, tax_rate, tax_amount, lot_snapshot, expiry_snapshot, created_at
  )
  select
    gen_random_uuid()::text,
    v_user_id,
    v_delivery_note_id,
    sl.id,
    sl.product_id,
    jsonb_build_object(
      'productId', sl.product_id,
      'productCode', coalesce(sol.product_code, p.product_code, ''),
      'productName', coalesce(sol.product_name, p.name, ''),
      'brandId', coalesce(sol.brand_id, p.brand_id, ''),
      'brandName', coalesce(sol.brand_name, p.brand_name, ''),
      'specification', coalesce(sol.specification, p.package_style, ''),
      'temperatureZone', coalesce(sol.temperature_zone, p.temperature_zone, ''),
      'expirationText', coalesce(nullif(sol.expiration_text, ''), sl.expiry_snapshot, ''),
      'manufacturerName', coalesce(p.manufacturer_name, ''),
      'origin', coalesce(p.origin, ''),
      'sourceLineSnapshot', sol.source_line_snapshot
    ),
    sl.quantity,
    coalesce(nullif(sl.unit, ''), sol.unit, ''),
    sol.unit_price,
    case when sol.unit_price is null then null else sl.quantity * sol.unit_price end,
    sol.tax_rate,
    case when sol.unit_price is null or sol.tax_rate is null then null else round(sl.quantity * sol.unit_price * (sol.tax_rate / 100.0)) end,
    sl.lot_snapshot,
    coalesce(nullif(sl.expiry_snapshot, ''), sol.expiration_text, ''),
    now()
  from public.shipment_lines sl
  left join public.sales_order_lines sol
    on sol.id = sl.sales_order_line_id
    and sol.user_id = v_user_id
  left join public.products p
    on p.id = sl.product_id
    and p.user_id = v_user_id
  where sl.user_id = v_user_id
    and sl.shipment_id = p_shipment_id
  order by sol.line_number asc, sl.created_at asc;

  get diagnostics v_line_count = row_count;

  if v_line_count = 0 then
    delete from public.delivery_notes
    where id = v_delivery_note_id
      and user_id = v_user_id;
    raise exception 'shipment has no lines';
  end if;

  return jsonb_build_object(
    'deliveryNoteId', v_delivery_note_id,
    'deliveryNoteNumber', v_delivery_note_number,
    'lineCount', v_line_count,
    'alreadyExists', false
  );
end;
$$;

revoke all on function public.create_delivery_note_from_shipment(text, boolean, date) from public, anon;
grant execute on function public.create_delivery_note_from_shipment(text, boolean, date) to authenticated;
