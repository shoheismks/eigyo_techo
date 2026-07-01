-- Eigyo Techo Supabase migration: storage bucket
-- File paths must keep the current app convention:
--   {auth.uid()}/{ownerType}/{ownerId}/{field}-{uuid}.{ext}

do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public)
    values ('app-attachments', 'app-attachments', true)
    on conflict (id) do nothing;
  else
    raise notice 'storage.buckets does not exist; skip storage bucket setup';
  end if;
end;
$$;
