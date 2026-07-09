-- Eigyo Techo Supabase migration: Step18 Supabase optimization
-- Data preserving: no table drops, no row deletes, no destructive column changes.
-- This migration improves common user-scoped query indexes and refreshes RLS
-- policies with Supabase-friendly auth.uid() subselects.

create or replace function pg_temp.eigyo_enable_rls_if_exists(relation_name text)
returns void
language plpgsql
as $$
begin
  if to_regclass(relation_name) is null then
    raise notice 'skip RLS enable; relation % does not exist', relation_name;
    return;
  end if;

  execute format('alter table %s enable row level security', relation_name);
end;
$$;

create or replace function pg_temp.eigyo_create_index_if_relation_exists(
  relation_name text,
  create_index_sql text
) returns void
language plpgsql
as $$
begin
  if to_regclass(relation_name) is null then
    raise notice 'skip index; relation % does not exist', relation_name;
    return;
  end if;

  execute create_index_sql;
end;
$$;

create or replace function pg_temp.eigyo_drop_policy_if_exists(
  relation_name text,
  policy_name text
) returns void
language plpgsql
as $$
begin
  if to_regclass(relation_name) is null then
    raise notice 'skip drop policy %, relation % does not exist', policy_name, relation_name;
    return;
  end if;

  execute format('drop policy if exists %I on %s', policy_name, relation_name);
end;
$$;

create or replace function pg_temp.eigyo_reset_policy_if_relation_exists(
  relation_name text,
  policy_name text,
  create_policy_sql text
) returns void
language plpgsql
as $$
begin
  if to_regclass(relation_name) is null then
    raise notice 'skip policy %, relation % does not exist', policy_name, relation_name;
    return;
  end if;

  perform pg_temp.eigyo_drop_policy_if_exists(relation_name, policy_name);
  execute create_policy_sql;
end;
$$;

select pg_temp.eigyo_enable_rls_if_exists('public.customers');
select pg_temp.eigyo_enable_rls_if_exists('public.mail_drafts');
select pg_temp.eigyo_enable_rls_if_exists('public.products');
select pg_temp.eigyo_enable_rls_if_exists('public.contacts');
select pg_temp.eigyo_enable_rls_if_exists('public.suppliers');
select pg_temp.eigyo_enable_rls_if_exists('public.business_cards');
select pg_temp.eigyo_enable_rls_if_exists('public.complaints');
select pg_temp.eigyo_enable_rls_if_exists('public.samples');
select pg_temp.eigyo_enable_rls_if_exists('public.quotes');
select pg_temp.eigyo_enable_rls_if_exists('public.adoptions');
select pg_temp.eigyo_enable_rls_if_exists('public.attachments');

-- Composite indexes for current Supabase client queries:
--   where user_id = auth user order by created_at / updated_at
-- and dashboard/calendar filters by status and due dates.
select pg_temp.eigyo_create_index_if_relation_exists('public.customers', 'create index if not exists idx_customers_user_created_at on public.customers (user_id, created_at desc)');
select pg_temp.eigyo_create_index_if_relation_exists('public.customers', 'create index if not exists idx_customers_user_updated_at on public.customers (user_id, updated_at desc)');
select pg_temp.eigyo_create_index_if_relation_exists('public.customers', 'create index if not exists idx_customers_user_status on public.customers (user_id, status)');
select pg_temp.eigyo_create_index_if_relation_exists('public.customers', 'create index if not exists idx_customers_user_rank on public.customers (user_id, rank)');
select pg_temp.eigyo_create_index_if_relation_exists('public.customers', 'create index if not exists idx_customers_user_next_follow_up_date on public.customers (user_id, next_follow_up_date)');
select pg_temp.eigyo_create_index_if_relation_exists('public.customers', 'create index if not exists idx_customers_user_next_follow_date on public.customers (user_id, next_follow_date)');

select pg_temp.eigyo_create_index_if_relation_exists('public.mail_drafts', 'create index if not exists idx_mail_drafts_user_updated_at on public.mail_drafts (user_id, updated_at desc)');
select pg_temp.eigyo_create_index_if_relation_exists('public.mail_drafts', 'create index if not exists idx_mail_drafts_user_customer_id on public.mail_drafts (user_id, customer_id)');

