-- Dashboard stats (FC-20).
--
-- `collection_stats()` gains the month each item was added, so the dashboard's "added per month" chart
-- comes from the same single aggregate call as its counts and values. The month is taken in the
-- caller's time zone (`p_time_zone`, an IANA name such as `Europe/Berlin`), so an item added late on
-- the last day of a month lands in the month the user saw. Items added before the last 12 months
-- (this month included) get a null month, which keeps the result to at most
-- categories x statuses x currencies x 13 rows, however old the collection is.
--
-- The return type changes, so the function is dropped and created again (with its grants).

drop function if exists public.collection_stats();

create function public.collection_stats(p_time_zone text default 'UTC')
returns table (
  category public.item_category,
  ownership public.ownership_status,
  currency text,
  added_month date,
  item_count bigint,
  quantity_total bigint,
  estimated_value_total numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    ci.category,
    ci.ownership,
    ci.currency,
    case
      when (ci.created_at at time zone p_time_zone)
        >= date_trunc('month', now() at time zone p_time_zone) - interval '11 months'
        then date_trunc('month', ci.created_at at time zone p_time_zone)::date
    end as added_month,
    count(*) as item_count,
    sum(ci.quantity)::bigint as quantity_total,
    coalesce(sum(ci.estimated_value * ci.quantity), 0) as estimated_value_total
  from public.collection_items ci
  where ci.user_id = (select auth.uid())
  group by 1, 2, 3, 4;
$$;

revoke execute on function public.collection_stats(text) from public, anon;
grant execute on function public.collection_stats(text) to authenticated, service_role;
