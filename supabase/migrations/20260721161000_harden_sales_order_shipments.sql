alter function public.generate_shipment_number() set search_path = public, pg_temp;
alter function public.refresh_sales_order_shipment_status(text) set search_path = public, pg_temp;
alter function public.create_sales_order_shipment(text, jsonb, text, date, date, text, text, text) set search_path = public, pg_temp;
alter function public.update_sales_order_shipment_status(text, text, date, text) set search_path = public, pg_temp;

create index if not exists idx_shipments_sales_order_id
  on public.shipments (sales_order_id);

create index if not exists idx_shipment_lines_shipment_id
  on public.shipment_lines (shipment_id);

create index if not exists idx_shipment_lines_inventory_reservation_id
  on public.shipment_lines (inventory_reservation_id);

create index if not exists idx_shipment_lines_inventory_lot_id
  on public.shipment_lines (inventory_lot_id);

notify pgrst, 'reload schema';