select pg_temp.eigyo_create_index_if_relation_exists('public.products', 'create index if not exists idx_products_user_updated_at on public.products (user_id, updated_at desc)');
select pg_temp.eigyo_create_index_if_relation_exists('public.products', 'create index if not exists idx_products_user_category on public.products (user_id, category)');
select pg_temp.eigyo_create_index_if_relation_exists('public.products', 'create index if not exists idx_products_user_temperature_zone on public.products (user_id, temperature_zone)');
select pg_temp.eigyo_create_index_if_relation_exists('public.products', 'create index if not exists idx_products_user_manufacturer_name on public.products (user_id, manufacturer_name)');

select pg_temp.eigyo_create_index_if_relation_exists('public.contacts', 'create index if not exists idx_contacts_user_updated_at on public.contacts (user_id, updated_at desc)');
select pg_temp.eigyo_create_index_if_relation_exists('public.contacts', 'create index if not exists idx_contacts_user_customer_id on public.contacts (user_id, customer_id)');

select pg_temp.eigyo_create_index_if_relation_exists('public.suppliers', 'create index if not exists idx_suppliers_user_updated_at on public.suppliers (user_id, updated_at desc)');

select pg_temp.eigyo_create_index_if_relation_exists('public.business_cards', 'create index if not exists idx_business_cards_user_updated_at on public.business_cards (user_id, updated_at desc)');
select pg_temp.eigyo_create_index_if_relation_exists('public.business_cards', 'create index if not exists idx_business_cards_user_customer_id on public.business_cards (user_id, customer_id)');
select pg_temp.eigyo_create_index_if_relation_exists('public.business_cards', 'create index if not exists idx_business_cards_user_contact_id on public.business_cards (user_id, contact_id)');

select pg_temp.eigyo_create_index_if_relation_exists('public.complaints', 'create index if not exists idx_complaints_user_updated_at on public.complaints (user_id, updated_at desc)');
select pg_temp.eigyo_create_index_if_relation_exists('public.complaints', 'create index if not exists idx_complaints_user_customer_id on public.complaints (user_id, customer_id)');
select pg_temp.eigyo_create_index_if_relation_exists('public.complaints', 'create index if not exists idx_complaints_user_status on public.complaints (user_id, status)');

select pg_temp.eigyo_create_index_if_relation_exists('public.samples', 'create index if not exists idx_samples_user_updated_at on public.samples (user_id, updated_at desc)');
select pg_temp.eigyo_create_index_if_relation_exists('public.samples', 'create index if not exists idx_samples_user_customer_id on public.samples (user_id, customer_id)');
select pg_temp.eigyo_create_index_if_relation_exists('public.samples', 'create index if not exists idx_samples_user_status on public.samples (user_id, status)');
select pg_temp.eigyo_create_index_if_relation_exists('public.samples', 'create index if not exists idx_samples_user_follow_up_date on public.samples (user_id, follow_up_date)');

select pg_temp.eigyo_create_index_if_relation_exists('public.quotes', 'create index if not exists idx_quotes_user_updated_at on public.quotes (user_id, updated_at desc)');
select pg_temp.eigyo_create_index_if_relation_exists('public.quotes', 'create index if not exists idx_quotes_user_customer_id on public.quotes (user_id, customer_id)');
select pg_temp.eigyo_create_index_if_relation_exists('public.quotes', 'create index if not exists idx_quotes_user_supplier_id on public.quotes (user_id, supplier_id)');
select pg_temp.eigyo_create_index_if_relation_exists('public.quotes', 'create index if not exists idx_quotes_user_status on public.quotes (user_id, status)');
select pg_temp.eigyo_create_index_if_relation_exists('public.quotes', 'create index if not exists idx_quotes_user_valid_until on public.quotes (user_id, valid_until)');

select pg_temp.eigyo_create_index_if_relation_exists('public.adoptions', 'create index if not exists idx_adoptions_user_updated_at on public.adoptions (user_id, updated_at desc)');
select pg_temp.eigyo_create_index_if_relation_exists('public.adoptions', 'create index if not exists idx_adoptions_user_customer_id on public.adoptions (user_id, customer_id)');
select pg_temp.eigyo_create_index_if_relation_exists('public.adoptions', 'create index if not exists idx_adoptions_user_product_id on public.adoptions (user_id, product_id)');

