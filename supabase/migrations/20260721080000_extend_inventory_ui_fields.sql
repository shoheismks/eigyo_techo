alter table public.inventories
  add column if not exists reserved_quantity numeric,
  add column if not exists location text,
  add column if not exists safety_stock numeric,
  add column if not exists manufacture_date date,
  add column if not exists received_date date,
  add column if not exists voucher_number text,
  add column if not exists handler_name text,
  add column if not exists movement_history jsonb default '[]'::jsonb;

create index if not exists idx_inventories_user_location
  on public.inventories (user_id, location);

create index if not exists idx_inventories_user_lot
  on public.inventories (user_id, lot);

create index if not exists idx_inventories_user_received_date
  on public.inventories (user_id, received_date);

grant select, insert, update, delete on public.inventories to authenticated;

notify pgrst, 'reload schema';
