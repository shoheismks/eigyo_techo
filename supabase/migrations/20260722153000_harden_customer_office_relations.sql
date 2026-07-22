-- Harden customer office relationships without changing existing records.
-- This keeps customers as independent transaction records while enforcing
-- same-user, one-level head office relationships at the database boundary.

alter table public.customers
  add column if not exists parent_customer_id text,
  add column if not exists office_type text default 'head_office',
  add column if not exists branch_name text,
  add column if not exists branch_code text,
  add column if not exists is_head_office boolean default true,
  add column if not exists billing_customer_id text,
  add column if not exists shipping_customer_id text;

update public.customers
set
  office_type = coalesce(nullif(office_type, ''), 'head_office'),
  is_head_office = coalesce(is_head_office, true)
where office_type is null
   or office_type = ''
   or is_head_office is null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'customers_office_type_check'
  ) then
    alter table public.customers
      add constraint customers_office_type_check
      check (office_type in ('head_office', 'branch', 'sales_office', 'store', 'factory', 'warehouse', 'other'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'customers_parent_customer_fk'
  ) then
    alter table public.customers
      add constraint customers_parent_customer_fk
      foreign key (parent_customer_id) references public.customers(id)
      on delete restrict;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'customers_billing_customer_fk'
  ) then
    alter table public.customers
      add constraint customers_billing_customer_fk
      foreign key (billing_customer_id) references public.customers(id)
      on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'customers_shipping_customer_fk'
  ) then
    alter table public.customers
      add constraint customers_shipping_customer_fk
      foreign key (shipping_customer_id) references public.customers(id)
      on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'customers_branch_code_ascii_check'
  ) then
    alter table public.customers
      add constraint customers_branch_code_ascii_check
      check (branch_code is null or branch_code = '' or branch_code ~ '^[!-~]+$');
  end if;
end $$;

create index if not exists idx_customers_user_parent_customer_id
  on public.customers (user_id, parent_customer_id);

create index if not exists idx_customers_user_office_type
  on public.customers (user_id, office_type);

create index if not exists idx_customers_user_billing_customer_id
  on public.customers (user_id, billing_customer_id);

create index if not exists idx_customers_user_shipping_customer_id
  on public.customers (user_id, shipping_customer_id);

create unique index if not exists customers_user_branch_code_unique_idx
  on public.customers (user_id, lower(branch_code))
  where branch_code is not null and branch_code <> '';

create or replace function public.validate_customer_office_relations()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  parent_record public.customers%rowtype;
  related_count integer;
begin
  new.office_type := coalesce(nullif(new.office_type, ''), 'head_office');
  new.branch_code := nullif(trim(coalesce(new.branch_code, '')), '');
  new.billing_customer_id := nullif(new.billing_customer_id, '');
  new.shipping_customer_id := nullif(new.shipping_customer_id, '');

  if new.office_type = 'head_office' then
    new.parent_customer_id := null;
    new.is_head_office := true;
  else
    new.is_head_office := false;

    if new.parent_customer_id is null or new.parent_customer_id = '' then
      raise exception 'parent_customer_id is required for branch offices';
    end if;

    if new.parent_customer_id = new.id then
      raise exception 'customer cannot be its own parent';
    end if;

    select * into parent_record
    from public.customers
    where id = new.parent_customer_id
      and user_id = new.user_id;

    if parent_record.id is null then
      raise exception 'parent customer must belong to the same user';
    end if;

    if parent_record.parent_customer_id is not null or parent_record.office_type <> 'head_office' then
      raise exception 'only a head office can be selected as parent';
    end if;
  end if;

  if new.billing_customer_id is not null then
    select count(*) into related_count
    from public.customers
    where id = new.billing_customer_id
      and user_id = new.user_id;

    if related_count = 0 then
      raise exception 'billing customer must belong to the same user';
    end if;
  end if;

  if new.shipping_customer_id is not null then
    select count(*) into related_count
    from public.customers
    where id = new.shipping_customer_id
      and user_id = new.user_id;

    if related_count = 0 then
      raise exception 'shipping customer must belong to the same user';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.validate_customer_office_relations() from public;

drop trigger if exists trg_validate_customer_office_relations on public.customers;
create trigger trg_validate_customer_office_relations
before insert or update of parent_customer_id, office_type, branch_code, is_head_office, billing_customer_id, shipping_customer_id, user_id
on public.customers
for each row
execute function public.validate_customer_office_relations();