select pg_temp.eigyo_create_index_if_relation_exists('public.attachments', 'create index if not exists idx_attachments_user_updated_at on public.attachments (user_id, updated_at desc)');
select pg_temp.eigyo_create_index_if_relation_exists('public.attachments', 'create index if not exists idx_attachments_user_owner on public.attachments (user_id, owner_type, owner_id)');
select pg_temp.eigyo_create_index_if_relation_exists('public.attachments', 'create index if not exists idx_attachments_user_storage_path on public.attachments (user_id, storage_path)');

-- Remove legacy anon policies if they were created manually in early prototypes.
select pg_temp.eigyo_drop_policy_if_exists('public.customers', 'Allow anon read customers');
select pg_temp.eigyo_drop_policy_if_exists('public.customers', 'Allow anon insert customers');
select pg_temp.eigyo_drop_policy_if_exists('public.customers', 'Allow anon update customers');
select pg_temp.eigyo_drop_policy_if_exists('public.customers', 'Allow anon delete customers');
select pg_temp.eigyo_drop_policy_if_exists('public.mail_drafts', 'Allow anon read mail_drafts');
select pg_temp.eigyo_drop_policy_if_exists('public.mail_drafts', 'Allow anon insert mail_drafts');
select pg_temp.eigyo_drop_policy_if_exists('public.mail_drafts', 'Allow anon update mail_drafts');
select pg_temp.eigyo_drop_policy_if_exists('public.mail_drafts', 'Allow anon delete mail_drafts');
select pg_temp.eigyo_drop_policy_if_exists('public.products', 'Allow anon read products');
select pg_temp.eigyo_drop_policy_if_exists('public.products', 'Allow anon insert products');
select pg_temp.eigyo_drop_policy_if_exists('public.products', 'Allow anon update products');
select pg_temp.eigyo_drop_policy_if_exists('public.products', 'Allow anon delete products');
select pg_temp.eigyo_drop_policy_if_exists('public.contacts', 'Allow anon read contacts');
select pg_temp.eigyo_drop_policy_if_exists('public.contacts', 'Allow anon insert contacts');
select pg_temp.eigyo_drop_policy_if_exists('public.contacts', 'Allow anon update contacts');
select pg_temp.eigyo_drop_policy_if_exists('public.contacts', 'Allow anon delete contacts');
select pg_temp.eigyo_drop_policy_if_exists('public.suppliers', 'Allow anon read suppliers');
select pg_temp.eigyo_drop_policy_if_exists('public.suppliers', 'Allow anon insert suppliers');
select pg_temp.eigyo_drop_policy_if_exists('public.suppliers', 'Allow anon update suppliers');
select pg_temp.eigyo_drop_policy_if_exists('public.suppliers', 'Allow anon delete suppliers');
select pg_temp.eigyo_drop_policy_if_exists('public.business_cards', 'Allow anon read business_cards');
select pg_temp.eigyo_drop_policy_if_exists('public.business_cards', 'Allow anon insert business_cards');
select pg_temp.eigyo_drop_policy_if_exists('public.business_cards', 'Allow anon update business_cards');
select pg_temp.eigyo_drop_policy_if_exists('public.business_cards', 'Allow anon delete business_cards');
select pg_temp.eigyo_drop_policy_if_exists('public.complaints', 'Allow anon read complaints');
select pg_temp.eigyo_drop_policy_if_exists('public.complaints', 'Allow anon insert complaints');
select pg_temp.eigyo_drop_policy_if_exists('public.complaints', 'Allow anon update complaints');
select pg_temp.eigyo_drop_policy_if_exists('public.complaints', 'Allow anon delete complaints');
select pg_temp.eigyo_drop_policy_if_exists('public.samples', 'Allow anon read samples');
select pg_temp.eigyo_drop_policy_if_exists('public.samples', 'Allow anon insert samples');
select pg_temp.eigyo_drop_policy_if_exists('public.samples', 'Allow anon update samples');
select pg_temp.eigyo_drop_policy_if_exists('public.samples', 'Allow anon delete samples');
select pg_temp.eigyo_drop_policy_if_exists('public.quotes', 'Allow anon read quotes');
select pg_temp.eigyo_drop_policy_if_exists('public.quotes', 'Allow anon insert quotes');
select pg_temp.eigyo_drop_policy_if_exists('public.quotes', 'Allow anon update quotes');
select pg_temp.eigyo_drop_policy_if_exists('public.quotes', 'Allow anon delete quotes');
select pg_temp.eigyo_drop_policy_if_exists('public.adoptions', 'Allow anon read adoptions');
select pg_temp.eigyo_drop_policy_if_exists('public.adoptions', 'Allow anon insert adoptions');
select pg_temp.eigyo_drop_policy_if_exists('public.adoptions', 'Allow anon update adoptions');
select pg_temp.eigyo_drop_policy_if_exists('public.adoptions', 'Allow anon delete adoptions');
select pg_temp.eigyo_drop_policy_if_exists('public.attachments', 'Allow anon read attachments');
select pg_temp.eigyo_drop_policy_if_exists('public.attachments', 'Allow anon insert attachments');
select pg_temp.eigyo_drop_policy_if_exists('public.attachments', 'Allow anon update attachments');
select pg_temp.eigyo_drop_policy_if_exists('public.attachments', 'Allow anon delete attachments');

