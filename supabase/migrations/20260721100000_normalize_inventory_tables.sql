-- Normalize inventory storage while preserving the legacy inventories table.
-- New tables are the source of truth. Legacy columns remain for compatibility.

create table if not exists public.inventory_lots (
  id text primary key,
  user_id uuid not null,
  product_id text not null,
  supplier_id text,
  lot_number text,
  quantity numeric not null default 0,
  reserved_quantity numeric not null default 0,
  available_quantity numeric generated always as (quantity - reserved_quantity) stored,
  unit text,
  location text,
  manufacture_date date,
  received_date date,
  expiry_date date,
  purchase_unit_cost numeric,
  currency text default 'JPY',
  stock_type text,
  owner text,
  inventory_code text,
  safety_stock numeric,
  firm_deadline date,
  eta date,
  voucher_number text,
  handler_name text,
  status text not null default 'active',
  notes text,
  created_by uuid,
  created_by_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint inventory_lots_quantity_non_negative check (quantity >= 0),
  constraint inventory_lots_reserved_non_negative check (reserved_quantity >= 0),
  constraint inventory_lots_reserved_not_over_quantity check (reserved_quantity <= quantity),
  constraint inventory_lots_status_check check (status in ('active', 'exhausted', 'expired', 'quarantined', 'deleted'))
);

create table if not exists public.inventory_movements (
  id text primary key,
  user_id uuid not null,
  product_id text not null,
  inventory_lot_id text references public.inventory_lots(id),
  movement_type text not null,
  quantity numeric not null default 0,
  unit text,
  movement_date date not null default current_date,
  reason text,
  location_from text,
  location_to text,
  supplier_id text,
  customer_id text,
  project_id text,
  quote_id text,
  invoice_id text,
  order_id text,
  shipment_id text,
  voucher_number text,
  handler_name text,
  notes text,
  original_payload jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  constraint inventory_movements_type_check check (
    movement_type in (
      'receipt',
      'shipment',
      'sample',
      'return_in',
      'return_out',
      'disposal',
      'stocktake_adjustment',
      'transfer_in',
      'transfer_out',
      'manual_adjustment',
      'reservation',
      'reservation_release'
    )
  )
);

create table if not exists public.inventory_reservations (
  id text primary key,
  user_id uuid not null,
  product_id text not null,
  inventory_lot_id text not null references public.inventory_lots(id),
  customer_id text,
  project_id text,
  order_id text,
  quote_id text,
  reserved_quantity numeric not null default 0,
  fulfilled_quantity numeric not null default 0,
  released_quantity numeric not null default 0,
  unit text,
  status text not null default 'active',
  reserved_at timestamptz not null default now(),
  required_date date,
  expires_at timestamptz,
  notes text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inventory_reservations_reserved_non_negative check (reserved_quantity >= 0),
  constraint inventory_reservations_fulfilled_non_negative check (fulfilled_quantity >= 0),
  constraint inventory_reservations_released_non_negative check (released_quantity >= 0),
  constraint inventory_reservations_status_check check (status in ('active', 'partially_fulfilled', 'fulfilled', 'released', 'cancelled'))
);

create table if not exists public.stocktakes (
  id text primary key,
  user_id uuid not null,
  stocktake_number text,
  location text,
  status text not null default 'draft',
  stocktake_date date not null default current_date,
  started_at timestamptz,
  completed_at timestamptz,
  notes text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint stocktakes_status_check check (status in ('draft', 'in_progress', 'completed', 'cancelled'))
);

