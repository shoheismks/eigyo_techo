alter table public.customers
  add column if not exists customer_code text;

alter table public.suppliers
  add column if not exists supplier_code text;

alter table public.projects
  add column if not exists project_code text;

update public.customers
set customer_code = null
where customer_code is not null
  and btrim(customer_code) = '';

update public.suppliers
set supplier_code = null
where supplier_code is not null
  and btrim(supplier_code) = '';

update public.projects
set project_code = null
where project_code is not null
  and btrim(project_code) = '';

update public.quotes
set quote_number = null
where quote_number is not null
  and btrim(quote_number) = '';

alter table public.customers
  drop constraint if exists customers_customer_code_ascii_check;

alter table public.customers
  add constraint customers_customer_code_ascii_check
  check (
    customer_code is null
    or customer_code = ''
    or (
      customer_code = btrim(customer_code)
      and customer_code ~ '^[!-~]+$'
    )
  );

alter table public.suppliers
  drop constraint if exists suppliers_supplier_code_ascii_check;

alter table public.suppliers
  add constraint suppliers_supplier_code_ascii_check
  check (
    supplier_code is null
    or supplier_code = ''
    or (
      supplier_code = btrim(supplier_code)
      and supplier_code ~ '^[!-~]+$'
    )
  );

alter table public.projects
  drop constraint if exists projects_project_code_ascii_check;

alter table public.projects
  add constraint projects_project_code_ascii_check
  check (
    project_code is null
    or project_code = ''
    or (
      project_code = btrim(project_code)
      and project_code ~ '^[!-~]+$'
    )
  );

alter table public.quotes
  drop constraint if exists quotes_quote_number_ascii_check;

alter table public.quotes
  add constraint quotes_quote_number_ascii_check
  check (
    quote_number is null
    or quote_number = ''
    or (
      quote_number = btrim(quote_number)
      and quote_number ~ '^[!-~]+$'
    )
  );

create unique index if not exists customers_user_customer_code_unique_idx
  on public.customers (user_id, lower(customer_code))
  where customer_code is not null
    and customer_code <> '';

create unique index if not exists suppliers_user_supplier_code_unique_idx
  on public.suppliers (user_id, lower(supplier_code))
  where supplier_code is not null
    and supplier_code <> '';

create unique index if not exists projects_user_project_code_unique_idx
  on public.projects (user_id, lower(project_code))
  where project_code is not null
    and project_code <> '';

create unique index if not exists quotes_user_quote_number_unique_idx
  on public.quotes (user_id, lower(quote_number))
  where quote_number is not null
    and quote_number <> '';