-- Refresh authenticated policies. The `(select auth.uid())` pattern avoids
-- repeated function calls in RLS expressions and keeps SELECT available for UPDATE.
select pg_temp.eigyo_reset_policy_if_relation_exists('public.customers', 'Allow authenticated read own customers', 'create policy "Allow authenticated read own customers" on public.customers for select to authenticated using ((select auth.uid()) = user_id)');
select pg_temp.eigyo_reset_policy_if_relation_exists('public.customers', 'Allow authenticated insert own customers', 'create policy "Allow authenticated insert own customers" on public.customers for insert to authenticated with check ((select auth.uid()) = user_id)');
select pg_temp.eigyo_reset_policy_if_relation_exists('public.customers', 'Allow authenticated update own customers', 'create policy "Allow authenticated update own customers" on public.customers for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)');
select pg_temp.eigyo_reset_policy_if_relation_exists('public.customers', 'Allow authenticated delete own customers', 'create policy "Allow authenticated delete own customers" on public.customers for delete to authenticated using ((select auth.uid()) = user_id)');

select pg_temp.eigyo_reset_policy_if_relation_exists('public.mail_drafts', 'Allow authenticated read own mail_drafts', 'create policy "Allow authenticated read own mail_drafts" on public.mail_drafts for select to authenticated using ((select auth.uid()) = user_id)');
select pg_temp.eigyo_reset_policy_if_relation_exists('public.mail_drafts', 'Allow authenticated insert own mail_drafts', 'create policy "Allow authenticated insert own mail_drafts" on public.mail_drafts for insert to authenticated with check ((select auth.uid()) = user_id)');
select pg_temp.eigyo_reset_policy_if_relation_exists('public.mail_drafts', 'Allow authenticated update own mail_drafts', 'create policy "Allow authenticated update own mail_drafts" on public.mail_drafts for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)');
select pg_temp.eigyo_reset_policy_if_relation_exists('public.mail_drafts', 'Allow authenticated delete own mail_drafts', 'create policy "Allow authenticated delete own mail_drafts" on public.mail_drafts for delete to authenticated using ((select auth.uid()) = user_id)');

select pg_temp.eigyo_reset_policy_if_relation_exists('public.products', 'Allow authenticated read own products', 'create policy "Allow authenticated read own products" on public.products for select to authenticated using ((select auth.uid()) = user_id)');
select pg_temp.eigyo_reset_policy_if_relation_exists('public.products', 'Allow authenticated insert own products', 'create policy "Allow authenticated insert own products" on public.products for insert to authenticated with check ((select auth.uid()) = user_id)');
select pg_temp.eigyo_reset_policy_if_relation_exists('public.products', 'Allow authenticated update own products', 'create policy "Allow authenticated update own products" on public.products for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)');
select pg_temp.eigyo_reset_policy_if_relation_exists('public.products', 'Allow authenticated delete own products', 'create policy "Allow authenticated delete own products" on public.products for delete to authenticated using ((select auth.uid()) = user_id)');

select pg_temp.eigyo_reset_policy_if_relation_exists('public.contacts', 'Allow authenticated read own contacts', 'create policy "Allow authenticated read own contacts" on public.contacts for select to authenticated using ((select auth.uid()) = user_id)');
select pg_temp.eigyo_reset_policy_if_relation_exists('public.contacts', 'Allow authenticated insert own contacts', 'create policy "Allow authenticated insert own contacts" on public.contacts for insert to authenticated with check ((select auth.uid()) = user_id)');
select pg_temp.eigyo_reset_policy_if_relation_exists('public.contacts', 'Allow authenticated update own contacts', 'create policy "Allow authenticated update own contacts" on public.contacts for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)');
select pg_temp.eigyo_reset_policy_if_relation_exists('public.contacts', 'Allow authenticated delete own contacts', 'create policy "Allow authenticated delete own contacts" on public.contacts for delete to authenticated using ((select auth.uid()) = user_id)');