create table if not exists public.stocktake_lines (
  id text primary key,
  user_id uuid not null,
  stocktake_id text not null references public.stocktakes(id),
  product_id text not null,
  inventory_lot_id text references public.inventory_lots(id),
  system_quantity numeric not null default 0,
  actual_quantity numeric not null default 0,
  difference_quantity numeric not null default 0,
  unit text,
  difference_reason text,
  adjustment_movement_id text references public.inventory_movements(id),
  counted_by text,
  counted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inventory_migration_audits (
  id text primary key,
  migration_name text not null,
  user_id uuid,
  legacy_inventory_count integer not null default 0,
  migrated_lot_count integer not null default 0,
  legacy_quantity_total numeric not null default 0,
  migrated_quantity_total numeric not null default 0,
  legacy_reserved_total numeric not null default 0,
  migrated_reserved_total numeric not null default 0,
  quantity_difference numeric not null default 0,
  reserved_difference numeric not null default 0,
  warning text,
  created_at timestamptz not null default now()
);

create index if not exists idx_inventory_lots_user_product on public.inventory_lots (user_id, product_id);
create index if not exists idx_inventory_lots_user_expiry on public.inventory_lots (user_id, expiry_date);
create index if not exists idx_inventory_lots_user_location on public.inventory_lots (user_id, location);
create index if not exists idx_inventory_lots_user_lot on public.inventory_lots (user_id, lot_number);
create index if not exists idx_inventory_lots_user_status on public.inventory_lots (user_id, status);
create unique index if not exists inventory_lots_user_inventory_code_unique_idx
  on public.inventory_lots (user_id, lower(inventory_code))
  where inventory_code is not null and inventory_code <> '' and status <> 'deleted';
create index if not exists idx_inventory_movements_user_product_date on public.inventory_movements (user_id, product_id, movement_date desc);
create index if not exists idx_inventory_movements_user_lot on public.inventory_movements (user_id, inventory_lot_id);
create index if not exists idx_inventory_reservations_user_product_status on public.inventory_reservations (user_id, product_id, status);
create index if not exists idx_inventory_reservations_user_lot_status on public.inventory_reservations (user_id, inventory_lot_id, status);
create index if not exists idx_stocktakes_user_date on public.stocktakes (user_id, stocktake_date desc);
create index if not exists idx_stocktake_lines_user_stocktake on public.stocktake_lines (user_id, stocktake_id);

alter table public.inventory_lots enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.inventory_reservations enable row level security;
alter table public.stocktakes enable row level security;
alter table public.stocktake_lines enable row level security;
alter table public.inventory_migration_audits enable row level security;

alter table public.inventory_lots
  drop constraint if exists inventory_lots_inventory_code_ascii_check;

alter table public.inventory_lots
  add constraint inventory_lots_inventory_code_ascii_check
  check (
    inventory_code is null
    or inventory_code = ''
    or (
      inventory_code = btrim(inventory_code)
      and inventory_code !~ '[[:space:]]'
      and inventory_code ~ '^[\x21-\x7E]+$'
    )
  );

grant select, insert, update, delete on public.inventory_lots to authenticated;
grant select, insert on public.inventory_movements to authenticated;
grant select, insert, update, delete on public.inventory_reservations to authenticated;
grant select, insert, update, delete on public.stocktakes to authenticated;
grant select, insert, update, delete on public.stocktake_lines to authenticated;
grant select on public.inventory_migration_audits to authenticated;

drop policy if exists "Allow authenticated read own inventory_lots" on public.inventory_lots;
create policy "Allow authenticated read own inventory_lots"
  on public.inventory_lots for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Allow authenticated insert own inventory_lots" on public.inventory_lots;
create policy "Allow authenticated insert own inventory_lots"
  on public.inventory_lots for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Allow authenticated update own inventory_lots" on public.inventory_lots;
create policy "Allow authenticated update own inventory_lots"
  on public.inventory_lots for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Allow authenticated delete own inventory_lots" on public.inventory_lots;
create policy "Allow authenticated delete own inventory_lots"
  on public.inventory_lots for delete to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Allow authenticated read own inventory_movements" on public.inventory_movements;
create policy "Allow authenticated read own inventory_movements"
  on public.inventory_movements for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Allow authenticated insert own inventory_movements" on public.inventory_movements;
create policy "Allow authenticated insert own inventory_movements"
  on public.inventory_movements for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Allow authenticated read own inventory_reservations" on public.inventory_reservations;
create policy "Allow authenticated read own inventory_reservations"
  on public.inventory_reservations for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Allow authenticated insert own inventory_reservations" on public.inventory_reservations;
create policy "Allow authenticated insert own inventory_reservations"
  on public.inventory_reservations for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Allow authenticated update own inventory_reservations" on public.inventory_reservations;
create policy "Allow authenticated update own inventory_reservations"
  on public.inventory_reservations for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Allow authenticated read own stocktakes" on public.stocktakes;
create policy "Allow authenticated read own stocktakes"
  on public.stocktakes for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Allow authenticated insert own stocktakes" on public.stocktakes;
create policy "Allow authenticated insert own stocktakes"
  on public.stocktakes for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Allow authenticated update own stocktakes" on public.stocktakes;
create policy "Allow authenticated update own stocktakes"
  on public.stocktakes for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Allow authenticated read own stocktake_lines" on public.stocktake_lines;
create policy "Allow authenticated read own stocktake_lines"
  on public.stocktake_lines for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Allow authenticated insert own stocktake_lines" on public.stocktake_lines;
create policy "Allow authenticated insert own stocktake_lines"
  on public.stocktake_lines for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Allow authenticated update own stocktake_lines" on public.stocktake_lines;
create policy "Allow authenticated update own stocktake_lines"
  on public.stocktake_lines for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Allow authenticated read own inventory_migration_audits" on public.inventory_migration_audits;
create policy "Allow authenticated read own inventory_migration_audits"
  on public.inventory_migration_audits for select to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.eigyo_inventory_status_from_legacy(legacy_status text, expiry_date date, quantity numeric)
returns text
language sql
stable
as $$
  select case
    when quantity <= 0 then 'exhausted'
    when expiry_date is not null and expiry_date < current_date then 'expired'
    when legacy_status in ('欠品', '売切') then 'exhausted'
    when legacy_status in ('案内中', '出庫待ち', '予約済', 'ファーム') then 'active'
    else 'active'
  end;
$$;

create or replace function public.receive_inventory(
  p_inventory_lot_id text default null,
  p_product_id text default null,
  p_supplier_id text default null,
  p_lot_number text default null,
  p_quantity numeric default 0,
  p_unit text default 'kg',
  p_location text default null,
  p_manufacture_date date default null,
  p_received_date date default current_date,
  p_expiry_date date default null,
  p_purchase_unit_cost numeric default null,
  p_currency text default 'JPY',
  p_stock_type text default null,
  p_owner text default null,
  p_inventory_code text default null,
  p_safety_stock numeric default null,
  p_firm_deadline date default null,
  p_eta date default null,
  p_voucher_number text default null,
  p_handler_name text default null,
  p_reason text default null,
  p_notes text default null
) returns text
language plpgsql
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_lot_id text := coalesce(nullif(p_inventory_lot_id, ''), gen_random_uuid()::text);
  v_movement_id text := gen_random_uuid()::text;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;
  if p_product_id is null or p_product_id = '' then
    raise exception 'product_id is required';
  end if;
  if coalesce(p_quantity, 0) <= 0 then
    raise exception 'quantity must be positive';
  end if;

  insert into public.inventory_lots (
    id, user_id, product_id, supplier_id, lot_number, quantity, reserved_quantity, unit, location,
    manufacture_date, received_date, expiry_date, purchase_unit_cost, currency, stock_type, owner,
    inventory_code, safety_stock, firm_deadline, eta, voucher_number, handler_name, status, notes,
    created_by, created_at, updated_at
  ) values (
    v_lot_id, v_user_id, p_product_id, nullif(p_supplier_id, ''), nullif(p_lot_number, ''), p_quantity, 0,
    p_unit, nullif(p_location, ''), p_manufacture_date, p_received_date, p_expiry_date, p_purchase_unit_cost,
    coalesce(nullif(p_currency, ''), 'JPY'), nullif(p_stock_type, ''), nullif(p_owner, ''),
    nullif(p_inventory_code, ''), p_safety_stock, p_firm_deadline, p_eta, nullif(p_voucher_number, ''),
    nullif(p_handler_name, ''), 'active', nullif(p_notes, ''), v_user_id, now(), now()
  )
  on conflict (id) do update
    set quantity = public.inventory_lots.quantity + excluded.quantity,
        supplier_id = coalesce(excluded.supplier_id, public.inventory_lots.supplier_id),
        unit = coalesce(excluded.unit, public.inventory_lots.unit),
        location = coalesce(excluded.location, public.inventory_lots.location),
        expiry_date = coalesce(excluded.expiry_date, public.inventory_lots.expiry_date),
        purchase_unit_cost = coalesce(excluded.purchase_unit_cost, public.inventory_lots.purchase_unit_cost),
        voucher_number = coalesce(excluded.voucher_number, public.inventory_lots.voucher_number),
        handler_name = coalesce(excluded.handler_name, public.inventory_lots.handler_name),
        status = case when public.inventory_lots.status = 'deleted' then 'active' else public.inventory_lots.status end,
        updated_at = now()
    where public.inventory_lots.user_id = v_user_id;

  insert into public.inventory_movements (
    id, user_id, product_id, inventory_lot_id, movement_type, quantity, unit, movement_date,
    reason, location_to, supplier_id, voucher_number, handler_name, notes, created_by, created_at
  ) values (
    v_movement_id, v_user_id, p_product_id, v_lot_id, 'receipt', p_quantity, p_unit,
    coalesce(p_received_date, current_date), p_reason, p_location, nullif(p_supplier_id, ''),
    nullif(p_voucher_number, ''), nullif(p_handler_name, ''), nullif(p_notes, ''), v_user_id, now()
  );

  return v_lot_id;
end;
$$;

create or replace function public.issue_inventory(
  p_inventory_lot_id text,
  p_quantity numeric,
  p_movement_type text default 'shipment',
  p_movement_date date default current_date,
  p_reason text default null,
  p_customer_id text default null,
  p_project_id text default null,
  p_quote_id text default null,
  p_invoice_id text default null,
  p_handler_name text default null,
  p_notes text default null
) returns text
language plpgsql
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_lot public.inventory_lots%rowtype;
  v_movement_id text := gen_random_uuid()::text;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;
  if coalesce(p_quantity, 0) <= 0 then
    raise exception 'quantity must be positive';
  end if;

  select * into v_lot
  from public.inventory_lots
  where id = p_inventory_lot_id and user_id = v_user_id and status <> 'deleted'
  for update;

  if not found then
    raise exception 'inventory lot not found';
  end if;
  if v_lot.status in ('expired', 'quarantined') then
    raise exception 'selected lot cannot be issued';
  end if;
  if (v_lot.quantity - v_lot.reserved_quantity) < p_quantity then
    raise exception 'available inventory is insufficient';
  end if;

  update public.inventory_lots
  set quantity = quantity - p_quantity,
      status = case when quantity - p_quantity <= 0 then 'exhausted' else status end,
      updated_at = now()
  where id = p_inventory_lot_id and user_id = v_user_id;

  insert into public.inventory_movements (
    id, user_id, product_id, inventory_lot_id, movement_type, quantity, unit, movement_date,
    reason, location_from, customer_id, project_id, quote_id, invoice_id, handler_name, notes,
    created_by, created_at
  ) values (
    v_movement_id, v_user_id, v_lot.product_id, p_inventory_lot_id,
    coalesce(nullif(p_movement_type, ''), 'shipment'), -p_quantity, v_lot.unit,
    coalesce(p_movement_date, current_date), p_reason, v_lot.location, nullif(p_customer_id, ''),
    nullif(p_project_id, ''), nullif(p_quote_id, ''), nullif(p_invoice_id, ''),
    nullif(p_handler_name, ''), nullif(p_notes, ''), v_user_id, now()
  );

  return v_movement_id;
end;
$$;

create or replace function public.update_inventory_lot(
  p_inventory_lot_id text,
  p_patch jsonb
) returns text
language plpgsql
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_lot public.inventory_lots%rowtype;
  v_next_quantity numeric;
  v_next_reserved numeric;
  v_diff numeric;
  v_movement_id text;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select * into v_lot
  from public.inventory_lots
  where id = p_inventory_lot_id and user_id = v_user_id
  for update;

  if not found then
    raise exception 'inventory lot not found';
  end if;

  v_next_quantity := case when p_patch ? 'quantity' then coalesce(nullif(p_patch->>'quantity', '')::numeric, 0) else v_lot.quantity end;
  v_next_reserved := case when p_patch ? 'reservedQuantity' then coalesce(nullif(p_patch->>'reservedQuantity', '')::numeric, 0) else v_lot.reserved_quantity end;

  if v_next_quantity < 0 or v_next_reserved < 0 or v_next_reserved > v_next_quantity then
    raise exception 'invalid inventory quantity';
  end if;

  v_diff := v_next_quantity - v_lot.quantity;

  update public.inventory_lots
  set supplier_id = case when p_patch ? 'supplierId' then nullif(p_patch->>'supplierId', '') else supplier_id end,
      lot_number = case when p_patch ? 'lot' then nullif(p_patch->>'lot', '') else lot_number end,
      quantity = v_next_quantity,
      reserved_quantity = v_next_reserved,
      unit = case when p_patch ? 'unit' then nullif(p_patch->>'unit', '') else unit end,
      location = case when p_patch ? 'location' then nullif(p_patch->>'location', '') else location end,
      manufacture_date = case when p_patch ? 'manufactureDate' then nullif(p_patch->>'manufactureDate', '')::date else manufacture_date end,
      received_date = case when p_patch ? 'receivedDate' then nullif(p_patch->>'receivedDate', '')::date else received_date end,
      expiry_date = case when p_patch ? 'expiryDate' then nullif(p_patch->>'expiryDate', '')::date else expiry_date end,
      purchase_unit_cost = case when p_patch ? 'cost' then nullif(p_patch->>'cost', '')::numeric else purchase_unit_cost end,
      currency = case when p_patch ? 'currency' then coalesce(nullif(p_patch->>'currency', ''), 'JPY') else currency end,
      stock_type = case when p_patch ? 'stockType' then nullif(p_patch->>'stockType', '') else stock_type end,
      owner = case when p_patch ? 'owner' then nullif(p_patch->>'owner', '') else owner end,
      inventory_code = case when p_patch ? 'inventoryCode' then nullif(p_patch->>'inventoryCode', '') else inventory_code end,
      safety_stock = case when p_patch ? 'safetyStock' then nullif(p_patch->>'safetyStock', '')::numeric else safety_stock end,
      firm_deadline = case when p_patch ? 'firmDeadline' then nullif(p_patch->>'firmDeadline', '')::date else firm_deadline end,
      eta = case when p_patch ? 'eta' then nullif(p_patch->>'eta', '')::date else eta end,
      voucher_number = case when p_patch ? 'voucherNumber' then nullif(p_patch->>'voucherNumber', '') else voucher_number end,
      handler_name = case when p_patch ? 'handlerName' then nullif(p_patch->>'handlerName', '') else handler_name end,
      status = case
        when p_patch ? 'status' then nullif(p_patch->>'status', '')
        when p_patch ? 'inventoryStatus' then
          case
            when p_patch->>'inventoryStatus' in ('フリー', '案内中', '出庫待ち', '予約済', 'ファーム', '入港待ち') then 'active'
            when p_patch->>'inventoryStatus' in ('欠品', '売切') then 'exhausted'
            when p_patch->>'inventoryStatus' = '隔離' then 'quarantined'
            else status
          end
        when v_next_quantity <= 0 then 'exhausted'
        else status
      end,
      notes = case when p_patch ? 'memo' then nullif(p_patch->>'memo', '') else notes end,
      deleted_at = case
        when (p_patch->>'status') = 'deleted' then now()
        else deleted_at
      end,
      updated_at = now()
  where id = p_inventory_lot_id and user_id = v_user_id;

  if v_diff <> 0 then
    v_movement_id := gen_random_uuid()::text;
    insert into public.inventory_movements (
      id, user_id, product_id, inventory_lot_id, movement_type, quantity, unit, movement_date,
      reason, notes, created_by, created_at
    ) values (
      v_movement_id, v_user_id, v_lot.product_id, p_inventory_lot_id, 'manual_adjustment',
      v_diff, coalesce(p_patch->>'unit', v_lot.unit), current_date, '直接数量変更',
      'update_inventory_lot', v_user_id, now()
    );
  end if;

  return p_inventory_lot_id;
end;
$$;

create or replace function public.complete_stocktake(
  p_inventory_lot_id text,
  p_actual_quantity numeric,
  p_stocktake_date date default current_date,
  p_reason text default null,
  p_counted_by text default null,
  p_notes text default null
) returns text
language plpgsql
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_lot public.inventory_lots%rowtype;
  v_stocktake_id text := gen_random_uuid()::text;
  v_line_id text := gen_random_uuid()::text;
  v_movement_id text := gen_random_uuid()::text;
  v_diff numeric;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select * into v_lot
  from public.inventory_lots
  where id = p_inventory_lot_id and user_id = v_user_id and status <> 'deleted'
  for update;

  if not found then
    raise exception 'inventory lot not found';
  end if;
  if coalesce(p_actual_quantity, 0) < v_lot.reserved_quantity then
    raise exception 'actual quantity cannot be lower than reserved quantity';
  end if;

  v_diff := coalesce(p_actual_quantity, 0) - v_lot.quantity;

  insert into public.stocktakes (
    id, user_id, stocktake_number, location, status, stocktake_date,
    started_at, completed_at, notes, created_by, created_at, updated_at
  ) values (
    v_stocktake_id, v_user_id, 'ST-' || to_char(now(), 'YYYYMMDDHH24MISS'),
    v_lot.location, 'completed', coalesce(p_stocktake_date, current_date),
    now(), now(), p_notes, v_user_id, now(), now()
  );

  insert into public.inventory_movements (
    id, user_id, product_id, inventory_lot_id, movement_type, quantity, unit, movement_date,
    reason, location_to, handler_name, notes, created_by, created_at
  ) values (
    v_movement_id, v_user_id, v_lot.product_id, p_inventory_lot_id, 'stocktake_adjustment',
    v_diff, v_lot.unit, coalesce(p_stocktake_date, current_date),
    coalesce(p_reason, '棚卸差異'), v_lot.location, nullif(p_counted_by, ''), p_notes, v_user_id, now()
  );

  insert into public.stocktake_lines (
    id, user_id, stocktake_id, product_id, inventory_lot_id, system_quantity,
    actual_quantity, difference_quantity, unit, difference_reason, adjustment_movement_id,
    counted_by, counted_at, created_at, updated_at
  ) values (
    v_line_id, v_user_id, v_stocktake_id, v_lot.product_id, p_inventory_lot_id,
    v_lot.quantity, coalesce(p_actual_quantity, 0), v_diff, v_lot.unit, p_reason,
    v_movement_id, p_counted_by, now(), now(), now()
  );

  update public.inventory_lots
  set quantity = coalesce(p_actual_quantity, 0),
      status = case when coalesce(p_actual_quantity, 0) <= 0 then 'exhausted' else status end,
      updated_at = now()
  where id = p_inventory_lot_id and user_id = v_user_id;

  return v_stocktake_id;
end;
$$;

create or replace function public.reserve_inventory(
  p_inventory_lot_id text,
  p_reserved_quantity numeric,
  p_customer_id text default null,
  p_project_id text default null,
  p_order_id text default null,
  p_quote_id text default null,
  p_required_date date default null,
  p_expires_at timestamptz default null,
  p_notes text default null
) returns text
language plpgsql
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_lot public.inventory_lots%rowtype;
  v_reservation_id text := gen_random_uuid()::text;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;
  if coalesce(p_reserved_quantity, 0) <= 0 then
    raise exception 'reserved quantity must be positive';
  end if;

  select * into v_lot
  from public.inventory_lots
  where id = p_inventory_lot_id and user_id = v_user_id and status = 'active'
  for update;

  if not found then
    raise exception 'inventory lot not found';
  end if;
  if (v_lot.quantity - v_lot.reserved_quantity) < p_reserved_quantity then
    raise exception 'available inventory is insufficient';
  end if;

  update public.inventory_lots
  set reserved_quantity = reserved_quantity + p_reserved_quantity,
      updated_at = now()
  where id = p_inventory_lot_id and user_id = v_user_id;

  insert into public.inventory_reservations (
    id, user_id, product_id, inventory_lot_id, customer_id, project_id, order_id, quote_id,
    reserved_quantity, fulfilled_quantity, released_quantity, unit, status, reserved_at,
    required_date, expires_at, notes, created_by, created_at, updated_at
  ) values (
    v_reservation_id, v_user_id, v_lot.product_id, p_inventory_lot_id,
    nullif(p_customer_id, ''), nullif(p_project_id, ''), nullif(p_order_id, ''), nullif(p_quote_id, ''),
    p_reserved_quantity, 0, 0, v_lot.unit, 'active', now(), p_required_date, p_expires_at, p_notes,
    v_user_id, now(), now()
  );

  insert into public.inventory_movements (
    id, user_id, product_id, inventory_lot_id, movement_type, quantity, unit, movement_date,
    reason, customer_id, project_id, quote_id, order_id, notes, created_by, created_at
  ) values (
    gen_random_uuid()::text, v_user_id, v_lot.product_id, p_inventory_lot_id, 'reservation',
    p_reserved_quantity, v_lot.unit, current_date, '在庫引当', nullif(p_customer_id, ''),
    nullif(p_project_id, ''), nullif(p_quote_id, ''), nullif(p_order_id, ''), p_notes, v_user_id, now()
  );

  return v_reservation_id;
end;
$$;

create or replace function public.release_inventory_reservation(
  p_reservation_id text,
  p_release_quantity numeric default null,
  p_notes text default null
) returns text
language plpgsql
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_res public.inventory_reservations%rowtype;
  v_lot public.inventory_lots%rowtype;
  v_release numeric;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select * into v_res
  from public.inventory_reservations
  where id = p_reservation_id and user_id = v_user_id
  for update;

  if not found then
    raise exception 'inventory reservation not found';
  end if;

  select * into v_lot
  from public.inventory_lots
  where id = v_res.inventory_lot_id and user_id = v_user_id
  for update;

  v_release := coalesce(p_release_quantity, v_res.reserved_quantity - v_res.fulfilled_quantity - v_res.released_quantity);
  if v_release <= 0 or v_release > (v_res.reserved_quantity - v_res.fulfilled_quantity - v_res.released_quantity) then
    raise exception 'invalid release quantity';
  end if;

  update public.inventory_lots
  set reserved_quantity = greatest(0, reserved_quantity - v_release),
      updated_at = now()
  where id = v_res.inventory_lot_id and user_id = v_user_id;

  update public.inventory_reservations
  set released_quantity = released_quantity + v_release,
      status = case
        when fulfilled_quantity + released_quantity + v_release >= reserved_quantity then 'released'
        else status
      end,
      updated_at = now()
  where id = p_reservation_id and user_id = v_user_id;

  insert into public.inventory_movements (
    id, user_id, product_id, inventory_lot_id, movement_type, quantity, unit, movement_date,
    reason, customer_id, project_id, quote_id, order_id, notes, created_by, created_at
  ) values (
    gen_random_uuid()::text, v_user_id, v_res.product_id, v_res.inventory_lot_id,
    'reservation_release', -v_release, v_lot.unit, current_date, '在庫引当解除',
    v_res.customer_id, v_res.project_id, v_res.quote_id, v_res.order_id, p_notes, v_user_id, now()
  );

  return p_reservation_id;
end;
$$;

create or replace function public.fulfill_inventory_reservation(
  p_reservation_id text,
  p_fulfill_quantity numeric,
  p_movement_date date default current_date,
  p_notes text default null
) returns text
language plpgsql
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_res public.inventory_reservations%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select * into v_res
  from public.inventory_reservations
  where id = p_reservation_id and user_id = v_user_id
  for update;

  if not found then
    raise exception 'inventory reservation not found';
  end if;
  if coalesce(p_fulfill_quantity, 0) <= 0 or p_fulfill_quantity > (v_res.reserved_quantity - v_res.fulfilled_quantity - v_res.released_quantity) then
    raise exception 'invalid fulfill quantity';
  end if;

  perform public.issue_inventory(
    v_res.inventory_lot_id,
    p_fulfill_quantity,
    'shipment',
    p_movement_date,
    '引当出荷',
    v_res.customer_id,
    v_res.project_id,
    v_res.quote_id,
    null,
    null,
    p_notes
  );

  update public.inventory_lots
  set reserved_quantity = greatest(0, reserved_quantity - p_fulfill_quantity),
      updated_at = now()
  where id = v_res.inventory_lot_id and user_id = v_user_id;

  update public.inventory_reservations
  set fulfilled_quantity = fulfilled_quantity + p_fulfill_quantity,
      status = case
        when fulfilled_quantity + p_fulfill_quantity >= reserved_quantity - released_quantity then 'fulfilled'
        else 'partially_fulfilled'
      end,
      updated_at = now()
  where id = p_reservation_id and user_id = v_user_id;

  return p_reservation_id;
end;
$$;

create or replace function public.transfer_inventory(
  p_inventory_lot_id text,
  p_location_to text,
  p_transfer_date date default current_date,
  p_handler_name text default null,
  p_notes text default null
) returns text
language plpgsql
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_lot public.inventory_lots%rowtype;
  v_out_id text := gen_random_uuid()::text;
  v_in_id text := gen_random_uuid()::text;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;
  if p_location_to is null or p_location_to = '' then
    raise exception 'destination location is required';
  end if;

  select * into v_lot
  from public.inventory_lots
  where id = p_inventory_lot_id and user_id = v_user_id and status <> 'deleted'
  for update;

  if not found then
    raise exception 'inventory lot not found';
  end if;

  insert into public.inventory_movements (
    id, user_id, product_id, inventory_lot_id, movement_type, quantity, unit, movement_date,
    reason, location_from, location_to, handler_name, notes, created_by, created_at
  ) values
  (
    v_out_id, v_user_id, v_lot.product_id, p_inventory_lot_id, 'transfer_out', -v_lot.quantity,
    v_lot.unit, coalesce(p_transfer_date, current_date), '保管場所移動', v_lot.location, p_location_to,
    nullif(p_handler_name, ''), p_notes, v_user_id, now()
  ),
  (
    v_in_id, v_user_id, v_lot.product_id, p_inventory_lot_id, 'transfer_in', v_lot.quantity,
    v_lot.unit, coalesce(p_transfer_date, current_date), '保管場所移動', v_lot.location, p_location_to,
    nullif(p_handler_name, ''), p_notes, v_user_id, now()
  );

  update public.inventory_lots
  set location = p_location_to,
      updated_at = now()
  where id = p_inventory_lot_id and user_id = v_user_id;

  return p_inventory_lot_id;
end;
$$;

-- Data migration from legacy inventories. Idempotent: lot ids reuse legacy inventory ids.
insert into public.inventory_lots (
  id, user_id, product_id, supplier_id, lot_number, quantity, reserved_quantity, unit, location,
  manufacture_date, received_date, expiry_date, purchase_unit_cost, currency, stock_type, owner,
  inventory_code, safety_stock, firm_deadline, eta, voucher_number, handler_name, status, notes,
  created_by, created_by_name, created_at, updated_at
)
select
  i.id,
  i.user_id,
  coalesce(nullif(i.product_id, ''), 'legacy-product-' || left(i.id, 8)),
  nullif(i.supplier_id, ''),
  coalesce(nullif(i.lot, ''), 'LEGACY-' || left(i.id, 8)),
  greatest(coalesce(i.quantity, 0), 0),
  least(greatest(coalesce(i.reserved_quantity, 0), 0), greatest(coalesce(i.quantity, 0), 0)),
  coalesce(nullif(i.unit, ''), 'kg'),
  nullif(i.location, ''),
  i.manufacture_date,
  i.received_date,
  i.expiry_date,
  i.cost,
  coalesce(nullif(i.currency, ''), 'JPY'),
  nullif(i.stock_type, ''),
  nullif(i.owner, ''),
  nullif(i.inventory_code, ''),
  i.safety_stock,
  i.firm_deadline,
  i.eta,
  nullif(i.voucher_number, ''),
  nullif(i.handler_name, ''),
  public.eigyo_inventory_status_from_legacy(i.inventory_status, i.expiry_date, coalesce(i.quantity, 0)),
  i.memo,
  i.created_by,
  i.created_by_name,
  coalesce(i.created_at, now()),
  coalesce(i.updated_at, now())
from public.inventories i
where i.user_id is not null
  and not exists (
    select 1 from public.inventory_lots l where l.id = i.id
  );

insert into public.inventory_movements (
  id, user_id, product_id, inventory_lot_id, movement_type, quantity, unit, movement_date,
  reason, location_to, supplier_id, voucher_number, handler_name, notes, original_payload,
  created_by, created_at
)
select
  'legacy-opening-' || i.id,
  i.user_id,
  coalesce(nullif(i.product_id, ''), 'legacy-product-' || left(i.id, 8)),
  i.id,
  'manual_adjustment',
  greatest(coalesce(i.quantity, 0), 0),
  coalesce(nullif(i.unit, ''), 'kg'),
  coalesce(i.received_date, coalesce(i.created_at, now())::date),
  '既存在庫移行',
  nullif(i.location, ''),
  nullif(i.supplier_id, ''),
  nullif(i.voucher_number, ''),
  nullif(i.handler_name, ''),
  i.memo,
  jsonb_build_object('legacy_inventory_id', i.id),
  i.created_by,
  coalesce(i.created_at, now())
from public.inventories i
where i.user_id is not null
  and not exists (
    select 1 from public.inventory_movements m where m.id = 'legacy-opening-' || i.id
  );

insert into public.inventory_movements (
  id, user_id, product_id, inventory_lot_id, movement_type, quantity, unit, movement_date,
  reason, project_id, quote_id, invoice_id, voucher_number, handler_name, notes,
  original_payload, created_by, created_at
)
select
  coalesce(nullif(item.value->>'id', ''), 'legacy-history-' || i.id || '-' || item.ordinality::text),
  i.user_id,
  coalesce(nullif(i.product_id, ''), 'legacy-product-' || left(i.id, 8)),
  i.id,
  case
    when item.value->>'type' = '入庫' then 'receipt'
    when item.value->>'type' = '出庫' then 'shipment'
    when item.value->>'type' = '棚卸' then 'stocktake_adjustment'
    else 'manual_adjustment'
  end,
  case
    when item.value->>'type' = '出庫' then -abs(coalesce(nullif(item.value->>'quantity', '')::numeric, 0))
    else coalesce(nullif(item.value->>'quantity', '')::numeric, 0)
  end,
  coalesce(nullif(item.value->>'unit', ''), i.unit, 'kg'),
  coalesce(nullif(item.value->>'date', '')::date, coalesce(i.updated_at, now())::date),
  nullif(item.value->>'reason', ''),
  nullif(item.value->>'projectId', ''),
  nullif(item.value->>'quoteId', ''),
  nullif(item.value->>'invoiceId', ''),
  nullif(i.voucher_number, ''),
  nullif(item.value->>'handlerName', ''),
  nullif(item.value->>'memo', ''),
  item.value,
  i.created_by,
  coalesce(nullif(item.value->>'createdAt', '')::timestamptz, now())
from public.inventories i
cross join lateral jsonb_array_elements(coalesce(i.movement_history, '[]'::jsonb)) with ordinality as item(value, ordinality)
where i.user_id is not null
  and not exists (
    select 1
    from public.inventory_movements m
    where m.id = coalesce(nullif(item.value->>'id', ''), 'legacy-history-' || i.id || '-' || item.ordinality::text)
  );

insert into public.inventory_migration_audits (
  id, migration_name, user_id, legacy_inventory_count, migrated_lot_count,
  legacy_quantity_total, migrated_quantity_total, legacy_reserved_total, migrated_reserved_total,
  quantity_difference, reserved_difference, warning
)
select
  'normalize-inventory-' || coalesce(i.user_id::text, 'unknown'),
  'normalize_inventory_tables',
  i.user_id,
  count(i.id)::integer,
  count(l.id)::integer,
  coalesce(sum(greatest(coalesce(i.quantity, 0), 0)), 0),
  coalesce(sum(coalesce(l.quantity, 0)), 0),
  coalesce(sum(least(greatest(coalesce(i.reserved_quantity, 0), 0), greatest(coalesce(i.quantity, 0), 0))), 0),
  coalesce(sum(coalesce(l.reserved_quantity, 0)), 0),
  coalesce(sum(greatest(coalesce(i.quantity, 0), 0)), 0) - coalesce(sum(coalesce(l.quantity, 0)), 0),
  coalesce(sum(least(greatest(coalesce(i.reserved_quantity, 0), 0), greatest(coalesce(i.quantity, 0), 0))), 0) - coalesce(sum(coalesce(l.reserved_quantity, 0)), 0),
  case
    when coalesce(sum(greatest(coalesce(i.quantity, 0), 0)), 0) <> coalesce(sum(coalesce(l.quantity, 0)), 0) then 'quantity difference detected'
    when coalesce(sum(least(greatest(coalesce(i.reserved_quantity, 0), 0), greatest(coalesce(i.quantity, 0), 0))), 0) <> coalesce(sum(coalesce(l.reserved_quantity, 0)), 0) then 'reserved quantity difference detected'
    else ''
  end
from public.inventories i
left join public.inventory_lots l on l.id = i.id and l.user_id = i.user_id
where i.user_id is not null
group by i.user_id
on conflict (id) do update
  set legacy_inventory_count = excluded.legacy_inventory_count,
      migrated_lot_count = excluded.migrated_lot_count,
      legacy_quantity_total = excluded.legacy_quantity_total,
      migrated_quantity_total = excluded.migrated_quantity_total,
      legacy_reserved_total = excluded.legacy_reserved_total,
      migrated_reserved_total = excluded.migrated_reserved_total,
      quantity_difference = excluded.quantity_difference,
      reserved_difference = excluded.reserved_difference,
      warning = excluded.warning,
      created_at = now();

notify pgrst, 'reload schema';

revoke all on function public.receive_inventory(text, text, text, text, numeric, text, text, date, date, date, numeric, text, text, text, text, numeric, date, date, text, text, text, text) from public, anon;
revoke all on function public.issue_inventory(text, numeric, text, date, text, text, text, text, text, text, text) from public, anon;
revoke all on function public.update_inventory_lot(text, jsonb) from public, anon;
revoke all on function public.complete_stocktake(text, numeric, date, text, text, text) from public, anon;
revoke all on function public.reserve_inventory(text, numeric, text, text, text, text, date, timestamptz, text) from public, anon;
revoke all on function public.release_inventory_reservation(text, numeric, text) from public, anon;
revoke all on function public.fulfill_inventory_reservation(text, numeric, date, text) from public, anon;
revoke all on function public.transfer_inventory(text, text, date, text, text) from public, anon;

grant execute on function public.receive_inventory(text, text, text, text, numeric, text, text, date, date, date, numeric, text, text, text, text, numeric, date, date, text, text, text, text) to authenticated;
grant execute on function public.issue_inventory(text, numeric, text, date, text, text, text, text, text, text, text) to authenticated;
grant execute on function public.update_inventory_lot(text, jsonb) to authenticated;
grant execute on function public.complete_stocktake(text, numeric, date, text, text, text) to authenticated;
grant execute on function public.reserve_inventory(text, numeric, text, text, text, text, date, timestamptz, text) to authenticated;
grant execute on function public.release_inventory_reservation(text, numeric, text) to authenticated;
grant execute on function public.fulfill_inventory_reservation(text, numeric, date, text) to authenticated;
grant execute on function public.transfer_inventory(text, text, date, text, text) to authenticated;
