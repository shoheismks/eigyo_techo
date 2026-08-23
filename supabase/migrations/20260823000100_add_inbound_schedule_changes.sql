alter table public.inbound_shipment_lines
  add column if not exists original_customs_clearance_planned_date date,
  add column if not exists schedule_updated_at timestamptz,
  add column if not exists schedule_updated_by uuid;

update public.inbound_shipment_lines
set original_customs_clearance_planned_date = customs_clearance_planned_date
where original_customs_clearance_planned_date is null
  and customs_clearance_planned_date is not null;

create table if not exists public.inbound_schedule_changes (
  id text primary key,
  user_id uuid not null,
  inbound_shipment_id text not null references public.inbound_shipments(id),
  inbound_shipment_line_id text not null references public.inbound_shipment_lines(id),
  old_date date,
  new_date date not null,
  delay_days integer not null default 0,
  reason text not null default '',
  memo text not null default '',
  changed_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists idx_inbound_schedule_changes_user_line_created
  on public.inbound_schedule_changes(user_id, inbound_shipment_line_id, created_at desc);

create index if not exists idx_inbound_schedule_changes_user_shipment_created
  on public.inbound_schedule_changes(user_id, inbound_shipment_id, created_at desc);

alter table public.inbound_schedule_changes enable row level security;

drop policy if exists "Users can view own inbound schedule changes" on public.inbound_schedule_changes;
create policy "Users can view own inbound schedule changes"
  on public.inbound_schedule_changes
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own inbound schedule changes" on public.inbound_schedule_changes;
create policy "Users can insert own inbound schedule changes"
  on public.inbound_schedule_changes
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and (changed_by is null or changed_by = auth.uid())
    and exists (
      select 1
      from public.inbound_shipment_lines line
      where line.id = inbound_schedule_changes.inbound_shipment_line_id
        and line.inbound_shipment_id = inbound_schedule_changes.inbound_shipment_id
        and line.user_id = auth.uid()
    )
  );

revoke update, delete on public.inbound_schedule_changes from authenticated;
grant select, insert on public.inbound_schedule_changes to authenticated;

create or replace function public.update_inbound_schedule(
  p_inbound_shipment_line_id text,
  p_new_date date,
  p_reason text default '',
  p_memo text default null
) returns jsonb
language plpgsql
as $$
declare
  v_user_id uuid := auth.uid();
  v_line public.inbound_shipment_lines%rowtype;
  v_original_date date;
  v_reason text := btrim(coalesce(p_reason, ''));
  v_memo text := coalesce(p_memo, '');
  v_delay_days integer := 0;
  v_change_id text := gen_random_uuid()::text;
begin
  if v_user_id is null then
    raise exception '認証ユーザーを確認できません。';
  end if;

  if p_inbound_shipment_line_id is null or btrim(p_inbound_shipment_line_id) = '' then
    raise exception '入荷予定明細が指定されていません。';
  end if;

  if p_new_date is null then
    raise exception '新しい通関予定日を入力してください。';
  end if;

  if v_reason = '' then
    raise exception '予定変更理由を入力してください。';
  end if;

  select *
    into v_line
    from public.inbound_shipment_lines
   where id = p_inbound_shipment_line_id
     and user_id = v_user_id
   for update;

  if not found then
    raise exception '入荷予定明細が見つかりません。';
  end if;

  if v_line.status not in ('pending', 'partially_received') then
    raise exception 'このステータスの明細は予定変更できません。';
  end if;

  if v_line.cancelled_at is not null or v_line.deleted_at is not null then
    raise exception '取消または削除済みの明細は予定変更できません。';
  end if;

  if v_line.customs_clearance_planned_date is not distinct from p_new_date then
    return jsonb_build_object(
      'status', 'unchanged',
      'inbound_shipment_line_id', v_line.id,
      'customs_clearance_planned_date', v_line.customs_clearance_planned_date,
      'original_customs_clearance_planned_date', coalesce(v_line.original_customs_clearance_planned_date, v_line.customs_clearance_planned_date)
    );
  end if;

  v_original_date := coalesce(v_line.original_customs_clearance_planned_date, v_line.customs_clearance_planned_date, p_new_date);
  v_delay_days := p_new_date - v_original_date;

  insert into public.inbound_schedule_changes (
    id,
    user_id,
    inbound_shipment_id,
    inbound_shipment_line_id,
    old_date,
    new_date,
    delay_days,
    reason,
    memo,
    changed_by,
    created_at
  ) values (
    v_change_id,
    v_user_id,
    v_line.inbound_shipment_id,
    v_line.id,
    v_line.customs_clearance_planned_date,
    p_new_date,
    v_delay_days,
    v_reason,
    v_memo,
    v_user_id,
    now()
  );

  update public.inbound_shipment_lines
     set original_customs_clearance_planned_date = v_original_date,
         customs_clearance_planned_date = p_new_date,
         schedule_updated_at = now(),
         schedule_updated_by = v_user_id,
         updated_at = now()
   where id = v_line.id
     and user_id = v_user_id;

  return jsonb_build_object(
    'status', 'updated',
    'change_id', v_change_id,
    'inbound_shipment_id', v_line.inbound_shipment_id,
    'inbound_shipment_line_id', v_line.id,
    'old_date', v_line.customs_clearance_planned_date,
    'new_date', p_new_date,
    'delay_days', v_delay_days
  );
end;
$$;

revoke all on function public.update_inbound_schedule(text, date, text, text) from public;
revoke all on function public.update_inbound_schedule(text, date, text, text) from anon;
grant execute on function public.update_inbound_schedule(text, date, text, text) to authenticated;
