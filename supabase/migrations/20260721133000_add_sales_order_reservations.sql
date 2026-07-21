alter table public.sales_orders
  add column if not exists priority integer not null default 3,
  add column if not exists reservation_status text not null default 'unreserved',
  add column if not exists reserved_total numeric not null default 0,
  add column if not exists shortage_total numeric not null default 0;

alter table public.sales_orders
  drop constraint if exists sales_orders_priority_check;

alter table public.sales_orders
  add constraint sales_orders_priority_check check (priority between 1 and 5);

alter table public.sales_orders
  drop constraint if exists sales_orders_reservation_status_check;

alter table public.sales_orders
  add constraint sales_orders_reservation_status_check check (reservation_status in ('unreserved', 'partial', 'reserved', 'shortage'));

alter table public.sales_order_lines
  add column if not exists reserved_quantity numeric not null default 0,
  add column if not exists shortage_quantity numeric not null default 0,
  add column if not exists reservation_status text not null default 'unreserved';

alter table public.sales_order_lines
  drop constraint if exists sales_order_lines_reservation_status_check;

alter table public.sales_order_lines
  add constraint sales_order_lines_reservation_status_check check (reservation_status in ('unreserved', 'partial', 'reserved', 'shortage'));

alter table public.inventory_reservations
  add column if not exists sales_order_line_id text;

create index if not exists idx_inventory_reservations_user_order_line_status
  on public.inventory_reservations (user_id, order_id, sales_order_line_id, status);

create index if not exists idx_sales_orders_user_reservation_status
  on public.sales_orders (user_id, reservation_status, priority, expected_delivery_date);

create or replace function public.refresh_sales_order_reservation_status(
  p_sales_order_id text
) returns jsonb
language plpgsql
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_ordered numeric := 0;
  v_reserved numeric := 0;
  v_shortage numeric := 0;
  v_status text := 'unreserved';
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  with line_totals as (
    select
      sol.id,
      coalesce(sol.quantity, 0) as ordered_quantity,
      coalesce(sum(
        case
          when ir.status in ('active', 'partially_fulfilled') then greatest(0, ir.reserved_quantity - ir.fulfilled_quantity - ir.released_quantity)
          else 0
        end
      ), 0) as reserved_quantity
    from public.sales_order_lines sol
    left join public.inventory_reservations ir
      on ir.user_id = v_user_id
      and ir.order_id = p_sales_order_id
      and ir.sales_order_line_id = sol.id
    where sol.user_id = v_user_id
      and sol.sales_order_id = p_sales_order_id
    group by sol.id, sol.quantity
  )
  update public.sales_order_lines sol
  set reserved_quantity = lt.reserved_quantity,
      shortage_quantity = greatest(0, lt.ordered_quantity - lt.reserved_quantity),
      reservation_status = case
        when lt.ordered_quantity <= 0 then 'unreserved'
        when lt.reserved_quantity >= lt.ordered_quantity then 'reserved'
        when lt.reserved_quantity > 0 then 'partial'
        else 'unreserved'
      end,
      updated_at = now()
  from line_totals lt
  where sol.id = lt.id
    and sol.user_id = v_user_id;

  select
    coalesce(sum(coalesce(quantity, 0)), 0),
    coalesce(sum(coalesce(reserved_quantity, 0)), 0),
    coalesce(sum(coalesce(shortage_quantity, 0)), 0)
  into v_ordered, v_reserved, v_shortage
  from public.sales_order_lines
  where user_id = v_user_id
    and sales_order_id = p_sales_order_id;

  v_status := case
    when v_ordered <= 0 then 'unreserved'
    when v_reserved >= v_ordered then 'reserved'
    when v_reserved > 0 then 'partial'
    when v_shortage > 0 then 'shortage'
    else 'unreserved'
  end;

  update public.sales_orders
  set reserved_total = v_reserved,
      shortage_total = greatest(0, v_ordered - v_reserved),
      reservation_status = v_status,
      updated_at = now()
  where id = p_sales_order_id
    and user_id = v_user_id;

  return jsonb_build_object(
    'salesOrderId', p_sales_order_id,
    'ordered', v_ordered,
    'reserved', v_reserved,
    'shortage', greatest(0, v_ordered - v_reserved),
    'status', v_status
  );
end;
$$;

