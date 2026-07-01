-- Eigyo Techo Supabase migration: RLS and storage policies
-- Policies are reset safely so the SQL can also be run from Supabase SQL Editor.

alter table public.customers enable row level security;
alter table public.mail_drafts enable row level security;
alter table public.products enable row level security;
alter table public.contacts enable row level security;
alter table public.suppliers enable row level security;
alter table public.business_cards enable row level security;
alter table public.complaints enable row level security;
alter table public.samples enable row level security;
alter table public.quotes enable row level security;
alter table public.adoptions enable row level security;
alter table public.attachments enable row level security;

create or replace function pg_temp.eigyo_drop_policy(
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

create or replace function pg_temp.eigyo_reset_policy(
  relation_name text,
  policy_name text,
  create_policy_sql text
) returns void
language plpgsql
as $$
begin
  if to_regclass(relation_name) is null then
    raise notice 'skip create policy %, relation % does not exist', policy_name, relation_name;
    return;
  end if;

  perform pg_temp.eigyo_drop_policy(relation_name, policy_name);
  execute create_policy_sql;
end;
$$;

select pg_temp.eigyo_drop_policy('public.customers', 'Allow anon read customers');
select pg_temp.eigyo_drop_policy('public.customers', 'Allow anon insert customers');
select pg_temp.eigyo_drop_policy('public.customers', 'Allow anon update customers');
select pg_temp.eigyo_drop_policy('public.customers', 'Allow anon delete customers');
select pg_temp.eigyo_drop_policy('public.mail_drafts', 'Allow anon read mail_drafts');
select pg_temp.eigyo_drop_policy('public.mail_drafts', 'Allow anon insert mail_drafts');
select pg_temp.eigyo_drop_policy('public.mail_drafts', 'Allow anon update mail_drafts');
select pg_temp.eigyo_drop_policy('public.mail_drafts', 'Allow anon delete mail_drafts');

select pg_temp.eigyo_reset_policy('public.customers', 'Allow authenticated read own customers', 'create policy "Allow authenticated read own customers" on public.customers for select to authenticated using (auth.uid() = user_id)');
select pg_temp.eigyo_reset_policy('public.customers', 'Allow authenticated insert own customers', 'create policy "Allow authenticated insert own customers" on public.customers for insert to authenticated with check (auth.uid() = user_id)');
select pg_temp.eigyo_reset_policy('public.customers', 'Allow authenticated update own customers', 'create policy "Allow authenticated update own customers" on public.customers for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)');
select pg_temp.eigyo_reset_policy('public.customers', 'Allow authenticated delete own customers', 'create policy "Allow authenticated delete own customers" on public.customers for delete to authenticated using (auth.uid() = user_id)');

select pg_temp.eigyo_reset_policy('public.mail_drafts', 'Allow authenticated read own mail_drafts', 'create policy "Allow authenticated read own mail_drafts" on public.mail_drafts for select to authenticated using (auth.uid() = user_id)');
select pg_temp.eigyo_reset_policy('public.mail_drafts', 'Allow authenticated insert own mail_drafts', 'create policy "Allow authenticated insert own mail_drafts" on public.mail_drafts for insert to authenticated with check (auth.uid() = user_id)');
select pg_temp.eigyo_reset_policy('public.mail_drafts', 'Allow authenticated update own mail_drafts', 'create policy "Allow authenticated update own mail_drafts" on public.mail_drafts for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)');
select pg_temp.eigyo_reset_policy('public.mail_drafts', 'Allow authenticated delete own mail_drafts', 'create policy "Allow authenticated delete own mail_drafts" on public.mail_drafts for delete to authenticated using (auth.uid() = user_id)');

select pg_temp.eigyo_reset_policy('public.products', 'Allow authenticated read own products', 'create policy "Allow authenticated read own products" on public.products for select to authenticated using (auth.uid() = user_id)');
select pg_temp.eigyo_reset_policy('public.products', 'Allow authenticated insert own products', 'create policy "Allow authenticated insert own products" on public.products for insert to authenticated with check (auth.uid() = user_id)');
select pg_temp.eigyo_reset_policy('public.products', 'Allow authenticated update own products', 'create policy "Allow authenticated update own products" on public.products for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)');
select pg_temp.eigyo_reset_policy('public.products', 'Allow authenticated delete own products', 'create policy "Allow authenticated delete own products" on public.products for delete to authenticated using (auth.uid() = user_id)');

select pg_temp.eigyo_reset_policy('public.contacts', 'Allow authenticated read own contacts', 'create policy "Allow authenticated read own contacts" on public.contacts for select to authenticated using (auth.uid() = user_id)');
select pg_temp.eigyo_reset_policy('public.contacts', 'Allow authenticated insert own contacts', 'create policy "Allow authenticated insert own contacts" on public.contacts for insert to authenticated with check (auth.uid() = user_id)');
select pg_temp.eigyo_reset_policy('public.contacts', 'Allow authenticated update own contacts', 'create policy "Allow authenticated update own contacts" on public.contacts for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)');
select pg_temp.eigyo_reset_policy('public.contacts', 'Allow authenticated delete own contacts', 'create policy "Allow authenticated delete own contacts" on public.contacts for delete to authenticated using (auth.uid() = user_id)');

select pg_temp.eigyo_reset_policy('public.suppliers', 'Allow authenticated read own suppliers', 'create policy "Allow authenticated read own suppliers" on public.suppliers for select to authenticated using (auth.uid() = user_id)');
select pg_temp.eigyo_reset_policy('public.suppliers', 'Allow authenticated insert own suppliers', 'create policy "Allow authenticated insert own suppliers" on public.suppliers for insert to authenticated with check (auth.uid() = user_id)');
select pg_temp.eigyo_reset_policy('public.suppliers', 'Allow authenticated update own suppliers', 'create policy "Allow authenticated update own suppliers" on public.suppliers for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)');
select pg_temp.eigyo_reset_policy('public.suppliers', 'Allow authenticated delete own suppliers', 'create policy "Allow authenticated delete own suppliers" on public.suppliers for delete to authenticated using (auth.uid() = user_id)');

select pg_temp.eigyo_reset_policy('public.business_cards', 'Allow authenticated read own business_cards', 'create policy "Allow authenticated read own business_cards" on public.business_cards for select to authenticated using (auth.uid() = user_id)');
select pg_temp.eigyo_reset_policy('public.business_cards', 'Allow authenticated insert own business_cards', 'create policy "Allow authenticated insert own business_cards" on public.business_cards for insert to authenticated with check (auth.uid() = user_id)');
select pg_temp.eigyo_reset_policy('public.business_cards', 'Allow authenticated update own business_cards', 'create policy "Allow authenticated update own business_cards" on public.business_cards for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)');
select pg_temp.eigyo_reset_policy('public.business_cards', 'Allow authenticated delete own business_cards', 'create policy "Allow authenticated delete own business_cards" on public.business_cards for delete to authenticated using (auth.uid() = user_id)');

select pg_temp.eigyo_reset_policy('public.complaints', 'Allow authenticated read own complaints', 'create policy "Allow authenticated read own complaints" on public.complaints for select to authenticated using (auth.uid() = user_id)');
select pg_temp.eigyo_reset_policy('public.complaints', 'Allow authenticated insert own complaints', 'create policy "Allow authenticated insert own complaints" on public.complaints for insert to authenticated with check (auth.uid() = user_id)');
select pg_temp.eigyo_reset_policy('public.complaints', 'Allow authenticated update own complaints', 'create policy "Allow authenticated update own complaints" on public.complaints for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)');
select pg_temp.eigyo_reset_policy('public.complaints', 'Allow authenticated delete own complaints', 'create policy "Allow authenticated delete own complaints" on public.complaints for delete to authenticated using (auth.uid() = user_id)');

select pg_temp.eigyo_reset_policy('public.samples', 'Allow authenticated read own samples', 'create policy "Allow authenticated read own samples" on public.samples for select to authenticated using (auth.uid() = user_id)');
select pg_temp.eigyo_reset_policy('public.samples', 'Allow authenticated insert own samples', 'create policy "Allow authenticated insert own samples" on public.samples for insert to authenticated with check (auth.uid() = user_id)');
select pg_temp.eigyo_reset_policy('public.samples', 'Allow authenticated update own samples', 'create policy "Allow authenticated update own samples" on public.samples for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)');
select pg_temp.eigyo_reset_policy('public.samples', 'Allow authenticated delete own samples', 'create policy "Allow authenticated delete own samples" on public.samples for delete to authenticated using (auth.uid() = user_id)');

select pg_temp.eigyo_reset_policy('public.quotes', 'Allow authenticated read own quotes', 'create policy "Allow authenticated read own quotes" on public.quotes for select to authenticated using (auth.uid() = user_id)');
select pg_temp.eigyo_reset_policy('public.quotes', 'Allow authenticated insert own quotes', 'create policy "Allow authenticated insert own quotes" on public.quotes for insert to authenticated with check (auth.uid() = user_id)');
select pg_temp.eigyo_reset_policy('public.quotes', 'Allow authenticated update own quotes', 'create policy "Allow authenticated update own quotes" on public.quotes for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)');
select pg_temp.eigyo_reset_policy('public.quotes', 'Allow authenticated delete own quotes', 'create policy "Allow authenticated delete own quotes" on public.quotes for delete to authenticated using (auth.uid() = user_id)');

select pg_temp.eigyo_reset_policy('public.adoptions', 'Allow authenticated read own adoptions', 'create policy "Allow authenticated read own adoptions" on public.adoptions for select to authenticated using (auth.uid() = user_id)');
select pg_temp.eigyo_reset_policy('public.adoptions', 'Allow authenticated insert own adoptions', 'create policy "Allow authenticated insert own adoptions" on public.adoptions for insert to authenticated with check (auth.uid() = user_id)');
select pg_temp.eigyo_reset_policy('public.adoptions', 'Allow authenticated update own adoptions', 'create policy "Allow authenticated update own adoptions" on public.adoptions for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)');
select pg_temp.eigyo_reset_policy('public.adoptions', 'Allow authenticated delete own adoptions', 'create policy "Allow authenticated delete own adoptions" on public.adoptions for delete to authenticated using (auth.uid() = user_id)');

select pg_temp.eigyo_reset_policy('public.attachments', 'Allow authenticated read own attachments', 'create policy "Allow authenticated read own attachments" on public.attachments for select to authenticated using (auth.uid() = user_id)');
select pg_temp.eigyo_reset_policy('public.attachments', 'Allow authenticated insert own attachments', 'create policy "Allow authenticated insert own attachments" on public.attachments for insert to authenticated with check (auth.uid() = user_id)');
select pg_temp.eigyo_reset_policy('public.attachments', 'Allow authenticated update own attachments', 'create policy "Allow authenticated update own attachments" on public.attachments for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)');
select pg_temp.eigyo_reset_policy('public.attachments', 'Allow authenticated delete own attachments', 'create policy "Allow authenticated delete own attachments" on public.attachments for delete to authenticated using (auth.uid() = user_id)');

select pg_temp.eigyo_reset_policy('storage.objects', 'Allow authenticated upload own app attachments', 'create policy "Allow authenticated upload own app attachments" on storage.objects for insert to authenticated with check (bucket_id = ''app-attachments'' and auth.uid()::text = (storage.foldername(name))[1])');
select pg_temp.eigyo_reset_policy('storage.objects', 'Allow authenticated read own app attachments', 'create policy "Allow authenticated read own app attachments" on storage.objects for select to authenticated using (bucket_id = ''app-attachments'' and auth.uid()::text = (storage.foldername(name))[1])');
select pg_temp.eigyo_reset_policy('storage.objects', 'Allow authenticated update own app attachments', 'create policy "Allow authenticated update own app attachments" on storage.objects for update to authenticated using (bucket_id = ''app-attachments'' and auth.uid()::text = (storage.foldername(name))[1]) with check (bucket_id = ''app-attachments'' and auth.uid()::text = (storage.foldername(name))[1])');
select pg_temp.eigyo_reset_policy('storage.objects', 'Allow authenticated delete own app attachments', 'create policy "Allow authenticated delete own app attachments" on storage.objects for delete to authenticated using (bucket_id = ''app-attachments'' and auth.uid()::text = (storage.foldername(name))[1])');
