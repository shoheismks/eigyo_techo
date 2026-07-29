-- Eigyo Techo: issuer-specific UI theme color.

alter table public.issuers
  add column if not exists theme_color text default '';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'issuers_theme_color_hex_check'
      and conrelid = 'public.issuers'::regclass
  ) then
    alter table public.issuers
      add constraint issuers_theme_color_hex_check
      check (theme_color is null or theme_color = '' or theme_color ~ '^#[0-9A-Fa-f]{6}$');
  end if;
end $$;
