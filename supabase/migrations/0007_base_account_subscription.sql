-- Parent accounts now require a $6.99/mo base subscription (one complimentary
-- child included); the existing $3.99/mo or $19.99/yr per-additional-child
-- charge stays as a second, independent Stripe subscription on the same
-- customer. subscriptions moves from one row per parent to one row per
-- (parent, plan_type).

alter table public.subscriptions
  add column plan_type text not null default 'addon' check (plan_type in ('base', 'addon'));

alter table public.subscriptions drop constraint subscriptions_parent_id_key;
alter table public.subscriptions add constraint subscriptions_parent_id_plan_type_key unique (parent_id, plan_type);

-- The same Stripe customer will now legitimately own two subscriptions
-- (base + addon) for one parent, so stripe_customer_id can no longer be
-- globally unique. stripe_subscription_id stays unique -- each plan is
-- still backed by its own distinct Stripe subscription.
alter table public.subscriptions drop constraint subscriptions_stripe_customer_id_key;

-- Grandfathering: anyone who has already paid for a 2nd+ child at least once
-- (i.e. already has an addon row) never owes the new base fee. Seed a
-- synthetic, permanently-active base row for them with no real Stripe
-- subscription behind it, so the app-side access check needs no special
-- casing beyond "is the base plan active".
insert into public.subscriptions (parent_id, plan_type, status)
select distinct parent_id, 'base', 'active' from public.subscriptions where plan_type = 'addon'
on conflict (parent_id, plan_type) do nothing;

drop function public.get_family_subscription_status();

create function public.get_family_subscription_status()
returns table(
  base_status text,
  base_current_period_end timestamptz,
  addon_status text,
  addon_current_period_end timestamptz,
  child_count integer
)
language sql security definer set search_path = public as $$
  with target as (
    select coalesce(
      (select parent_id from public.profiles where id = auth.uid()),
      auth.uid()
    ) as parent_id
  )
  select
    base.status,
    base.current_period_end,
    addon.status,
    addon.current_period_end,
    (select count(*)::int from public.profiles c where c.parent_id = target.parent_id) as child_count
  from target
  left join public.subscriptions base on base.parent_id = target.parent_id and base.plan_type = 'base'
  left join public.subscriptions addon on addon.parent_id = target.parent_id and addon.plan_type = 'addon';
$$;

grant execute on function public.get_family_subscription_status() to authenticated;
