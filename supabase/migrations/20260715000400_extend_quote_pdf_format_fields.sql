alter table public.quotes
  add column if not exists default_tax_rate numeric default 10,
  add column if not exists tax_display_mode text not null default 'tax_excluded',
  add column if not exists rounding_mode text not null default 'round',
  add column if not exists tax_breakdown jsonb not null default '[]'::jsonb,
  add column if not exists delivery_date text;

alter table public.quotes
  drop constraint if exists quotes_tax_display_mode_check;

alter table public.quotes
  add constraint quotes_tax_display_mode_check
  check (tax_display_mode in ('tax_excluded', 'tax_included'));

alter table public.quotes
  drop constraint if exists quotes_rounding_mode_check;

alter table public.quotes
  add constraint quotes_rounding_mode_check
  check (rounding_mode in ('round', 'floor', 'ceil'));

update public.quotes
set
  default_tax_rate = coalesce(default_tax_rate, tax_rate, 10),
  tax_display_mode = coalesce(nullif(tax_display_mode, ''), 'tax_excluded'),
  rounding_mode = coalesce(nullif(rounding_mode, ''), 'round'),
  tax_breakdown = coalesce(tax_breakdown, '[]'::jsonb),
  quote_lines = coalesce(quote_lines, '[]'::jsonb);

grant select, insert, update, delete on table public.quotes to authenticated;

notify pgrst, 'reload schema';
