-- Per-child Stripe subscription billing: one subscription row per parent,
-- quantity tracks how many children they currently have (minimum 1 once
-- subscribed). All writes are service-role only (Stripe webhook + edge
-- functions) — there is no client insert/update policy.

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null unique references public.profiles(id) on delete cascade,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  status text not null default 'incomplete',
  billing_interval text check (billing_interval in ('month','year')),
  quantity int not null default 0,
  current_period_end timestamptz,
  -- Stripe's own creation time for stripe_subscription_id, used to guard
  -- against a late-arriving webhook retry for an old (since-canceled)
  -- subscription clobbering a parent's newer resubscription.
  stripe_subscription_created_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

-- Parent can read their own subscription row directly (needed for the
-- Billing/ParentSettings UI, which shows interval and next renewal date).
create policy subscriptions_select_own on public.subscriptions for select
  using (parent_id = auth.uid());

-- Children must NOT see raw Stripe customer/subscription IDs, so instead of a
-- second RLS policy exposing the whole row to children, use the same
-- SECURITY DEFINER pattern as check_username_available() to expose only the
-- two fields the app-lock screen actually needs.
create or replace function public.get_family_subscription_status()
returns table(status text, current_period_end timestamptz)
language sql security definer set search_path = public as $$
  select s.status, s.current_period_end
  from public.subscriptions s
  where s.parent_id = coalesce(
    (select parent_id from public.profiles where id = auth.uid()),
    auth.uid()
  );
$$;

grant execute on function public.get_family_subscription_status() to authenticated;
