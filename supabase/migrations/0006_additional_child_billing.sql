-- First child is free; billing now only counts children beyond the first.
-- get_family_subscription_status() needs to report child_count alongside
-- status, and must keep working for families that have never subscribed
-- (no row in public.subscriptions at all) -- previously that meant zero
-- rows came back at all, which would have silently dropped child_count too.

drop function public.get_family_subscription_status();

create function public.get_family_subscription_status()
returns table(status text, current_period_end timestamptz, child_count integer)
language sql security definer set search_path = public as $$
  with target as (
    select coalesce(
      (select parent_id from public.profiles where id = auth.uid()),
      auth.uid()
    ) as parent_id
  )
  select
    s.status,
    s.current_period_end,
    (select count(*)::int from public.profiles c where c.parent_id = target.parent_id) as child_count
  from target
  left join public.subscriptions s on s.parent_id = target.parent_id;
$$;

grant execute on function public.get_family_subscription_status() to authenticated;