select pg_temp.eigyo_reset_policy_if_relation_exists('public.suppliers', 'Allow authenticated read own suppliers', 'create policy "Allow authenticated read own suppliers" on public.suppliers for select to authenticated using ((select auth.uid()) = user_id)');
select pg_temp.eigyo_reset_policy_if_relation_exists('public.suppliers', 'Allow authenticated insert own suppliers', 'create policy "Allow authenticated insert own suppliers" on public.suppliers for insert to authenticated with check ((select auth.uid()) = user_id)');
select pg_temp.eigyo_reset_policy_if_relation_exists('public.suppliers', 'Allow authenticated update own suppliers', 'create policy "Allow authenticated update own suppliers" on public.suppliers for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)');
select pg_temp.eigyo_reset_policy_if_relation_exists('public.suppliers', 'Allow authenticated delete own suppliers', 'create policy "Allow authenticated delete own suppliers" on public.suppliers for delete to authenticated using ((select auth.uid()) = user_id)');

select pg_temp.eigyo_reset_policy_if_relation_exists('public.business_cards', 'Allow authenticated read own business_cards', 'create policy "Allow authenticated read own business_cards" on public.business_cards for select to authenticated using ((select auth.uid()) = user_id)');
select pg_temp.eigyo_reset_policy_if_relation_exists('public.business_cards', 'Allow authenticated insert own business_cards', 'create policy "Allow authenticated insert own business_cards" on public.business_cards for insert to authenticated with check ((select auth.uid()) = user_id)');
select pg_temp.eigyo_reset_policy_if_relation_exists('public.business_cards', 'Allow authenticated update own business_cards', 'create policy "Allow authenticated update own business_cards" on public.business_cards for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)');
select pg_temp.eigyo_reset_policy_if_relation_exists('public.business_cards', 'Allow authenticated delete own business_cards', 'create policy "Allow authenticated delete own business_cards" on public.business_cards for delete to authenticated using ((select auth.uid()) = user_id)');

select pg_temp.eigyo_reset_policy_if_relation_exists('public.complaints', 'Allow authenticated read own complaints', 'create policy "Allow authenticated read own complaints" on public.complaints for select to authenticated using ((select auth.uid()) = user_id)');
select pg_temp.eigyo_reset_policy_if_relation_exists('public.complaints', 'Allow authenticated insert own complaints', 'create policy "Allow authenticated insert own complaints" on public.complaints for insert to authenticated with check ((select auth.uid()) = user_id)');
select pg_temp.eigyo_reset_policy_if_relation_exists('public.complaints', 'Allow authenticated update own complaints', 'create policy "Allow authenticated update own complaints" on public.complaints for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)');
select pg_temp.eigyo_reset_policy_if_relation_exists('public.complaints', 'Allow authenticated delete own complaints', 'create policy "Allow authenticated delete own complaints" on public.complaints for delete to authenticated using ((select auth.uid()) = user_id)');

select pg_temp.eigyo_reset_policy_if_relation_exists('public.samples', 'Allow authenticated read own samples', 'create policy "Allow authenticated read own samples" on public.samples for select to authenticated using ((select auth.uid()) = user_id)');
select pg_temp.eigyo_reset_policy_if_relation_exists('public.samples', 'Allow authenticated insert own samples', 'create policy "Allow authenticated insert own samples" on public.samples for insert to authenticated with check ((select auth.uid()) = user_id)');
select pg_temp.eigyo_reset_policy_if_relation_exists('public.samples', 'Allow authenticated update own samples', 'create policy "Allow authenticated update own samples" on public.samples for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)');
select pg_temp.eigyo_reset_policy_if_relation_exists('public.samples', 'Allow authenticated delete own samples', 'create policy "Allow authenticated delete own samples" on public.samples for delete to authenticated using ((select auth.uid()) = user_id)');

