drop view if exists public.sales_order_contract_balance;

create view public.sales_order_contract_balance
with (security_invoker = true) as
with shipment_totals as (
  select
    sl.user_id,
    sl.sales_order_line_id,
    sum(case when s.status = 'Shipped' then coalesce(sl.quantity, 0) else 0 end) as shipped_quantity,
    sum(case when s.status not in ('Shipped', 'Cancelled') then coalesce(sl.quantity, 0) else 0 end) as scheduled_quantity
  from public.shipment_lines sl
  join public.shipments s
    on s.id = sl.shipment_id
   and s.user_id = sl.user_id
  where coalesce(s.is_deleted, false) = false
    and s.status <> 'Cancelled'
  group by sl.user_id, sl.sales_order_line_id
)
select
  so.user_id,
  so.id as sales_order_id,
  sol.id as sales_order_line_id,
  so.sales_order_number,
  so.customer_id,
  so.project_id,
  so.order_date,
  so.expected_delivery_date,
  sol.product_id,
  sol.product_code,
  sol.product_name,
  sol.unit,
  coalesce(sol.quantity, 0)::numeric as ordered_quantity,
  coalesce(st.shipped_quantity, 0)::numeric as shipped_quantity,
  coalesce(st.scheduled_quantity, 0)::numeric as scheduled_quantity,
  greatest(coalesce(sol.quantity, 0) - coalesce(st.shipped_quantity, 0), 0)::numeric as remaining_quantity,
  greatest(coalesce(sol.quantity, 0) - coalesce(st.shipped_quantity, 0) - coalesce(st.scheduled_quantity, 0), 0)::numeric as practical_remaining_quantity,
  coalesce(sol.unit_price, 0)::numeric as unit_price,
  (coalesce(sol.quantity, 0) * coalesce(sol.unit_price, 0))::numeric as ordered_amount,
  (coalesce(st.shipped_quantity, 0) * coalesce(sol.unit_price, 0))::numeric as shipped_amount,
  (coalesce(st.scheduled_quantity, 0) * coalesce(sol.unit_price, 0))::numeric as scheduled_amount,
  (greatest(coalesce(sol.quantity, 0) - coalesce(st.shipped_quantity, 0), 0) * coalesce(sol.unit_price, 0))::numeric as remaining_amount,
  case
    when coalesce(sol.quantity, 0) > 0
      then round((coalesce(st.shipped_quantity, 0) / coalesce(sol.quantity, 0)) * 100, 1)
    else 0
  end as progress_rate,
  (so.expected_delivery_date is not null
    and so.expected_delivery_date < current_date
    and greatest(coalesce(sol.quantity, 0) - coalesce(st.shipped_quantity, 0), 0) > 0) as is_overdue
from public.sales_order_lines sol
join public.sales_orders so
  on so.id = sol.sales_order_id
 and so.user_id = sol.user_id
left join shipment_totals st
  on st.sales_order_line_id = sol.id
 and st.user_id = sol.user_id
where coalesce(so.is_deleted, false) = false;

grant select on public.sales_order_contract_balance to authenticated;
