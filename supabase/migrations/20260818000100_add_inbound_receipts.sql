alter table public.inbound_shipments
  drop constraint if exists inbound_shipments_status_check;

alter table public.inbound_shipments
  add constraint inbound_shipments_status_check check (
    status in ('draft', 'matching', 'confirmed', 'partially_received', 'received', 'cancelled', 'deleted')
  );

alter table public.inbound_shipment_lines
  add column if not exists planned_weight numeric,
  add column if not exists received_weight_total numeric not null default 0,
  add column if not exists remaining_weight numeric not null default 0,
  add column if not exists planned_pieces numeric,
  add column if not exists received_pieces_total numeric not null default 0,
  add column if not exists remaining_pieces numeric not null default 0;

update public.inbound_shipment_lines
set
  planned_weight = coalesce(planned_weight, weight),
  planned_pieces = coalesce(planned_pieces, quantity_pieces),
  remaining_weight = greatest(coalesce(coalesce(planned_weight, weight), 0) - coalesce(received_weight_total, 0), 0),
  remaining_pieces = greatest(coalesce(coalesce(planned_pieces, quantity_pieces), 0) - coalesce(received_pieces_total, 0), 0)
where planned_weight is null
   or planned_pieces is null
   or remaining_weight is null
   or remaining_pieces is null;

alter table public.inbound_shipment_lines
  drop constraint if exists inbound_shipment_lines_status_check;

alter table public.inbound_shipment_lines
  add constraint inbound_shipment_lines_status_check check (
    status in (
      'draft',
      'excluded',
      'confirmed',
      'pending',
      'partially_received',
      'received',
      'skipped',
      'cancelled',
      'failed',
      'deleted'
    )
  );

alter table public.inbound_shipment_lines
  drop constraint if exists inbound_shipment_lines_received_weight_non_negative,
  drop constraint if exists inbound_shipment_lines_received_pieces_non_negative,
  drop constraint if exists inbound_shipment_lines_remaining_weight_non_negative,
  drop constraint if exists inbound_shipment_lines_remaining_pieces_non_negative;

alter table public.inbound_shipment_lines
  add constraint inbound_shipment_lines_received_weight_non_negative check (received_weight_total >= 0),
  add constraint inbound_shipment_lines_received_pieces_non_negative check (received_pieces_total >= 0),
  add constraint inbound_shipment_lines_remaining_weight_non_negative check (remaining_weight >= 0),
  add constraint inbound_shipment_lines_remaining_pieces_non_negative check (remaining_pieces >= 0);

create table if not exists public.inbound_receipts (
  id text primary key,
  user_id uuid not null,
  inbound_shipment_id text not null references public.inbound_shipments(id),
  receipt_no text not null default '',
  received_at timestamptz not null default now(),
  warehouse_name text not null default '',
  memo text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inbound_receipt_lines (
  id text primary key,
  user_id uuid not null,
  inbound_receipt_id text not null references public.inbound_receipts(id) on delete cascade,
  inbound_shipment_line_id text not null references public.inbound_shipment_lines(id),
  product_id text not null references public.products(id),
  received_pieces numeric,
  received_weight numeric,
  purchase_unit_cost numeric,
  expiry_date date,
  warehouse_name text not null default '',
  inventory_lot_id text,
  created_at timestamptz not null default now()
);

alter table public.inventory_lots
  add column if not exists inbound_shipment_id text references public.inbound_shipments(id),
  add column if not exists inbound_receipt_id text references public.inbound_receipts(id),
  add column if not exists inbound_shipment_line_id text references public.inbound_shipment_lines(id);

alter table public.inventory_movements
  add column if not exists inbound_shipment_id text references public.inbound_shipments(id),
  add column if not exists inbound_receipt_id text references public.inbound_receipts(id),
  add column if not exists inbound_shipment_line_id text references public.inbound_shipment_lines(id);

create unique index if not exists inbound_receipts_user_receipt_no_unique_idx
  on public.inbound_receipts (user_id, lower(receipt_no))
  where receipt_no <> '';

create index if not exists idx_inbound_receipts_user_shipment
  on public.inbound_receipts (user_id, inbound_shipment_id, received_at desc);

create index if not exists idx_inbound_receipt_lines_user_receipt
  on public.inbound_receipt_lines (user_id, inbound_receipt_id);

create index if not exists idx_inbound_receipt_lines_user_shipment_line
  on public.inbound_receipt_lines (user_id, inbound_shipment_line_id);

create index if not exists idx_inventory_lots_user_inbound
  on public.inventory_lots (user_id, inbound_shipment_id, inbound_receipt_id);

create index if not exists idx_inventory_movements_user_inbound
  on public.inventory_movements (user_id, inbound_shipment_id, inbound_receipt_id);

alter table public.inbound_receipts enable row level security;
alter table public.inbound_receipt_lines enable row level security;

grant select, insert, update, delete on public.inbound_receipts to authenticated;
grant select, insert, update, delete on public.inbound_receipt_lines to authenticated;

drop policy if exists "inbound_receipts_select_own" on public.inbound_receipts;
create policy "inbound_receipts_select_own"
  on public.inbound_receipts for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "inbound_receipts_insert_own" on public.inbound_receipts;
create policy "inbound_receipts_insert_own"
  on public.inbound_receipts for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.inbound_shipments s
      where s.id = inbound_shipment_id
        and s.user_id = (select auth.uid())
    )
  );

