create table if not exists public.delivery_notes (
  id text primary key,
  user_id uuid not null,
  delivery_note_number text not null,
  shipment_id text not null references public.shipments(id) on delete restrict,
  sales_order_id text not null references public.sales_orders(id) on delete restrict,
  customer_id text,
  issue_date date not null default current_date,
  delivery_date date,
  price_visible boolean not null default false,
  status text not null default 'Issued',
  snapshot jsonb not null default '{}'::jsonb,
  delivery_note_pdf_url text default '',
  delivery_note_pdf_file_name text default '',
  delivery_note_pdf_storage_path text default '',
  delivery_note_pdf_generated_at timestamptz,
  delivery_note_pdf_history jsonb not null default '[]'::jsonb,
  created_by uuid,
  created_by_name text default '',
  updated_by uuid,
  updated_by_name text default '',
  is_deleted boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint delivery_notes_status_check check (status in ('Draft', 'Issued', 'Reissued', 'Cancelled'))
);

create table if not exists public.delivery_note_lines (
  id text primary key,
  user_id uuid not null,
  delivery_note_id text not null references public.delivery_notes(id) on delete cascade,
  shipment_line_id text not null references public.shipment_lines(id) on delete restrict,
  product_id text,
  product_snapshot jsonb not null default '{}'::jsonb,
  quantity numeric not null default 0,
  unit text default '',
  unit_price numeric,
  amount numeric,
  tax_rate numeric,
  tax_amount numeric,
  lot_snapshot jsonb,
  expiry_snapshot text default '',
  created_at timestamptz not null default now(),
  constraint delivery_note_lines_quantity_positive check (quantity > 0)
);

create unique index if not exists delivery_notes_user_number_unique
  on public.delivery_notes (user_id, lower(delivery_note_number))
  where is_deleted = false;

create unique index if not exists delivery_notes_user_shipment_unique
  on public.delivery_notes (user_id, shipment_id)
  where is_deleted = false;

create index if not exists idx_delivery_notes_user_shipment
  on public.delivery_notes (user_id, shipment_id, created_at desc);
create index if not exists idx_delivery_notes_shipment_id
  on public.delivery_notes (shipment_id);
create index if not exists idx_delivery_notes_user_status
  on public.delivery_notes (user_id, status, issue_date desc);
create index if not exists idx_delivery_notes_customer_id
  on public.delivery_notes (customer_id);
create index if not exists idx_delivery_note_lines_user_note
  on public.delivery_note_lines (user_id, delivery_note_id);
create index if not exists idx_delivery_note_lines_delivery_note_id
  on public.delivery_note_lines (delivery_note_id);
create index if not exists idx_delivery_note_lines_shipment_line_id
  on public.delivery_note_lines (shipment_line_id);

alter table public.delivery_notes enable row level security;
alter table public.delivery_note_lines enable row level security;

grant select, insert, update, delete on public.delivery_notes to authenticated;
grant select, insert, update, delete on public.delivery_note_lines to authenticated;

drop policy if exists "delivery_notes_select_own" on public.delivery_notes;
create policy "delivery_notes_select_own"
  on public.delivery_notes for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "delivery_notes_insert_own" on public.delivery_notes;
create policy "delivery_notes_insert_own"
  on public.delivery_notes for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "delivery_notes_update_own" on public.delivery_notes;
create policy "delivery_notes_update_own"
  on public.delivery_notes for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "delivery_notes_delete_own" on public.delivery_notes;
create policy "delivery_notes_delete_own"
  on public.delivery_notes for delete to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "delivery_note_lines_select_own" on public.delivery_note_lines;
create policy "delivery_note_lines_select_own"
  on public.delivery_note_lines for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "delivery_note_lines_insert_own" on public.delivery_note_lines;
create policy "delivery_note_lines_insert_own"
  on public.delivery_note_lines for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "delivery_note_lines_update_own" on public.delivery_note_lines;
create policy "delivery_note_lines_update_own"
  on public.delivery_note_lines for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "delivery_note_lines_delete_own" on public.delivery_note_lines;
create policy "delivery_note_lines_delete_own"
  on public.delivery_note_lines for delete to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.generate_delivery_note_number()
returns text
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_prefix text := 'DN-' || to_char(current_date, 'YYYYMMDD') || '-';
  v_next integer;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select coalesce(max(nullif(replace(delivery_note_number, v_prefix, ''), '')::integer), 0) + 1
  into v_next
  from public.delivery_notes
  where user_id = v_user_id
    and delivery_note_number like v_prefix || '%';

  return v_prefix || lpad(v_next::text, 6, '0');
end;
$$;

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

revoke all on function public.generate_delivery_note_number() from public, anon;
revoke all on function public.create_delivery_note_from_shipment(text, boolean, date) from public, anon;

grant execute on function public.generate_delivery_note_number() to authenticated;
grant execute on function public.create_delivery_note_from_shipment(text, boolean, date) to authenticated;

notify pgrst, 'reload schema';
