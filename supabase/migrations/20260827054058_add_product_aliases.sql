create or replace function public.normalize_product_alias_text(p_value text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select btrim(
    regexp_replace(
      translate(
        lower(normalize(coalesce(p_value, ''), nfkc)),
        '‐‑‒–—―−',
        '-------'
      ),
      '[[:space:]　/_,，、。・･;；:：()\[\]{}]+',
      ' ',
      'g'
    )
  );
$$;

create or replace function public.normalize_product_alias_code(p_value text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select btrim(
    regexp_replace(
      translate(
        lower(normalize(coalesce(p_value, ''), nfkc)),
        '‐‑‒–—―−',
        '-------'
      ),
      '[[:space:]　]+',
      ' ',
      'g'
    )
  );
$$;

create table if not exists public.product_aliases (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id text not null references public.products(id) on delete cascade,
  alias_name text not null,
  normalized_alias text not null,
  supplier_id text references public.suppliers(id) on delete set null,
  supplier_name_snapshot text not null default '',
  supplier_product_code text not null default '',
  normalized_supplier_product_code text not null default '',
  source_type text not null default '',
  source_document_type text not null default '',
  source_note text not null default '',
  normalization_version integer not null default 1,
  is_active boolean not null default true,
  confirmed_by uuid references auth.users(id) on delete set null,
  confirmed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_aliases_alias_name_not_blank check (btrim(alias_name) <> ''),
  constraint product_aliases_normalized_alias_matches check (
    normalized_alias = public.normalize_product_alias_text(alias_name)
    and normalized_alias <> ''
  ),
  constraint product_aliases_supplier_code_matches check (
    normalized_supplier_product_code = public.normalize_product_alias_code(supplier_product_code)
  ),
  constraint product_aliases_normalization_version_positive check (normalization_version > 0)
);

create index if not exists product_aliases_user_product_idx
  on public.product_aliases (user_id, product_id);

create index if not exists product_aliases_user_supplier_idx
  on public.product_aliases (user_id, supplier_id)
  where supplier_id is not null;

create unique index if not exists product_aliases_active_alias_unique_idx
  on public.product_aliases (
    user_id,
    (case
      when supplier_id is not null then 'id:' || supplier_id
      when btrim(supplier_name_snapshot) <> '' then 'name:' || lower(btrim(supplier_name_snapshot))
      else 'global'
    end),
    normalized_alias
  )
  where is_active;

create unique index if not exists product_aliases_active_supplier_code_unique_idx
  on public.product_aliases (
    user_id,
    (case
      when supplier_id is not null then 'id:' || supplier_id
      when btrim(supplier_name_snapshot) <> '' then 'name:' || lower(btrim(supplier_name_snapshot))
      else 'global'
    end),
    normalized_supplier_product_code
  )
  where is_active and normalized_supplier_product_code <> '';

alter table public.product_aliases enable row level security;

drop policy if exists "Users can read own product aliases" on public.product_aliases;
create policy "Users can read own product aliases"
on public.product_aliases for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own product aliases" on public.product_aliases;
create policy "Users can insert own product aliases"
on public.product_aliases for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and (confirmed_by is null or confirmed_by = (select auth.uid()))
  and exists (
    select 1 from public.products p
    where p.id = product_id and p.user_id = (select auth.uid())
  )
  and (
    supplier_id is null
    or exists (
      select 1 from public.suppliers s
      where s.id = supplier_id and s.user_id = (select auth.uid())
    )
  )
);

drop policy if exists "Users can update own product aliases" on public.product_aliases;
create policy "Users can update own product aliases"
on public.product_aliases for update
to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and (confirmed_by is null or confirmed_by = (select auth.uid()))
  and exists (
    select 1 from public.products p
    where p.id = product_id and p.user_id = (select auth.uid())
  )
  and (
    supplier_id is null
    or exists (
      select 1 from public.suppliers s
      where s.id = supplier_id and s.user_id = (select auth.uid())
    )
  )
);

revoke all on table public.product_aliases from anon;
revoke delete on table public.product_aliases from authenticated;
grant select, insert, update on table public.product_aliases to authenticated;

with resolved_source as (
  select
    spa.*,
    public.normalize_product_alias_text(spa.alias_name) as migrated_normalized_alias,
    resolved_supplier.id as resolved_supplier_id,
    case
      when resolved_supplier.id is not null then 'id:' || resolved_supplier.id
      when btrim(coalesce(spa.supplier_name, '')) <> '' then 'name:' || lower(btrim(spa.supplier_name))
      else 'global'
    end as supplier_context
  from public.supplier_product_aliases spa
  join public.products p
    on p.id = spa.product_id and p.user_id = spa.user_id
  left join lateral (
    select min(s.id) as id
    from public.suppliers s
    where s.user_id = spa.user_id
      and public.normalize_product_alias_text(coalesce(s.name, '')) =
          public.normalize_product_alias_text(spa.supplier_name)
    having count(*) = 1
  ) resolved_supplier on true
  where btrim(coalesce(spa.alias_name, '')) <> ''
), conflict_counts as (
  select
    user_id,
    supplier_context,
    migrated_normalized_alias,
    count(distinct product_id) as product_count
  from resolved_source
  group by user_id, supplier_context, migrated_normalized_alias
), classified as (
  select
    rs.*,
    cc.product_count,
    row_number() over (
      partition by rs.user_id, rs.supplier_context, rs.migrated_normalized_alias
      order by coalesce(rs.is_active, true) desc, rs.created_at nulls last, rs.id
    ) as alias_rank
  from resolved_source rs
  join conflict_counts cc
    using (user_id, supplier_context, migrated_normalized_alias)
)
insert into public.product_aliases (
  id, user_id, product_id, alias_name, normalized_alias,
  supplier_id, supplier_name_snapshot, supplier_product_code,
  normalized_supplier_product_code, source_type, source_document_type,
  source_note, normalization_version, is_active, confirmed_by,
  confirmed_at, created_at, updated_at
)
select
  'legacy-supplier-alias-' || id,
  user_id,
  product_id,
  alias_name,
  migrated_normalized_alias,
  resolved_supplier_id,
  coalesce(supplier_name, ''),
  '',
  '',
  'legacy_supplier_product_alias',
  '',
  case
    when product_count > 1 then 'migration_conflict: alias was linked to multiple products; kept inactive'
    when alias_rank > 1 then 'migration_duplicate: equivalent alias preserved inactive'
    else 'migrated from supplier_product_aliases'
  end,
  1,
  coalesce(is_active, true) and product_count = 1 and alias_rank = 1,
  user_id,
  coalesce(created_at, now()),
  coalesce(created_at, now()),
  coalesce(updated_at, created_at, now())
from classified
on conflict (id) do nothing;
