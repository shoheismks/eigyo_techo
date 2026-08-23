revoke all on public.inbound_schedule_changes from anon;
revoke all on public.inbound_schedule_changes from authenticated;
grant select, insert on public.inbound_schedule_changes to authenticated;

revoke all on function public.update_inbound_schedule(text, date, text, text) from public;
revoke all on function public.update_inbound_schedule(text, date, text, text) from anon;
grant execute on function public.update_inbound_schedule(text, date, text, text) to authenticated;
