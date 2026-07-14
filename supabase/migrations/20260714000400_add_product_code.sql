alter table public.products
  add column if not exists product_code text;

update public.products
set product_code = null
where product_code is not null
  and btrim(product_code) = '';

alter table public.products
  drop constraint if exists products_product_code_ascii_check;

alter table public.products
  add constraint products_product_code_ascii_check
  check (
    product_code is null
    or product_code = ''
    or (
      product_code = btrim(product_code)
      and product_code ~ '^[!-~]+$'
    )
  );

create unique index if not exists products_user_product_code_unique_idx
  on public.products (user_id, lower(product_code))
  where product_code is not null
    and product_code <> '';
