create or replace function public.reverse_inbound_receipt(
  p_inbound_receipt_id text,
  p_reason text default null
) returns jsonb
language plpgsql
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_receipt public.inbound_receipts%rowtype;
  v_receipt_line public.inbound_receipt_lines%rowtype;
  v_lot public.inventory_lots%rowtype;
  v_inbound_line public.inbound_shipment_lines%rowtype;
  v_original_movement public.inventory_movements%rowtype;
  v_cancel_quantity numeric;
  v_new_lot_quantity numeric;
  v_new_received_weight numeric;
  v_new_received_pieces numeric;
  v_new_remaining_weight numeric;
  v_new_remaining_pieces numeric;
  v_new_line_status text;
  v_open_line_count integer;
  v_received_line_count integer;
  v_unmatched_line_count integer;
  v_reversed_lines integer := 0;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;
  if p_inbound_receipt_id is null or p_inbound_receipt_id = '' then
    raise exception 'inbound_receipt_id is required';
  end if;
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'reverse reason is required';
  end if;

  select *
    into v_receipt
  from public.inbound_receipts
  where id = p_inbound_receipt_id
    and user_id = v_user_id
  for update;

  if not found then
    raise exception 'inbound receipt not found';
  end if;
  if v_receipt.voided_at is not null then
    raise exception 'inbound receipt is already voided';
  end if;

  for v_receipt_line in
    select *
    from public.inbound_receipt_lines
    where inbound_receipt_id = p_inbound_receipt_id
      and user_id = v_user_id
    order by created_at, id
    for update
  loop
    if v_receipt_line.voided_at is not null then
      raise exception 'inbound receipt line is already voided';
    end if;
    if v_receipt_line.inventory_lot_id is null or v_receipt_line.inventory_lot_id = '' then
      raise exception 'inventory lot is required for inbound receipt line %', v_receipt_line.id;
    end if;

    select *
      into v_lot
    from public.inventory_lots
    where id = v_receipt_line.inventory_lot_id
      and user_id = v_user_id
    for update;

    if not found then
      raise exception 'inventory lot not found for inbound receipt line %', v_receipt_line.id;
    end if;
    if v_lot.inbound_receipt_id is distinct from p_inbound_receipt_id
       or v_lot.inbound_shipment_line_id is distinct from v_receipt_line.inbound_shipment_line_id
       or v_lot.product_id is distinct from v_receipt_line.product_id then
      raise exception 'inventory lot is not linked to the inbound receipt line %', v_receipt_line.id;
    end if;
    if coalesce(v_lot.reserved_quantity, 0) > 0 then
      raise exception '既に引当または出荷されているため取消できません';
    end if;

    if exists (
      select 1
      from public.inventory_reservations r
      where r.user_id = v_user_id
        and r.inventory_lot_id = v_lot.id
        and coalesce(r.reserved_quantity, 0) > 0
    ) then
      raise exception '既に引当または出荷されているため取消できません';
    end if;

    if exists (
      select 1
      from public.shipment_lines sl
      join public.shipments s
        on s.id = sl.shipment_id
       and s.user_id = v_user_id
       and coalesce(s.is_deleted, false) = false
       and s.status <> 'Cancelled'
      where sl.user_id = v_user_id
        and sl.inventory_lot_id = v_lot.id
    ) then
      raise exception '既に引当または出荷されているため取消できません';
    end if;

    select *
      into v_original_movement
    from public.inventory_movements
    where user_id = v_user_id
      and inventory_lot_id = v_lot.id
      and inbound_receipt_id = p_inbound_receipt_id
      and inbound_shipment_line_id = v_receipt_line.inbound_shipment_line_id
      and movement_type = 'receipt'
    order by created_at asc
    limit 1;

    if not found then
      raise exception 'original receipt movement not found for inbound receipt line %', v_receipt_line.id;
    end if;

    if exists (
      select 1
      from public.inventory_movements m
      where m.user_id = v_user_id
        and m.inventory_lot_id = v_lot.id
        and m.id <> v_original_movement.id
        and m.created_at > v_original_movement.created_at
    ) then
      raise exception '後続の在庫変更があるため取消できません';
    end if;

    v_cancel_quantity := case
      when coalesce(v_receipt_line.received_weight, 0) > 0 then v_receipt_line.received_weight
      else v_receipt_line.received_pieces
    end;

    if coalesce(v_cancel_quantity, 0) <= 0 then
      raise exception 'receipt quantity is invalid for inbound receipt line %', v_receipt_line.id;
    end if;
    if coalesce(v_lot.quantity, 0) + 0.000001 < v_cancel_quantity then
      raise exception 'inventory lot quantity would become negative';
    end if;

    v_new_lot_quantity := case
      when abs(coalesce(v_lot.quantity, 0) - v_cancel_quantity) <= 0.000001 then 0
      else coalesce(v_lot.quantity, 0) - v_cancel_quantity
    end;

    insert into public.inventory_movements (
      id, user_id, product_id, inventory_lot_id, movement_type, quantity, unit, movement_date,
      reason, location_from, voucher_number, handler_name, notes, original_payload, created_by, created_at,
      inbound_shipment_id, inbound_receipt_id, inbound_shipment_line_id
    ) values (
      gen_random_uuid()::text,
      v_user_id,
      v_lot.product_id,
      v_lot.id,
      'receipt_cancel',
      -v_cancel_quantity,
      v_lot.unit,
      current_date,
      'PDF入荷確定取消',
      v_lot.location,
      v_lot.voucher_number,
      null,
      p_reason,
      jsonb_build_object(
        'source', 'delivery_notice_pdf',
        'action', 'reverse_inbound_receipt',
        'originalReceiptId', p_inbound_receipt_id,
        'originalReceiptLineId', v_receipt_line.id,
        'originalMovementId', v_original_movement.id,
        'inboundShipmentId', v_receipt.inbound_shipment_id,
        'inboundShipmentLineId', v_receipt_line.inbound_shipment_line_id,
        'reason', p_reason
      ),
      v_user_id,
      now(),
      v_receipt.inbound_shipment_id,
      p_inbound_receipt_id,
      v_receipt_line.inbound_shipment_line_id
    );

    update public.inventory_lots
    set
      quantity = v_new_lot_quantity,
      status = case when v_new_lot_quantity <= 0 then 'deleted' else status end,
      deleted_at = case when v_new_lot_quantity <= 0 then coalesce(deleted_at, now()) else deleted_at end,
      deleted_by = case when v_new_lot_quantity <= 0 then coalesce(deleted_by, v_user_id) else deleted_by end,
      delete_reason = case when v_new_lot_quantity <= 0 then coalesce(delete_reason, p_reason) else delete_reason end,
      updated_at = now()
    where id = v_lot.id
      and user_id = v_user_id;

    select *
      into v_inbound_line
    from public.inbound_shipment_lines
    where id = v_receipt_line.inbound_shipment_line_id
      and user_id = v_user_id
    for update;

    if not found then
      raise exception 'inbound shipment line not found for receipt line %', v_receipt_line.id;
    end if;
    if v_inbound_line.status in ('cancelled', 'deleted', 'skipped', 'excluded') then
      raise exception 'inbound shipment line cannot be reopened in current status: %', v_inbound_line.status;
    end if;

    v_new_received_weight := greatest(coalesce(v_inbound_line.received_weight_total, 0) - coalesce(v_receipt_line.received_weight, 0), 0);
    v_new_received_pieces := greatest(coalesce(v_inbound_line.received_pieces_total, 0) - coalesce(v_receipt_line.received_pieces, 0), 0);
    v_new_remaining_weight := greatest(coalesce(v_inbound_line.planned_weight, v_inbound_line.weight, 0) - v_new_received_weight, 0);
    v_new_remaining_pieces := greatest(coalesce(v_inbound_line.planned_pieces, v_inbound_line.quantity_pieces, 0) - v_new_received_pieces, 0);

    if v_new_remaining_weight <= 0.000001 then
      v_new_remaining_weight := 0;
    end if;
    if v_new_remaining_pieces <= 0.000001 then
      v_new_remaining_pieces := 0;
    end if;

    v_new_line_status := case
      when v_new_received_weight <= 0.000001 and v_new_received_pieces <= 0.000001 then 'pending'
      when (coalesce(v_inbound_line.planned_weight, v_inbound_line.weight) is null or v_new_remaining_weight <= 0.000001)
       and (coalesce(v_inbound_line.planned_pieces, v_inbound_line.quantity_pieces) is null or v_new_remaining_pieces <= 0.000001) then 'received'
      else 'partially_received'
    end;

    update public.inbound_shipment_lines
    set
      received_weight_total = v_new_received_weight,
      received_pieces_total = v_new_received_pieces,
      remaining_weight = v_new_remaining_weight,
      remaining_pieces = v_new_remaining_pieces,
      status = v_new_line_status,
      updated_at = now()
    where id = v_inbound_line.id
      and user_id = v_user_id;

    update public.inbound_receipt_lines
    set
      voided_at = now(),
      voided_by = v_user_id,
      void_reason = p_reason
    where id = v_receipt_line.id
      and user_id = v_user_id;

    v_reversed_lines := v_reversed_lines + 1;
  end loop;

  if v_reversed_lines = 0 then
    raise exception 'inbound receipt lines are required';
  end if;

  update public.inbound_receipts
  set
    voided_at = now(),
    voided_by = v_user_id,
    void_reason = p_reason,
    updated_at = now()
  where id = p_inbound_receipt_id
    and user_id = v_user_id;

  select count(*)
    into v_open_line_count
  from public.inbound_shipment_lines
  where inbound_shipment_id = v_receipt.inbound_shipment_id
    and user_id = v_user_id
    and status not in ('received', 'excluded', 'skipped', 'cancelled', 'deleted');

  select count(*)
    into v_received_line_count
  from public.inbound_shipment_lines
  where inbound_shipment_id = v_receipt.inbound_shipment_id
    and user_id = v_user_id
    and status in ('received', 'partially_received');

  select count(*)
    into v_unmatched_line_count
  from public.inbound_shipment_lines
  where inbound_shipment_id = v_receipt.inbound_shipment_id
    and user_id = v_user_id
    and status not in ('excluded', 'skipped', 'cancelled', 'deleted')
    and match_status not in ('matched', 'manual');

  update public.inbound_shipments
  set
    status = case
      when v_open_line_count = 0 then 'received'
      when v_received_line_count > 0 then 'partially_received'
      when v_unmatched_line_count > 0 then 'matching'
      else 'confirmed'
    end,
    updated_at = now()
  where id = v_receipt.inbound_shipment_id
    and user_id = v_user_id;

  return jsonb_build_object(
    'receiptId', p_inbound_receipt_id,
    'reversedLines', v_reversed_lines,
    'reason', p_reason
  );
end;
$$;

revoke all on function public.reverse_inbound_receipt(text, text) from public, anon;
grant execute on function public.reverse_inbound_receipt(text, text) to authenticated;