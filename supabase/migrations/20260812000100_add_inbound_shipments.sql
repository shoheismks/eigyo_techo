create table if not exists public.inbound_shipments (
  id text primary key,
  user_id uuid not null,
  source_file_name text not null default '',
  file_hash text not null default '',
  document_number text not null default '',
  supplier_name text not null default '',
  issued_date timestamptz,
  status text not null default 'draft',
  parser_version text not null default '',
  raw_text text not null default '',
  parse_result jsonb not null default '{}'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inbound_shipments_status_check check (status in ('draft', 'matching', 'confirmed', 'cancelled', 'deleted'))
);

create table if not exists public.inbound_shipment_lines (
  id text primary key,
  user_id uuid not null,
  inbound_shipment_id text not null references public.inbound_shipments(id) on delete cascade,
  line_no integer not null default 0,
  contract_no text not null default '',
  brand_name_raw text not null default '',
  product_name_raw text not null default '',
  matched_product_id text references public.products(id),
  match_status text not null default 'unmatched',
  match_score numeric,
  quantity_pieces numeric,
  weight numeric,
  unit text not null default '',
  unit_price numeric,
  currency text not null default 'JPY',
  origin_country text not null default '',
  factory_no text not null default '',
  customs_clearance_planned_date date,
  packing_from date,
  packing_to date,
  expiry_date date,
  warehouse_name text not null default '',
  duplicate_key text not null default '',
  status text not null default 'draft',
  raw_row jsonb not null default '{}'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inbound_shipment_lines_match_status_check check (match_status in ('matched', 'unmatched', 'ambiguous', 'manual')),
  constraint inbound_shipment_lines_status_check check (status in ('draft', 'excluded', 'confirmed', 'cancelled', 'deleted'))
);

create table if not exists public.supplier_product_aliases (
  id text primary key,
  user_id uuid not null,
  supplier_name text not null default '',
  product_id text not null references public.products(id) on delete cascade,
  alias_name text not null default '',
  normalized_alias_name text not null default '',
  brand_name text not null default '',
  factory_no text not null default '',
  origin_country text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists inbound_shipments_user_file_hash_unique_idx
  on public.inbound_shipments (user_id, file_hash)
  where file_hash <> '' and status <> 'deleted';

create unique index if not exists inbound_shipment_lines_duplicate_unique_idx
  on public.inbound_shipment_lines (user_id, duplicate_key)
  where duplicate_key <> '' and status <> 'deleted';

create unique index if not exists supplier_product_aliases_unique_idx
  on public.supplier_product_aliases (
    user_id,
    lower(supplier_name),
    normalized_alias_name,
    coalesce(product_id, ''),
    lower(coalesce(brand_name, '')),
    lower(coalesce(factory_no, '')),
    lower(coalesce(origin_country, ''))
  )
  where is_active = true;

create index if not exists idx_inbound_shipments_user_updated
  on public.inbound_shipments (user_id, updated_at desc);

create index if not exists idx_inbound_shipment_lines_user_shipment
  on public.inbound_shipment_lines (user_id, inbound_shipment_id, line_no);

create index if not exists idx_inbound_shipment_lines_user_match
  on public.inbound_shipment_lines (user_id, match_status);

create index if not exists idx_supplier_product_aliases_lookup
  on public.supplier_product_aliases (user_id, lower(supplier_name), normalized_alias_name)
  where is_active = true;

alter table public.inbound_shipments enable row level security;
alter table public.inbound_shipment_lines enable row level security;
alter table public.supplier_product_aliases enable row level security;

grant select, insert, update, delete on public.inbound_shipments to authenticated;
grant select, insert, update, delete on public.inbound_shipment_lines to authenticated;
grant select, insert, update, delete on public.supplier_product_aliases to authenticated;

drop policy if exists "inbound_shipments_select_own" on public.inbound_shipments;
create policy "inbound_shipments_select_own"
  on public.inbound_shipments for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "inbound_shipments_insert_own" on public.inbound_shipments;
create policy "inbound_shipments_insert_own"
  on public.inbound_shipments for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "inbound_shipments_update_own" on public.inbound_shipments;
create policy "inbound_shipments_update_own"
  on public.inbound_shipments for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "inbound_shipments_delete_own" on public.inbound_shipments;
create policy "inbound_shipments_delete_own"
  on public.inbound_shipments for delete to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "inbound_shipment_lines_select_own" on public.inbound_shipment_lines;
create policy "inbound_shipment_lines_select_own"
  on public.inbound_shipment_lines for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "inbound_shipment_lines_insert_own" on public.inbound_shipment_lines;
create policy "inbound_shipment_lines_insert_own"
  on public.inbound_shipment_lines for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.inbound_shipments s
      where s.id = inbound_shipment_id
        and s.user_id = (select auth.uid())
    )
    and (
      matched_product_id is null
      or exists (
        select 1 from public.products p
        where p.id = matched_product_id
          and p.user_id = (select auth.uid())
      )
    )
  );

drop policy if exists "inbound_shipment_lines_update_own" on public.inbound_shipment_lines;
create policy "inbound_shipment_lines_update_own"
  on public.inbound_shipment_lines for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.inbound_shipments s
      where s.id = inbound_shipment_id
        and s.user_id = (select auth.uid())
    )
    and (
      matched_product_id is null
      or exists (
        select 1 from public.products p
        where p.id = matched_product_id
          and p.user_id = (select auth.uid())
      )
    )
  );

drop policy if exists "inbound_shipment_lines_delete_own" on public.inbound_shipment_lines;
create policy "inbound_shipment_lines_delete_own"
  on public.inbound_shipment_lines for delete to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "supplier_product_aliases_select_own" on public.supplier_product_aliases;
create policy "supplier_product_aliases_select_own"
  on public.supplier_product_aliases for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "supplier_product_aliases_insert_own" on public.supplier_product_aliases;
create policy "supplier_product_aliases_insert_own"
  on public.supplier_product_aliases for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.products p
      where p.id = product_id
        and p.user_id = (select auth.uid())
    )
  );

drop policy if exists "supplier_product_aliases_update_own" on public.supplier_product_aliases;
create policy "supplier_product_aliases_update_own"
  on public.supplier_product_aliases for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.products p
      where p.id = product_id
        and p.user_id = (select auth.uid())
    )
  );

drop policy if exists "supplier_product_aliases_delete_own" on public.supplier_product_aliases;
create policy "supplier_product_aliases_delete_own"
  on public.supplier_product_aliases for delete to authenticated
  using ((select auth.uid()) = user_id);