create or replace function public.reserve_sales_order_line_lot(
  p_sales_order_id text,
  p_sales_order_line_id text,
  p_inventory_lot_id text,
  p_quantity numeric default null,
  p_notes text default null
) returns jsonb
language plpgsql
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_order public.sales_orders%rowtype;
  v_line public.sales_order_lines%rowtype;
  v_lot public.inventory_lots%rowtype;
  v_current_reserved numeric := 0;
  v_unreserved numeric := 0;
  v_available numeric := 0;
  v_allocate numeric := 0;
  v_reservation_id text := gen_random_uuid()::text;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select * into v_order
  from public.sales_orders
  where id = p_sales_order_id and user_id = v_user_id and is_deleted = false
  for update;

  if not found then
    raise exception 'sales order not found';
  end if;

  select * into v_line
  from public.sales_order_lines
  where id = p_sales_order_line_id and sales_order_id = p_sales_order_id and user_id = v_user_id
  for update;

  if not found then
    raise exception 'sales order line not found';
  end if;
  if v_line.product_id is null or v_line.product_id = '' then
    raise exception 'product_id is required for reservation';
  end if;

  select * into v_lot
  from public.inventory_lots
  where id = p_inventory_lot_id
    and user_id = v_user_id
    and product_id = v_line.product_id
    and status = 'active'
    and (expiry_date is null or expiry_date >= current_date)
    and quantity > reserved_quantity
  for update;

  if not found then
    raise exception 'available lot not found';
  end if;

  select coalesce(sum(greatest(0, reserved_quantity - fulfilled_quantity - released_quantity)), 0)
  into v_current_reserved
  from public.inventory_reservations
  where user_id = v_user_id
    and order_id = p_sales_order_id
    and sales_order_line_id = p_sales_order_line_id
    and status in ('active', 'partially_fulfilled');

  v_unreserved := greatest(0, coalesce(v_line.quantity, 0) - v_current_reserved);
  v_available := greatest(0, v_lot.quantity - v_lot.reserved_quantity);
  v_allocate := least(coalesce(p_quantity, v_unreserved), v_unreserved, v_available);

  if v_allocate <= 0 then
    return public.refresh_sales_order_reservation_status(p_sales_order_id);
  end if;

  update public.inventory_lots
  set reserved_quantity = reserved_quantity + v_allocate,
      updated_at = now()
  where id = p_inventory_lot_id
    and user_id = v_user_id;

  insert into public.inventory_reservations (
    id, user_id, product_id, inventory_lot_id, customer_id, project_id, order_id, sales_order_line_id, quote_id,
    reserved_quantity, fulfilled_quantity, released_quantity, unit, status, reserved_at,
    required_date, notes, created_by, created_at, updated_at
  ) values (
    v_reservation_id, v_user_id, v_line.product_id, p_inventory_lot_id, v_order.customer_id, v_order.project_id,
    p_sales_order_id, p_sales_order_line_id, v_order.quote_id, v_allocate, 0, 0, coalesce(v_line.unit, v_lot.unit),
    'active', now(), v_order.expected_delivery_date, p_notes, v_user_id, now(), now()
  );

  insert into public.inventory_movements (
    id, user_id, product_id, inventory_lot_id, movement_type, quantity, unit, movement_date,
    reason, customer_id, project_id, quote_id, order_id, notes, created_by, created_at
  ) values (
    gen_random_uuid()::text, v_user_id, v_line.product_id, p_inventory_lot_id, 'reservation',
    v_allocate, coalesce(v_line.unit, v_lot.unit), current_date, 'sales order reservation',
    v_order.customer_id, v_order.project_id, v_order.quote_id, p_sales_order_id, p_notes, v_user_id, now()
  );

  return public.refresh_sales_order_reservation_status(p_sales_order_id);
end;
$$;

create or replace function public.reserve_sales_order_line_fefo(
  p_sales_order_id text,
  p_sales_order_line_id text,
  p_quantity numeric default null,
  p_notes text default null
) returns jsonb
language plpgsql
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_order public.sales_orders%rowtype;
  v_line public.sales_order_lines%rowtype;
  v_lot record;
  v_current_reserved numeric := 0;
  v_remaining numeric := 0;
  v_allocate numeric := 0;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select * into v_order
  from public.sales_orders
  where id = p_sales_order_id and user_id = v_user_id and is_deleted = false
  for update;

  if not found then
    raise exception 'sales order not found';
  end if;

  select * into v_line
  from public.sales_order_lines
  where id = p_sales_order_line_id and sales_order_id = p_sales_order_id and user_id = v_user_id
  for update;

  if not found then
    raise exception 'sales order line not found';
  end if;
  if v_line.product_id is null or v_line.product_id = '' then
    raise exception 'product_id is required for reservation';
  end if;

  select coalesce(sum(greatest(0, reserved_quantity - fulfilled_quantity - released_quantity)), 0)
  into v_current_reserved
  from public.inventory_reservations
  where user_id = v_user_id
    and order_id = p_sales_order_id
    and sales_order_line_id = p_sales_order_line_id
    and status in ('active', 'partially_fulfilled');

  v_remaining := least(coalesce(p_quantity, greatest(0, coalesce(v_line.quantity, 0) - v_current_reserved)), greatest(0, coalesce(v_line.quantity, 0) - v_current_reserved));

  for v_lot in
    select *
    from public.inventory_lots
    where user_id = v_user_id
      and product_id = v_line.product_id
      and status = 'active'
      and (expiry_date is null or expiry_date >= current_date)
      and quantity > reserved_quantity
    order by (expiry_date is null), expiry_date asc, (received_date is null), received_date asc, created_at asc
    for update skip locked
  loop
    exit when v_remaining <= 0;
    v_allocate := least(v_remaining, greatest(0, v_lot.quantity - v_lot.reserved_quantity));
    if v_allocate > 0 then
      perform public.reserve_sales_order_line_lot(p_sales_order_id, p_sales_order_line_id, v_lot.id, v_allocate, p_notes);
      v_remaining := v_remaining - v_allocate;
    end if;
  end loop;

  return public.refresh_sales_order_reservation_status(p_sales_order_id);