select pg_temp.eigyo_reset_policy_if_relation_exists('public.quotes', 'Allow authenticated read own quotes', 'create policy "Allow authenticated read own quotes" on public.quotes for select to authenticated using ((select auth.uid()) = user_id)');
select pg_temp.eigyo_reset_policy_if_relation_exists('public.quotes', 'Allow authenticated insert own quotes', 'create policy "Allow authenticated insert own quotes" on public.quotes for insert to authenticated with check ((select auth.uid()) = user_id)');
select pg_temp.eigyo_reset_policy_if_relation_exists('public.quotes', 'Allow authenticated update own quotes', 'create policy "Allow authenticated update own quotes" on public.quotes for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)');
select pg_temp.eigyo_reset_policy_if_relation_exists('public.quotes', 'Allow authenticated delete own quotes', 'create policy "Allow authenticated delete own quotes" on public.quotes for delete to authenticated using ((select auth.uid()) = user_id)');

select pg_temp.eigyo_reset_policy_if_relation_exists('public.adoptions', 'Allow authenticated read own adoptions', 'create policy "Allow authenticated read own adoptions" on public.adoptions for select to authenticated using ((select auth.uid()) = user_id)');
select pg_temp.eigyo_reset_policy_if_relation_exists('public.adoptions', 'Allow authenticated insert own adoptions', 'create policy "Allow authenticated insert own adoptions" on public.adoptions for insert to authenticated with check ((select auth.uid()) = user_id)');
select pg_temp.eigyo_reset_policy_if_relation_exists('public.adoptions', 'Allow authenticated update own adoptions', 'create policy "Allow authenticated update own adoptions" on public.adoptions for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)');
select pg_temp.eigyo_reset_policy_if_relation_exists('public.adoptions', 'Allow authenticated delete own adoptions', 'create policy "Allow authenticated delete own adoptions" on public.adoptions for delete to authenticated using ((select auth.uid()) = user_id)');

select pg_temp.eigyo_reset_policy_if_relation_exists('public.attachments', 'Allow authenticated read own attachments', 'create policy "Allow authenticated read own attachments" on public.attachments for select to authenticated using ((select auth.uid()) = user_id)');
select pg_temp.eigyo_reset_policy_if_relation_exists('public.attachments', 'Allow authenticated insert own attachments', 'create policy "Allow authenticated insert own attachments" on public.attachments for insert to authenticated with check ((select auth.uid()) = user_id)');
select pg_temp.eigyo_reset_policy_if_relation_exists('public.attachments', 'Allow authenticated update own attachments', 'create policy "Allow authenticated update own attachments" on public.attachments for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)');
select pg_temp.eigyo_reset_policy_if_relation_exists('public.attachments', 'Allow authenticated delete own attachments', 'create policy "Allow authenticated delete own attachments" on public.attachments for delete to authenticated using ((select auth.uid()) = user_id)');

-- Storage bucket is kept public because the current app stores public_url from
-- getPublicUrl(). Object write/update/delete remain user-folder scoped.
do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public)
    values ('app-attachments', 'app-attachments', true)
    on conflict (id) do update set public = excluded.public;
  else
    raise notice 'storage.buckets does not exist; skip storage bucket optimization';
  end if;
end;
$$;

select pg_temp.eigyo_reset_policy_if_relation_exists('storage.objects', 'Allow authenticated upload own app attachments', 'create policy "Allow authenticated upload own app attachments" on storage.objects for insert to authenticated with check (bucket_id = ''app-attachments'' and (select auth.uid())::text = (storage.foldername(name))[1])');
select pg_temp.eigyo_reset_policy_if_relation_exists('storage.objects', 'Allow authenticated read own app attachments', 'create policy "Allow authenticated read own app attachments" on storage.objects for select to authenticated using (bucket_id = ''app-attachments'' and (select auth.uid())::text = (storage.foldername(name))[1])');
select pg_temp.eigyo_reset_policy_if_relation_exists('storage.objects', 'Allow authenticated update own app attachments', 'create policy "Allow authenticated update own app attachments" on storage.objects for update to authenticated using (bucket_id = ''app-attachments'' and (select auth.uid())::text = (storage.foldername(name))[1]) with check (bucket_id = ''app-attachments'' and (select auth.uid())::text = (storage.foldername(name))[1])');
select pg_temp.eigyo_reset_policy_if_relation_exists('storage.objects', 'Allow authenticated delete own app attachments', 'create policy "Allow authenticated delete own app attachments" on storage.objects for delete to authenticated using (bucket_id = ''app-attachments'' and (select auth.uid())::text = (storage.foldername(name))[1])');
