alter table public.inventory_movements
  drop constraint if exists inventory_movements_type_check;

alter table public.inventory_movements
  add constraint inventory_movements_type_check check (
    movement_type in (
      'receipt',
      'shipment',
      'shipment_cancel',
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
  );

alter table public.sales_orders
  add column if not exists shipment_status text not null default 'unshipped',
  add column if not exists shipped_total numeric not null default 0;

alter table public.sales_orders
  drop constraint if exists sales_orders_shipment_status_check;

alter table public.sales_orders
  add constraint sales_orders_shipment_status_check check (shipment_status in ('unshipped', 'partial', 'shipped'));

alter table public.sales_order_lines
  add column if not exists shipped_quantity numeric not null default 0,
  add column if not exists remaining_quantity numeric not null default 0,
  add column if not exists shipment_status text not null default 'unshipped';

alter table public.sales_order_lines
  drop constraint if exists sales_order_lines_shipment_status_check;

alter table public.sales_order_lines
  add constraint sales_order_lines_shipment_status_check check (shipment_status in ('unshipped', 'partial', 'shipped'));

create table if not exists public.shipments (
  id text primary key,
  user_id uuid not null,
  shipment_number text not null,
  sales_order_id text not null references public.sales_orders(id) on delete cascade,
  customer_id text,
  status text not null default 'Draft',
  shipment_date date,
  planned_delivery_date date,
  carrier text default '',
  tracking_number text default '',
  delivery_address_snapshot jsonb,
  note text default '',
  shipped_at timestamptz,
  cancelled_at timestamptz,
  status_history jsonb not null default '[]'::jsonb,
  created_by uuid,
  created_by_name text default '',
  updated_by uuid,
  updated_by_name text default '',
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shipments_status_check check (status in ('Draft', 'Picking', 'Ready', 'Shipped', 'Cancelled'))
);

create table if not exists public.shipment_lines (
  id text primary key,
  user_id uuid not null,
  shipment_id text not null references public.shipments(id) on delete cascade,
  sales_order_line_id text not null,
  inventory_reservation_id text references public.inventory_reservations(id),
  inventory_lot_id text not null references public.inventory_lots(id),
  product_id text not null,
  quantity numeric not null default 0,
  unit text default '',
  lot_snapshot jsonb,
  expiry_snapshot text default '',
  created_at timestamptz not null default now(),
  constraint shipment_lines_quantity_positive check (quantity > 0)
);

create unique index if not exists shipments_user_number_unique
  on public.shipments (user_id, lower(shipment_number))
  where is_deleted = false;

create index if not exists idx_shipments_user_order on public.shipments (user_id, sales_order_id, created_at desc);
create index if not exists idx_shipments_user_status on public.shipments (user_id, status, shipment_date desc);
create index if not exists idx_shipment_lines_user_shipment on public.shipment_lines (user_id, shipment_id);
create index if not exists idx_shipment_lines_user_order_line on public.shipment_lines (user_id, sales_order_line_id);
create index if not exists idx_shipment_lines_user_lot on public.shipment_lines (user_id, inventory_lot_id);
create index if not exists idx_sales_orders_user_shipment_status on public.sales_orders (user_id, shipment_status, expected_delivery_date);

alter table public.shipments enable row level security;
alter table public.shipment_lines enable row level security;

grant select, insert, update, delete on public.shipments to authenticated;
grant select, insert, update, delete on public.shipment_lines to authenticated;

drop policy if exists "shipments_select_own" on public.shipments;
create policy "shipments_select_own"
  on public.shipments for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "shipments_insert_own" on public.shipments;
create policy "shipments_insert_own"
  on public.shipments for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "shipments_update_own" on public.shipments;
create policy "shipments_update_own"
  on public.shipments for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "shipments_delete_own" on public.shipments;
create policy "shipments_delete_own"
  on public.shipments for delete to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "shipment_lines_select_own" on public.shipment_lines;
create policy "shipment_lines_select_own"
  on public.shipment_lines for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "shipment_lines_insert_own" on public.shipment_lines;
create policy "shipment_lines_insert_own"
  on public.shipment_lines for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "shipment_lines_update_own" on public.shipment_lines;
create policy "shipment_lines_update_own"
  on public.shipment_lines for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "shipment_lines_delete_own" on public.shipment_lines;
create policy "shipment_lines_delete_own"
  on public.shipment_lines for delete to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.generate_shipment_number()
returns text
language plpgsql
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_prefix text := 'SHP-' || to_char(current_date, 'YYYYMMDD') || '-';
  v_next integer;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select coalesce(max(nullif(replace(shipment_number, v_prefix, ''), '')::integer), 0) + 1
  into v_next
  from public.shipments
  where user_id = v_user_id
    and shipment_number like v_prefix || '%';

  return v_prefix || lpad(v_next::text, 6, '0');
end;
$$;

create or replace function public.refresh_sales_order_shipment_status(
  p_sales_order_id text
) returns jsonb
language plpgsql
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_ordered numeric := 0;
  v_shipped numeric := 0;
  v_status text := 'unshipped';
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  with line_totals as (
    select
      sol.id,
      coalesce(sol.quantity, 0) as ordered_quantity,
      coalesce(sum(case when s.status = 'Shipped' and s.is_deleted = false then sl.quantity else 0 end), 0) as shipped_quantity
    from public.sales_order_lines sol
    left join public.shipment_lines sl
      on sl.user_id = v_user_id
      and sl.sales_order_line_id = sol.id
    left join public.shipments s
      on s.user_id = v_user_id
      and s.id = sl.shipment_id
    where sol.user_id = v_user_id
      and sol.sales_order_id = p_sales_order_id
    group by sol.id, sol.quantity
  )
  update public.sales_order_lines sol
  set shipped_quantity = lt.shipped_quantity,
      remaining_quantity = greatest(0, lt.ordered_quantity - lt.shipped_quantity),
      shipment_status = case
        when lt.ordered_quantity <= 0 then 'unshipped'
        when lt.shipped_quantity >= lt.ordered_quantity then 'shipped'
        when lt.shipped_quantity > 0 then 'partial'
        else 'unshipped'
      end,
      updated_at = now()
  from line_totals lt
  where sol.id = lt.id
    and sol.user_id = v_user_id;

  select
    coalesce(sum(coalesce(quantity, 0)), 0),
    coalesce(sum(coalesce(shipped_quantity, 0)), 0)
  into v_ordered, v_shipped
  from public.sales_order_lines
  where user_id = v_user_id
    and sales_order_id = p_sales_order_id;

  v_status := case
    when v_ordered <= 0 then 'unshipped'
    when v_shipped >= v_ordered then 'shipped'
    when v_shipped > 0 then 'partial'
    else 'unshipped'
  end;

  update public.sales_orders
  set shipped_total = v_shipped,
      shipment_status = v_status,
      updated_at = now()
  where id = p_sales_order_id
    and user_id = v_user_id;

  return jsonb_build_object(
    'salesOrderId', p_sales_order_id,
    'ordered', v_ordered,
    'shipped', v_shipped,
    'remaining', greatest(0, v_ordered - v_shipped),
    'status', v_status
  );
end;
$$;

create or replace function public.create_sales_order_shipment(
  p_sales_order_id text,
  p_lines jsonb default null,
  p_status text default 'Draft',
  p_shipment_date date default current_date,
  p_planned_delivery_date date default null,
  p_carrier text default null,
  p_tracking_number text default null,
  p_note text default null
) returns jsonb
language plpgsql
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_order public.sales_orders%rowtype;
  v_shipment_id text := gen_random_uuid()::text;
  v_shipment_number text;
  v_line record;
  v_res record;
  v_request_reservation_id text;
  v_request_lot_id text;
  v_request_quantity numeric;
  v_remaining_request numeric;
  v_remaining_to_ship numeric;
  v_open_shipment_quantity numeric;
  v_reservation_open numeric;
  v_quantity numeric;
  v_inserted integer := 0;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;
  if coalesce(p_status, 'Draft') not in ('Draft', 'Picking', 'Ready') then
    raise exception 'new shipment status must be Draft, Picking, or Ready';
  end if;

  select * into v_order
  from public.sales_orders
  where id = p_sales_order_id
    and user_id = v_user_id
    and is_deleted = false
  for update;

  if not found then
    raise exception 'sales order not found';
  end if;

  v_shipment_number := public.generate_shipment_number();

  insert into public.shipments (
    id, user_id, shipment_number, sales_order_id, customer_id, status, shipment_date,
    planned_delivery_date, carrier, tracking_number, delivery_address_snapshot, note,
    status_history, created_by, updated_by, created_at, updated_at
  ) values (
    v_shipment_id, v_user_id, v_shipment_number, p_sales_order_id, v_order.customer_id,
    coalesce(p_status, 'Draft'), p_shipment_date, p_planned_delivery_date,
    coalesce(p_carrier, ''), coalesce(p_tracking_number, ''), v_order.customer_snapshot,
    coalesce(p_note, ''), jsonb_build_array(jsonb_build_object('status', coalesce(p_status, 'Draft'), 'at', now())),
    v_user_id, v_user_id, now(), now()
  );

  for v_line in
    select *
    from public.sales_order_lines
    where user_id = v_user_id
      and sales_order_id = p_sales_order_id
    order by line_number asc
    for update
  loop
    v_remaining_request := null;
    v_request_reservation_id := null;
    v_request_lot_id := null;
    v_request_quantity := null;

    if p_lines is not null and jsonb_array_length(p_lines) > 0 then
      select
        nullif(item.value->>'inventoryReservationId', '') as inventory_reservation_id,
        nullif(item.value->>'inventoryLotId', '') as inventory_lot_id,
        coalesce(nullif(item.value->>'quantity', '')::numeric, 0) as quantity
      into v_request_reservation_id, v_request_lot_id, v_request_quantity
      from jsonb_array_elements(p_lines) as item(value)
      where item.value->>'salesOrderLineId' = v_line.id
      limit 1;

      if not found or coalesce(v_request_quantity, 0) <= 0 then
        continue;
      end if;
      v_remaining_request := v_request_quantity;
    end if;

    select coalesce(sum(case when s.status = 'Shipped' and s.is_deleted = false then sl.quantity else 0 end), 0)
    into v_remaining_to_ship
    from public.shipment_lines sl
    join public.shipments s on s.id = sl.shipment_id and s.user_id = v_user_id
    where sl.user_id = v_user_id
      and sl.sales_order_line_id = v_line.id;

    v_remaining_to_ship := greatest(0, coalesce(v_line.quantity, 0) - v_remaining_to_ship);

    select coalesce(sum(case when s.status in ('Draft', 'Picking', 'Ready') and s.is_deleted = false then sl.quantity else 0 end), 0)
    into v_open_shipment_quantity
    from public.shipment_lines sl
    join public.shipments s on s.id = sl.shipment_id and s.user_id = v_user_id
    where sl.user_id = v_user_id
      and sl.sales_order_line_id = v_line.id;

    v_remaining_to_ship := greatest(0, v_remaining_to_ship - v_open_shipment_quantity);
    v_remaining_request := least(coalesce(v_remaining_request, v_remaining_to_ship), v_remaining_to_ship);

    for v_res in
      select ir.*, il.lot_number, il.expiry_date, il.location, il.inventory_code, il.owner, il.stock_type
      from public.inventory_reservations ir
      join public.inventory_lots il on il.id = ir.inventory_lot_id and il.user_id = v_user_id
      where ir.user_id = v_user_id
        and ir.order_id = p_sales_order_id
        and ir.sales_order_line_id = v_line.id
        and ir.status in ('active', 'partially_fulfilled')
        and greatest(0, ir.reserved_quantity - ir.fulfilled_quantity - ir.released_quantity) > 0
        and (v_request_reservation_id is null or ir.id = v_request_reservation_id)
        and (v_request_lot_id is null or ir.inventory_lot_id = v_request_lot_id)
      order by ir.reserved_at asc
      for update
    loop
      exit when v_remaining_request <= 0;
      v_reservation_open := greatest(0, v_res.reserved_quantity - v_res.fulfilled_quantity - v_res.released_quantity);
      v_quantity := least(v_remaining_request, v_reservation_open);
      if v_quantity > 0 then
        insert into public.shipment_lines (
          id, user_id, shipment_id, sales_order_line_id, inventory_reservation_id, inventory_lot_id,
          product_id, quantity, unit, lot_snapshot, expiry_snapshot, created_at
        ) values (
          gen_random_uuid()::text, v_user_id, v_shipment_id, v_line.id, v_res.id, v_res.inventory_lot_id,
          v_line.product_id, v_quantity, coalesce(v_line.unit, v_res.unit),
          jsonb_build_object(
            'inventoryLotId', v_res.inventory_lot_id,
            'inventoryCode', v_res.inventory_code,
            'lotNumber', v_res.lot_number,
            'expiryDate', v_res.expiry_date,
            'location', v_res.location,
            'owner', v_res.owner,
            'stockType', v_res.stock_type
          ),
          coalesce(v_res.expiry_date::text, ''),
          now()
        );
        v_inserted := v_inserted + 1;
        v_remaining_request := v_remaining_request - v_quantity;
      end if;
    end loop;

    if v_remaining_request > 0 then
      raise exception 'shipment quantity exceeds reserved quantity for line %', v_line.id;
    end if;
  end loop;

  if v_inserted = 0 then
    delete from public.shipments where id = v_shipment_id and user_id = v_user_id;
    raise exception 'no shippable reserved lines found';
  end if;

  perform public.refresh_sales_order_shipment_status(p_sales_order_id);

  return jsonb_build_object('shipmentId', v_shipment_id, 'shipmentNumber', v_shipment_number, 'lineCount', v_inserted);
end;
$$;

create or replace function public.update_sales_order_shipment_status(
  p_shipment_id text,
  p_status text,
  p_shipment_date date default null,
  p_note text default null
) returns jsonb
language plpgsql
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_shipment public.shipments%rowtype;
  v_line record;
  v_lot public.inventory_lots%rowtype;
  v_res public.inventory_reservations%rowtype;
  v_next_status text := coalesce(p_status, '');
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;
  if v_next_status not in ('Draft', 'Picking', 'Ready', 'Shipped', 'Cancelled') then
    raise exception 'invalid shipment status';
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
  if v_shipment.status = v_next_status then
    return jsonb_build_object('shipmentId', p_shipment_id, 'status', v_next_status);
  end if;
  if v_shipment.status = 'Cancelled' then
    raise exception 'cancelled shipment cannot be changed';
  end if;

  if v_next_status = 'Shipped' then
    if v_shipment.status not in ('Draft', 'Picking', 'Ready') then
      raise exception 'only Draft/Picking/Ready shipments can be shipped';
    end if;

    for v_line in
      select sl.*, sol.quantity as order_quantity, sol.product_name
      from public.shipment_lines sl
      join public.sales_order_lines sol on sol.id = sl.sales_order_line_id and sol.user_id = v_user_id
      where sl.user_id = v_user_id
        and sl.shipment_id = p_shipment_id
      order by sol.line_number asc
      for update
    loop
      select * into v_res
      from public.inventory_reservations
      where id = v_line.inventory_reservation_id
        and user_id = v_user_id
      for update;

      if not found then
        raise exception 'reservation not found for shipment line %', v_line.id;
      end if;
      if v_line.quantity > greatest(0, v_res.reserved_quantity - v_res.fulfilled_quantity - v_res.released_quantity) then
        raise exception 'shipment quantity exceeds active reservation for line %', v_line.sales_order_line_id;
      end if;

      select * into v_lot
      from public.inventory_lots
      where id = v_line.inventory_lot_id
        and user_id = v_user_id
      for update;

      if not found then
        raise exception 'inventory lot not found';
      end if;
      if v_lot.quantity < v_line.quantity or v_lot.reserved_quantity < v_line.quantity then
        raise exception 'inventory is insufficient for shipment line %', v_line.sales_order_line_id;
      end if;

      update public.inventory_lots
      set quantity = quantity - v_line.quantity,
          reserved_quantity = greatest(0, reserved_quantity - v_line.quantity),
          status = case when quantity - v_line.quantity <= 0 then 'exhausted' else status end,
          updated_at = now()
      where id = v_line.inventory_lot_id
        and user_id = v_user_id;

      update public.inventory_reservations
      set fulfilled_quantity = fulfilled_quantity + v_line.quantity,
          status = case
            when fulfilled_quantity + v_line.quantity >= reserved_quantity - released_quantity then 'fulfilled'
            else 'partially_fulfilled'
          end,
          updated_at = now()
      where id = v_line.inventory_reservation_id
        and user_id = v_user_id;

      insert into public.inventory_movements (
        id, user_id, product_id, inventory_lot_id, movement_type, quantity, unit, movement_date,
        reason, customer_id, project_id, quote_id, order_id, shipment_id, location_from,
        notes, created_by, created_at
      ) values (
        gen_random_uuid()::text, v_user_id, v_line.product_id, v_line.inventory_lot_id,
        'shipment', -v_line.quantity, v_line.unit, coalesce(p_shipment_date, v_shipment.shipment_date, current_date),
        'sales order shipment', v_shipment.customer_id, v_res.project_id, v_res.quote_id,
        v_shipment.sales_order_id, p_shipment_id, v_lot.location, p_note, v_user_id, now()
      );
    end loop;

    update public.shipments
    set status = 'Shipped',
        shipment_date = coalesce(p_shipment_date, shipment_date, current_date),
        shipped_at = now(),
        note = coalesce(p_note, note),
        status_history = status_history || jsonb_build_array(jsonb_build_object('status', 'Shipped', 'at', now())),
        updated_by = v_user_id,
        updated_at = now()
    where id = p_shipment_id
      and user_id = v_user_id;
  elsif v_next_status = 'Cancelled' then
    if v_shipment.status = 'Shipped' then
      for v_line in
        select *
        from public.shipment_lines
        where user_id = v_user_id
          and shipment_id = p_shipment_id
        for update
      loop
        select * into v_res
        from public.inventory_reservations
        where id = v_line.inventory_reservation_id
          and user_id = v_user_id
        for update;

        select * into v_lot
        from public.inventory_lots
        where id = v_line.inventory_lot_id
          and user_id = v_user_id
        for update;

        if not found then
          raise exception 'inventory lot not found';
        end if;
        if found and v_res.fulfilled_quantity < v_line.quantity then
          raise exception 'fulfilled reservation quantity is insufficient to cancel';
        end if;

        update public.inventory_lots
        set quantity = quantity + v_line.quantity,
            reserved_quantity = reserved_quantity + v_line.quantity,
            status = case when status = 'exhausted' then 'active' else status end,
            updated_at = now()
        where id = v_line.inventory_lot_id
          and user_id = v_user_id;

        update public.inventory_reservations
        set fulfilled_quantity = greatest(0, fulfilled_quantity - v_line.quantity),
            status = case
              when greatest(0, fulfilled_quantity - v_line.quantity) <= 0 then 'active'
              else 'partially_fulfilled'
            end,
            updated_at = now()
        where id = v_line.inventory_reservation_id
          and user_id = v_user_id;

        insert into public.inventory_movements (
          id, user_id, product_id, inventory_lot_id, movement_type, quantity, unit, movement_date,
          reason, customer_id, project_id, quote_id, order_id, shipment_id, location_to,
          notes, created_by, created_at
        ) values (
          gen_random_uuid()::text, v_user_id, v_line.product_id, v_line.inventory_lot_id,
          'shipment_cancel', v_line.quantity, v_line.unit, current_date, 'sales order shipment cancel',
          v_shipment.customer_id, v_res.project_id, v_res.quote_id, v_shipment.sales_order_id,
          p_shipment_id, v_lot.location, p_note, v_user_id, now()
        );
      end loop;
    end if;

    update public.shipments
    set status = 'Cancelled',
        cancelled_at = now(),
        note = coalesce(p_note, note),
        status_history = status_history || jsonb_build_array(jsonb_build_object('status', 'Cancelled', 'at', now())),
        updated_by = v_user_id,
        updated_at = now()
    where id = p_shipment_id
      and user_id = v_user_id;
  else
    update public.shipments
    set status = v_next_status,
        shipment_date = coalesce(p_shipment_date, shipment_date),
        note = coalesce(p_note, note),
        status_history = status_history || jsonb_build_array(jsonb_build_object('status', v_next_status, 'at', now())),
        updated_by = v_user_id,
        updated_at = now()
    where id = p_shipment_id
      and user_id = v_user_id;
  end if;

  perform public.refresh_sales_order_reservation_status(v_shipment.sales_order_id);
  return public.refresh_sales_order_shipment_status(v_shipment.sales_order_id) || jsonb_build_object('shipmentId', p_shipment_id, 'status', v_next_status);
end;
$$;

revoke all on function public.generate_shipment_number() from public, anon;
revoke all on function public.refresh_sales_order_shipment_status(text) from public, anon;
revoke all on function public.create_sales_order_shipment(text, jsonb, text, date, date, text, text, text) from public, anon;
revoke all on function public.update_sales_order_shipment_status(text, text, date, text) from public, anon;

grant execute on function public.generate_shipment_number() to authenticated;
grant execute on function public.refresh_sales_order_shipment_status(text) to authenticated;
grant execute on function public.create_sales_order_shipment(text, jsonb, text, date, date, text, text, text) to authenticated;
grant execute on function public.update_sales_order_shipment_status(text, text, date, text) to authenticated;

notify pgrst, 'reload schema';
