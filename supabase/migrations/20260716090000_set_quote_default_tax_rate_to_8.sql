-- Change only future defaults. Existing quote and issuer rows keep their saved tax rates.

alter table public.quotes
  alter column tax_rate set default 8,
  alter column default_tax_rate set default 8;

alter table public.issuers
  alter column default_tax_rate set default 8;
