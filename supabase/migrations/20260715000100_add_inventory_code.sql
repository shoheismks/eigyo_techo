alter table public.inventories
  add column if not exists inventory_code text;

update public.inventories
set inventory_code = null
where inventory_code is not null
  and btrim(inventory_code) = '';

alter table public.inventories
  drop constraint if exists inventories_inventory_code_ascii_check;

alter table public.inventories
  add constraint inventories_inventory_code_ascii_check
  check (
    inventory_code is null
    or inventory_code = ''
    or (
      inventory_code = btrim(inventory_code)
      and inventory_code ~ '^[!-~]+$'
    )
  );

create unique index if not exists inventories_user_inventory_code_unique_idx
  on public.inventories (user_id, lower(inventory_code))
  where inventory_code is not null
    and inventory_code <> '';
