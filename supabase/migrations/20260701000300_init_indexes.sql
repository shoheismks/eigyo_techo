-- Eigyo Techo Supabase migration: indexes
-- Indexes are intentionally conservative and focused on existing app queries.

create index if not exists idx_customers_user_id on public.customers (user_id);
create index if not exists idx_customers_updated_at on public.customers (updated_at desc);
create index if not exists idx_customers_status on public.customers (status);
create index if not exists idx_customers_next_follow_up_date on public.customers (next_follow_up_date);
create index if not exists idx_customers_next_follow_date on public.customers (next_follow_date);
create index if not exists idx_customers_rank on public.customers (rank);

create index if not exists idx_mail_drafts_user_id on public.mail_drafts (user_id);
create index if not exists idx_mail_drafts_customer_id on public.mail_drafts (customer_id);
create index if not exists idx_mail_drafts_updated_at on public.mail_drafts (updated_at desc);

create index if not exists idx_products_user_id on public.products (user_id);
create index if not exists idx_products_category on public.products (category);
create index if not exists idx_products_temperature_zone on public.products (temperature_zone);
create index if not exists idx_products_manufacturer_name on public.products (manufacturer_name);
create index if not exists idx_products_updated_at on public.products (updated_at desc);

create index if not exists idx_contacts_user_id on public.contacts (user_id);
create index if not exists idx_contacts_customer_id on public.contacts (customer_id);
create index if not exists idx_contacts_updated_at on public.contacts (updated_at desc);

create index if not exists idx_suppliers_user_id on public.suppliers (user_id);
create index if not exists idx_suppliers_updated_at on public.suppliers (updated_at desc);

create index if not exists idx_business_cards_user_id on public.business_cards (user_id);
create index if not exists idx_business_cards_customer_id on public.business_cards (customer_id);
create index if not exists idx_business_cards_contact_id on public.business_cards (contact_id);
create index if not exists idx_business_cards_updated_at on public.business_cards (updated_at desc);

create index if not exists idx_complaints_user_id on public.complaints (user_id);
create index if not exists idx_complaints_customer_id on public.complaints (customer_id);
create index if not exists idx_complaints_status on public.complaints (status);
create index if not exists idx_complaints_updated_at on public.complaints (updated_at desc);

create index if not exists idx_samples_user_id on public.samples (user_id);
create index if not exists idx_samples_customer_id on public.samples (customer_id);
create index if not exists idx_samples_status on public.samples (status);
create index if not exists idx_samples_follow_up_date on public.samples (follow_up_date);
create index if not exists idx_samples_updated_at on public.samples (updated_at desc);

create index if not exists idx_quotes_user_id on public.quotes (user_id);
create index if not exists idx_quotes_customer_id on public.quotes (customer_id);
create index if not exists idx_quotes_supplier_id on public.quotes (supplier_id);
create index if not exists idx_quotes_status on public.quotes (status);
create index if not exists idx_quotes_valid_until on public.quotes (valid_until);
create index if not exists idx_quotes_updated_at on public.quotes (updated_at desc);

create index if not exists idx_adoptions_user_id on public.adoptions (user_id);
create index if not exists idx_adoptions_customer_id on public.adoptions (customer_id);
create index if not exists idx_adoptions_product_id on public.adoptions (product_id);
create index if not exists idx_adoptions_status on public.adoptions (status);
create index if not exists idx_adoptions_updated_at on public.adoptions (updated_at desc);

create index if not exists idx_attachments_user_id on public.attachments (user_id);
create index if not exists idx_attachments_owner on public.attachments (owner_type, owner_id);
create index if not exists idx_attachments_storage_bucket on public.attachments (storage_bucket);
create index if not exists idx_attachments_updated_at on public.attachments (updated_at desc);
