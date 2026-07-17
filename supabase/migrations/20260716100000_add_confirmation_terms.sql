-- Eigyo Techo: issuer terms templates and confirmation terms snapshots.
-- Data preserving: all columns are nullable or have safe defaults.

alter table public.issuers
  add column if not exists default_trade_terms text default '',
  add column if not exists default_disclaimer text default '',
  add column if not exists default_return_policy text default '',
  add column if not exists default_cancellation_policy text default '',
  add column if not exists default_quality_guarantee text default '',
  add column if not exists default_storage_terms text default '',
  add column if not exists default_delivery_disclaimer text default '',
  add column if not exists default_force_majeure text default '',
  add column if not exists default_price_revision_terms text default '',
  add column if not exists default_confidentiality_terms text default '',
  add column if not exists default_governing_law text default '',
  add column if not exists terms_version text default '',
  add column if not exists terms_effective_date date;

alter table public.quotes
  add column if not exists terms_snapshot jsonb,
  add column if not exists disclaimer_snapshot jsonb,
  add column if not exists visible_terms jsonb not null default '{}'::jsonb,
  add column if not exists special_terms text default '',
  add column if not exists terms_version text default '',
  add column if not exists terms_effective_date date,
  add column if not exists accepted_by_customer_name text default '',
  add column if not exists acceptance_method text default '',
  add column if not exists confirmation_revision integer not null default 1,
  add column if not exists confirmation_history jsonb not null default '[]'::jsonb;

create index if not exists idx_quotes_terms_version on public.quotes (user_id, terms_version);
create index if not exists idx_quotes_confirmation_revision on public.quotes (user_id, confirmation_revision);

update public.quotes
set
  visible_terms = coalesce(visible_terms, '{}'::jsonb),
  confirmation_history = coalesce(confirmation_history, '[]'::jsonb),
  confirmation_revision = coalesce(confirmation_revision, 1)
where visible_terms is null
   or confirmation_history is null
   or confirmation_revision is null;

grant select, insert, update, delete on table public.issuers to authenticated;
grant select, insert, update, delete on table public.quotes to authenticated;

notify pgrst, 'reload schema';
