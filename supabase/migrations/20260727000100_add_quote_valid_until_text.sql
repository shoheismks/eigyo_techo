alter table public.quotes
  add column if not exists valid_until_mode text not null default 'date',
  add column if not exists valid_until_text text;

alter table public.quotes
  drop constraint if exists quotes_valid_until_mode_check;

alter table public.quotes
  add constraint quotes_valid_until_mode_check
  check (valid_until_mode in ('date', 'text'));

create index if not exists idx_quotes_user_valid_until_mode
  on public.quotes (user_id, valid_until_mode);
