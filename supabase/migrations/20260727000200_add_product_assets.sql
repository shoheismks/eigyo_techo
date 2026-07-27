create table if not exists public.product_assets (
  id text primary key,
  user_id uuid not null,
  product_id text not null references public.products(id) on delete cascade,
  asset_kind text not null default 'image',
  asset_type text not null default 'product',
  file_name text not null default '',
  description text not null default '',
  sort_order integer not null default 0,
  is_main boolean not null default false,
  storage_bucket text not null default 'app-attachments',
  storage_path text not null default '',
  public_url text not null default '',
  content_type text not null default '',
  size_bytes bigint not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_assets_kind_check check (asset_kind in ('image', 'document'))
);

create index if not exists idx_product_assets_user_product
  on public.product_assets (user_id, product_id, asset_kind, sort_order);

alter table public.product_assets enable row level security;

grant select, insert, update, delete on public.product_assets to authenticated;

drop policy if exists "product assets select own" on public.product_assets;
create policy "product assets select own"
  on public.product_assets for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "product assets insert own" on public.product_assets;
create policy "product assets insert own"
  on public.product_assets for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.products p
      where p.id = product_id
        and p.user_id = (select auth.uid())
    )
  );

drop policy if exists "product assets update own" on public.product_assets;
create policy "product assets update own"
  on public.product_assets for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.products p
      where p.id = product_id
        and p.user_id = (select auth.uid())
    )
  );

drop policy if exists "product assets delete own" on public.product_assets;
create policy "product assets delete own"
  on public.product_assets for delete
  to authenticated
  using ((select auth.uid()) = user_id);