end;
$$;

create or replace function public.release_sales_order_line_reservations(
  p_sales_order_id text,
  p_sales_order_line_id text,
  p_reservation_id text default null,
  p_release_quantity numeric default null,
  p_notes text default null
) returns jsonb
language plpgsql
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_res record;
  v_release_left numeric;
  v_release numeric;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  v_release_left := coalesce(p_release_quantity, 999999999999);

  for v_res in
    select *
    from public.inventory_reservations
    where user_id = v_user_id
      and order_id = p_sales_order_id
      and sales_order_line_id = p_sales_order_line_id
      and (p_reservation_id is null or id = p_reservation_id)
      and status in ('active', 'partially_fulfilled')
    order by reserved_at desc
    for update
  loop
    exit when v_release_left <= 0;
    v_release := least(v_release_left, greatest(0, v_res.reserved_quantity - v_res.fulfilled_quantity - v_res.released_quantity));
    if v_release > 0 then
      update public.inventory_lots
      set reserved_quantity = greatest(0, reserved_quantity - v_release),
          updated_at = now()
      where id = v_res.inventory_lot_id
        and user_id = v_user_id;

      update public.inventory_reservations
      set released_quantity = released_quantity + v_release,
          status = case
            when fulfilled_quantity + released_quantity + v_release >= reserved_quantity then 'released'
            else status
          end,
          updated_at = now()
      where id = v_res.id
        and user_id = v_user_id;

      insert into public.inventory_movements (
        id, user_id, product_id, inventory_lot_id, movement_type, quantity, unit, movement_date,
        reason, customer_id, project_id, quote_id, order_id, notes, created_by, created_at
      ) values (
        gen_random_uuid()::text, v_user_id, v_res.product_id, v_res.inventory_lot_id,
        'reservation_release', -v_release, v_res.unit, current_date, 'sales order reservation release',
        v_res.customer_id, v_res.project_id, v_res.quote_id, v_res.order_id, p_notes, v_user_id, now()
      );

      v_release_left := v_release_left - v_release;
    end if;
  end loop;

  return public.refresh_sales_order_reservation_status(p_sales_order_id);
end;
$$;

create or replace function public.reallocate_sales_order_line_fefo(
  p_sales_order_id text,
  p_sales_order_line_id text,
  p_quantity numeric default null,
  p_notes text default null
) returns jsonb
language plpgsql
as $$
begin
  return public.reserve_sales_order_line_fefo(p_sales_order_id, p_sales_order_line_id, p_quantity, p_notes);
end;
$$;

create or replace function public.reserve_sales_order_fefo(
  p_sales_order_id text
) returns jsonb
language plpgsql
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_line record;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  for v_line in
    select id
    from public.sales_order_lines
    where user_id = v_user_id
      and sales_order_id = p_sales_order_id
    order by line_number asc
  loop
    perform public.reserve_sales_order_line_fefo(p_sales_order_id, v_line.id, null, 'sales order full reservation');
  end loop;

  return public.refresh_sales_order_reservation_status(p_sales_order_id);
end;
$$;

create or replace function public.reserve_sales_orders_fefo()
returns jsonb
language plpgsql
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_order record;
  v_count integer := 0;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  for v_order in
    select id
    from public.sales_orders
    where user_id = v_user_id
      and is_deleted = false
      and reservation_status <> 'reserved'
      and status <> '取消'
    order by priority asc, expected_delivery_date asc nulls last, order_date asc nulls last, created_at asc
  loop
    perform public.reserve_sales_order_fefo(v_order.id);
    v_count := v_count + 1;
  end loop;

  return jsonb_build_object('processed', v_count);
end;
$$;

revoke all on function public.refresh_sales_order_reservation_status(text) from public, anon;
revoke all on function public.reserve_sales_order_line_lot(text, text, text, numeric, text) from public, anon;
revoke all on function public.reserve_sales_order_line_fefo(text, text, numeric, text) from public, anon;
revoke all on function public.release_sales_order_line_reservations(text, text, text, numeric, text) from public, anon;
revoke all on function public.reallocate_sales_order_line_fefo(text, text, numeric, text) from public, anon;
revoke all on function public.reserve_sales_order_fefo(text) from public, anon;
revoke all on function public.reserve_sales_orders_fefo() from public, anon;

grant execute on function public.refresh_sales_order_reservation_status(text) to authenticated;
grant execute on function public.reserve_sales_order_line_lot(text, text, text, numeric, text) to authenticated;
grant execute on function public.reserve_sales_order_line_fefo(text, text, numeric, text) to authenticated;
grant execute on function public.release_sales_order_line_reservations(text, text, text, numeric, text) to authenticated;
grant execute on function public.reallocate_sales_order_line_fefo(text, text, numeric, text) to authenticated;
grant execute on function public.reserve_sales_order_fefo(text) to authenticated;
grant execute on function public.reserve_sales_orders_fefo() to authenticated;

notify pgrst, 'reload schema';
