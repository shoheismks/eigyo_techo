alter table public.projects
  add column if not exists product_proposals jsonb not null default '[]'::jsonb;

comment on column public.projects.product_proposals is
  'Project-scoped product proposal/adoption candidates with status, forecast quantity, price, cost, profit and reason fields.';