drop policy if exists "inbound_receipts_update_own" on public.inbound_receipts;
create policy "inbound_receipts_update_own"
  on public.inbound_receipts for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "inbound_receipts_delete_own" on public.inbound_receipts;
create policy "inbound_receipts_delete_own"
  on public.inbound_receipts for delete to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "inbound_receipt_lines_select_own" on public.inbound_receipt_lines;
create policy "inbound_receipt_lines_select_own"
  on public.inbound_receipt_lines for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "inbound_receipt_lines_insert_own" on public.inbound_receipt_lines;
create policy "inbound_receipt_lines_insert_own"
  on public.inbound_receipt_lines for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.inbound_receipts r
      where r.id = inbound_receipt_id
        and r.user_id = (select auth.uid())
    )
    and exists (
      select 1 from public.inbound_shipment_lines l
      where l.id = inbound_shipment_line_id
        and l.user_id = (select auth.uid())
    )
    and exists (
      select 1 from public.products p
      where p.id = product_id
        and p.user_id = (select auth.uid())
    )
  );

drop policy if exists "inbound_receipt_lines_update_own" on public.inbound_receipt_lines;
create policy "inbound_receipt_lines_update_own"
  on public.inbound_receipt_lines for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "inbound_receipt_lines_delete_own" on public.inbound_receipt_lines;
