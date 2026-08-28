drop index if exists public.product_aliases_active_alias_unique_idx;
create unique index product_aliases_active_alias_unique_idx
  on public.product_aliases (
    user_id,
    (case
      when supplier_id is not null then 'id:' || supplier_id
      when btrim(supplier_name_snapshot) <> '' then
        'name:' || public.normalize_product_alias_text(supplier_name_snapshot)
      else 'global'
    end),
    normalized_alias
  )
  where is_active;

drop index if exists public.product_aliases_active_supplier_code_unique_idx;
create unique index product_aliases_active_supplier_code_unique_idx
  on public.product_aliases (
    user_id,
    (case
      when supplier_id is not null then 'id:' || supplier_id
      when btrim(supplier_name_snapshot) <> '' then
        'name:' || public.normalize_product_alias_text(supplier_name_snapshot)
      else 'global'
    end),
    normalized_supplier_product_code
  )
  where is_active and normalized_supplier_product_code <> '';