create policy "inbound_receipt_lines_delete_own"
  on public.inbound_receipt_lines for delete to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.confirm_inbound_receipt(
  p_inbound_shipment_id text,
  p_received_at timestamptz default now(),
  p_warehouse_name text default null,
  p_memo text default null,
  p_lines jsonb default '[]'::jsonb
) returns text
language plpgsql
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_shipment public.inbound_shipments%rowtype;
  v_receipt_id text := gen_random_uuid()::text;
  v_receipt_no text := 'RCV-' || to_char(coalesce(p_received_at, now()), 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  v_item jsonb;
  v_line public.inbound_shipment_lines%rowtype;
  v_product_exists boolean;
  v_received_pieces numeric;
  v_received_weight numeric;
  v_purchase_unit_cost numeric;
  v_inventory_quantity numeric;
  v_inventory_unit text;
  v_remaining_weight numeric;
  v_remaining_pieces numeric;
  v_line_status text;
  v_lot_id text;
  v_movement_id text;
  v_receipt_line_id text;
  v_line_count integer := 0;
  v_open_line_count integer;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;
  if p_inbound_shipment_id is null or p_inbound_shipment_id = '' then
    raise exception 'inbound_shipment_id is required';
  end if;
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'receipt lines are required';
  end if;

  select *
    into v_shipment
  from public.inbound_shipments
  where id = p_inbound_shipment_id
    and user_id = v_user_id
  for update;

  if not found then
    raise exception 'inbound shipment not found';
  end if;
  if v_shipment.status in ('cancelled', 'deleted', 'received') then
    raise exception 'inbound shipment cannot be received in current status: %', v_shipment.status;
  end if;

  insert into public.inbound_receipts (
    id, user_id, inbound_shipment_id, receipt_no, received_at, warehouse_name, memo, created_at, updated_at
  ) values (
    v_receipt_id, v_user_id, p_inbound_shipment_id, v_receipt_no, coalesce(p_received_at, now()),
    coalesce(nullif(p_warehouse_name, ''), ''), coalesce(p_memo, ''), now(), now()
  );

  for v_item in select * from jsonb_array_elements(p_lines)
  loop
    v_line_count := v_line_count + 1;
    v_received_pieces := nullif(v_item->>'received_pieces', '')::numeric;
    v_received_weight := nullif(v_item->>'received_weight', '')::numeric;
    v_purchase_unit_cost := nullif(v_item->>'purchase_unit_cost', '')::numeric;

    if coalesce(v_received_pieces, 0) < 0 or coalesce(v_received_weight, 0) < 0 then
      raise exception 'received quantity must not be negative';
    end if;
    if coalesce(v_received_pieces, 0) <= 0 and coalesce(v_received_weight, 0) <= 0 then
      raise exception 'received quantity must be positive';
    end if;

    select *
      into v_line
    from public.inbound_shipment_lines
    where id = v_item->>'inbound_shipment_line_id'
      and inbound_shipment_id = p_inbound_shipment_id
      and user_id = v_user_id
    for update;

    if not found then
      raise exception 'inbound shipment line not found';
    end if;
    if v_line.status in ('excluded', 'skipped', 'cancelled', 'deleted', 'received') then
      raise exception 'line cannot be received in current status: %', v_line.status;
    end if;
    if v_line.match_status not in ('matched', 'manual') or v_line.matched_product_id is null or v_line.matched_product_id = '' then
      raise exception 'unmatched inbound line cannot be received';
    end if;

    select exists (
      select 1 from public.products p
      where p.id = v_line.matched_product_id
        and p.user_id = v_user_id
    ) into v_product_exists;
    if not v_product_exists then
      raise exception 'matched product is not available';
    end if;

    if v_line.planned_weight is not null
       and coalesce(v_received_weight, 0) > coalesce(v_line.remaining_weight, greatest(coalesce(v_line.planned_weight, 0) - coalesce(v_line.received_weight_total, 0), 0)) + 0.000001 then
      raise exception 'received weight exceeds remaining weight';
    end if;
    if v_line.planned_pieces is not null
       and coalesce(v_received_pieces, 0) > coalesce(v_line.remaining_pieces, greatest(coalesce(v_line.planned_pieces, 0) - coalesce(v_line.received_pieces_total, 0), 0)) + 0.000001 then
      raise exception 'received pieces exceeds remaining pieces';
    end if;

    v_inventory_quantity := case when coalesce(v_received_weight, 0) > 0 then v_received_weight else v_received_pieces end;
    v_inventory_unit := case
      when coalesce(v_received_weight, 0) > 0 then coalesce(nullif(v_line.unit, ''), 'kg')
      else coalesce(nullif(v_line.unit, ''), '個')
    end;
    v_lot_id := gen_random_uuid()::text;
    v_movement_id := gen_random_uuid()::text;
    v_receipt_line_id := gen_random_uuid()::text;

    insert into public.inventory_lots (
      id, user_id, product_id, lot_number, quantity, reserved_quantity, unit, location,
      received_date, expiry_date, purchase_unit_cost, currency, voucher_number, handler_name,
      status, notes, created_by, created_at, updated_at,
      inbound_shipment_id, inbound_receipt_id, inbound_shipment_line_id
    ) values (
      v_lot_id, v_user_id, v_line.matched_product_id, nullif(v_line.contract_no, ''), v_inventory_quantity, 0,
      v_inventory_unit, coalesce(nullif(v_item->>'warehouse_name', ''), nullif(p_warehouse_name, ''), nullif(v_line.warehouse_name, '')),
      coalesce(p_received_at::date, current_date), coalesce(nullif(v_item->>'expiry_date', '')::date, v_line.expiry_date),
      coalesce(v_purchase_unit_cost, v_line.unit_price), coalesce(nullif(v_line.currency, ''), 'JPY'), nullif(v_line.contract_no, ''),
      null, 'active',
      jsonb_build_object(
        'source', 'delivery_notice_pdf',
        'supplierName', v_shipment.supplier_name,
        'documentNumber', v_shipment.document_number,
        'contractNo', v_line.contract_no,
        'brandNameRaw', v_line.brand_name_raw,
        'productNameRaw', v_line.product_name_raw,
        'factoryNo', v_line.factory_no,
        'originCountry', v_line.origin_country,
        'inboundShipmentId', p_inbound_shipment_id,
        'inboundReceiptId', v_receipt_id,
        'inboundShipmentLineId', v_line.id
      )::text,
      v_user_id, now(), now(), p_inbound_shipment_id, v_receipt_id, v_line.id
    );

    insert into public.inventory_movements (
      id, user_id, product_id, inventory_lot_id, movement_type, quantity, unit, movement_date,
      reason, location_to, voucher_number, handler_name, notes, original_payload, created_by, created_at,
      inbound_shipment_id, inbound_receipt_id, inbound_shipment_line_id
    ) values (
      v_movement_id, v_user_id, v_line.matched_product_id, v_lot_id, 'receipt', v_inventory_quantity, v_inventory_unit,
      coalesce(p_received_at::date, current_date), 'PDF入荷予定から入荷確定',
      coalesce(nullif(v_item->>'warehouse_name', ''), nullif(p_warehouse_name, ''), nullif(v_line.warehouse_name, '')),
      nullif(v_line.contract_no, ''), null,
      '入荷予定PDFからの入荷確定',
      jsonb_build_object(
        'source', 'delivery_notice_pdf',
        'supplierName', v_shipment.supplier_name,
        'documentNumber', v_shipment.document_number,
        'contractNo', v_line.contract_no,
        'brandNameRaw', v_line.brand_name_raw,
        'productNameRaw', v_line.product_name_raw,
        'receivedPieces', v_received_pieces,
        'receivedWeight', v_received_weight,
        'inboundShipmentId', p_inbound_shipment_id,
        'inboundReceiptId', v_receipt_id,
        'inboundShipmentLineId', v_line.id
      ),
      v_user_id, now(), p_inbound_shipment_id, v_receipt_id, v_line.id
    );

    insert into public.inbound_receipt_lines (
      id, user_id, inbound_receipt_id, inbound_shipment_line_id, product_id,
      received_pieces, received_weight, purchase_unit_cost, expiry_date, warehouse_name,
      inventory_lot_id, created_at
    ) values (
      v_receipt_line_id, v_user_id, v_receipt_id, v_line.id, v_line.matched_product_id,
      v_received_pieces, v_received_weight, coalesce(v_purchase_unit_cost, v_line.unit_price),
      coalesce(nullif(v_item->>'expiry_date', '')::date, v_line.expiry_date),
      coalesce(nullif(v_item->>'warehouse_name', ''), nullif(p_warehouse_name, ''), nullif(v_line.warehouse_name, '')),
      v_lot_id, now()
    );

    v_remaining_weight := greatest(coalesce(v_line.planned_weight, v_line.weight, 0) - (coalesce(v_line.received_weight_total, 0) + coalesce(v_received_weight, 0)), 0);
    v_remaining_pieces := greatest(coalesce(v_line.planned_pieces, v_line.quantity_pieces, 0) - (coalesce(v_line.received_pieces_total, 0) + coalesce(v_received_pieces, 0)), 0);
    v_line_status := case
      when (coalesce(v_line.planned_weight, v_line.weight) is null or v_remaining_weight <= 0.000001)
       and (coalesce(v_line.planned_pieces, v_line.quantity_pieces) is null or v_remaining_pieces <= 0.000001)
        then 'received'
      else 'partially_received'
    end;

    update public.inbound_shipment_lines
    set
      planned_weight = coalesce(planned_weight, weight),
      planned_pieces = coalesce(planned_pieces, quantity_pieces),
      received_weight_total = coalesce(received_weight_total, 0) + coalesce(v_received_weight, 0),
      received_pieces_total = coalesce(received_pieces_total, 0) + coalesce(v_received_pieces, 0),
      remaining_weight = v_remaining_weight,
      remaining_pieces = v_remaining_pieces,
      status = v_line_status,
      updated_at = now()
    where id = v_line.id
      and user_id = v_user_id;
  end loop;

  if v_line_count = 0 then
    raise exception 'receipt lines are required';
  end if;

  select count(*)
    into v_open_line_count
  from public.inbound_shipment_lines
  where inbound_shipment_id = p_inbound_shipment_id
    and user_id = v_user_id
    and status not in ('received', 'excluded', 'skipped', 'cancelled', 'deleted');

  update public.inbound_shipments
  set
    status = case when v_open_line_count = 0 then 'received' else 'partially_received' end,
    updated_at = now()
  where id = p_inbound_shipment_id
    and user_id = v_user_id;

  return v_receipt_id;
end;
$$;

revoke all on function public.confirm_inbound_receipt(text, timestamptz, text, text, jsonb) from public, anon;
grant execute on function public.confirm_inbound_receipt(text, timestamptz, text, text, jsonb) to authenticated;
