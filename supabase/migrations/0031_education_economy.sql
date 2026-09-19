-- The classroom economy behind the student portal: EduBucks balances, the
-- ledger, the teacher's class store, owned items, the student-to-student
-- marketplace (fixed price and auctions), classroom jobs, recurring charges,
-- payday, bonds, venture funds, badges and the class leaderboard.
--
-- Money model
--   Every movement of EduBucks is one row in edu_ledger. edu_balances is the
--   running total of those rows per student and per account, updated in the
--   same transaction by edu_post() -- the ONLY writer of either table. A
--   student has three accounts:
--     cash    -- spending cash. May go negative, but only through teacher
--                charges (rent); every student-initiated spend checks funds.
--     savings -- the class bank. Earns the class's weekly interest on payday.
--     held    -- money locked behind the student's leading auction bids.
--                Released on being outbid, paid to the seller on winning.
--   Net worth = cash + savings + held + the current value of owned items.
--
-- Write model
--   Clients get SELECT-only RLS. Every mutation is a SECURITY DEFINER
--   function that derives the student from auth.uid(), locks what it
--   touches, and validates everything itself. Internal helpers are revoked
--   from every client role.
--
-- Time model
--   Paydays, auction endings, bond maturities and job end dates are all
--   processed by edu_process_class(), which is idempotent and runs both from
--   pg_cron (0032) and lazily whenever a student opens the portal
--   (edu_refresh), so nothing depends on the scheduler alone.
--
-- Teacher-facing functions (create jobs, approve listings, resolve venture
-- funds, ...) belong to the educator portal and are not part of this
-- migration. Until then those rows are managed with SQL.

-- ============================================================
-- Class economy settings and student profile fields
-- ============================================================

alter table public.classes
  -- Paid on payday, as a percentage of the savings balance, once a week.
  add column savings_rate_pct numeric(6,3) not null default 0
    check (savings_rate_pct >= 0 and savings_rate_pct <= 100),
  -- 0 = Sunday ... 6 = Saturday, in the class's timezone.
  add column payday_dow smallint not null default 5 check (payday_dow between 0 and 6);

alter table public.students
  add column avatar_emoji text not null default '🦁' check (char_length(avatar_emoji) between 1 and 16),
  add column quote text not null default '' check (char_length(quote) <= 120),
  add column savings_goal_name text not null default '' check (char_length(savings_goal_name) <= 60),
  add column savings_goal_amount numeric(12,2) check (savings_goal_amount > 0),
  -- Whether classmates see item names on the leaderboard and portfolio view.
  add column show_holdings boolean not null default true,
  add column pinned_badges text[] not null default '{}' check (cardinality(pinned_badges) <= 4),
  add column streak_count int not null default 0,
  add column last_login_date date;

-- ============================================================
-- Balances and ledger
-- ============================================================

create table public.edu_balances (
  student_id uuid primary key references public.students(id) on delete cascade,
  cash numeric(12,2) not null default 0,
  savings numeric(12,2) not null default 0 check (savings >= 0),
  held numeric(12,2) not null default 0 check (held >= 0),
  total_interest numeric(12,2) not null default 0,
  updated_at timestamptz not null default now()
);

create or replace function public.edu_create_balance_row()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.edu_balances (student_id) values (new.id) on conflict do nothing;
  return new;
end; $$;

create trigger on_student_created
  after insert on public.students for each row execute function public.edu_create_balance_row();

create table public.edu_ledger (
  id bigint generated always as identity primary key,
  class_id uuid not null references public.classes(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  account text not null check (account in ('cash', 'savings', 'held')),
  amount numeric(12,2) not null check (amount <> 0),
  kind text not null check (kind in (
    'salary', 'charge', 'interest', 'income', 'transfer',
    'store_purchase', 'market_purchase', 'market_sale',
    'bid_hold', 'bid_release',
    'bond_payout', 'venture_payout', 'badge_reward', 'adjustment'
  )),
  description text not null check (char_length(description) <= 200),
  created_at timestamptz not null default now()
);
create index edu_ledger_student_created_idx on public.edu_ledger (student_id, created_at desc);

-- ============================================================
-- Class store and owned items
-- ============================================================

create table public.edu_store_items (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  description text not null default '' check (char_length(description) <= 500),
  category text not null check (category in ('privilege', 'physical', 'financial')),
  asset_kind text check (asset_kind in ('bond', 'venture', 'property')),
  price numeric(12,2) not null check (price > 0),
  stock int check (stock >= 0),                      -- null = unlimited
  per_student_limit int check (per_student_limit > 0), -- null = no limit
  -- 'buy': bought straight from the store page. 'auction': sold by the
  -- teacher through a marketplace auction listing instead.
  sale_mode text not null default 'buy' check (sale_mode in ('buy', 'auction')),
  is_active boolean not null default true,
  bond_term_days int check (bond_term_days > 0),
  bond_rate_pct numeric(6,3) check (bond_rate_pct >= 0),
  -- Venture funds: the teacher sets the outcome (0.5 = crash, 2 = growth,
  -- 4 = IPO, ...). Until then 1, so a share is worth its store price.
  venture_multiplier numeric(8,4) not null default 1 check (venture_multiplier >= 0),
  -- Paid to every holder on payday (e.g. rent earned by a property deed).
  weekly_income numeric(12,2) not null default 0 check (weekly_income >= 0),
  created_at timestamptz not null default now(),
  constraint edu_store_items_asset_shape check (
    (category = 'financial') = (asset_kind is not null)
    and (asset_kind is distinct from 'bond' or (bond_term_days is not null and bond_rate_pct is not null))
  )
);
create index edu_store_items_class_idx on public.edu_store_items (class_id);

-- One row per unit owned. Buying three of something creates three rows, so
-- each unit can be listed, sold, redeemed or switched on its own.
create table public.edu_holdings (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  item_id uuid not null references public.edu_store_items(id),
  -- tradeable: may be listed on the marketplace. personal: kept for own use
  -- and redeemable. Students may switch either way while the item is held.
  mode text not null default 'tradeable' check (mode in ('tradeable', 'personal')),
  status text not null default 'held' check (status in ('held', 'listed', 'redeemed', 'closed')),
  price_paid numeric(12,2) not null check (price_paid >= 0),
  acquired_at timestamptz not null default now(),
  matures_at timestamptz,
  redeemed_at timestamptz,
  closed_at timestamptz,
  payout numeric(12,2)
);
create index edu_holdings_student_status_idx on public.edu_holdings (student_id, status);
create index edu_holdings_item_idx on public.edu_holdings (item_id);
create index edu_holdings_maturing_idx on public.edu_holdings (class_id, matures_at)
  where status = 'held' and matures_at is not null;

-- ============================================================
-- Marketplace
-- ============================================================

create table public.edu_listings (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  -- null seller = the class store itself (a teacher auction), which then has
  -- no holding: the winner receives a newly issued unit of item_id.
  seller_id uuid references public.students(id) on delete cascade,
  holding_id uuid references public.edu_holdings(id),
  item_id uuid not null references public.edu_store_items(id),
  sale_type text not null check (sale_type in ('fixed', 'auction')),
  -- Fixed-price listings: the price. Auctions: the starting price.
  price numeric(12,2) not null check (price > 0),
  -- Auctions end once this long passes with no higher bid. Starts at the
  -- first bid and restarts on every new one.
  duration_seconds int not null default 86400 check (duration_seconds between 3600 and 604800),
  status text not null default 'live'
    check (status in ('pending_approval', 'live', 'sold', 'cancelled', 'rejected')),
  ends_at timestamptz,
  -- Denormalised from edu_bids so the whole class can see an auction's
  -- current price without being able to read anyone's bid rows.
  high_bid numeric(12,2),
  high_bidder_id uuid references public.students(id) on delete set null,
  bid_count int not null default 0,
  buyer_id uuid references public.students(id) on delete set null,
  sold_price numeric(12,2),
  created_at timestamptz not null default now(),
  sold_at timestamptz,
  -- Store listings (no seller) are always teacher auctions.
  constraint edu_listings_seller_shape check (
    (seller_id is null) = (holding_id is null)
    and (seller_id is not null or sale_type = 'auction')
  )
);
create index edu_listings_class_status_idx on public.edu_listings (class_id, status);
create index edu_listings_seller_idx on public.edu_listings (seller_id);
create index edu_listings_ending_idx on public.edu_listings (ends_at) where status = 'live' and ends_at is not null;
create unique index edu_listings_one_open_per_holding_idx on public.edu_listings (holding_id)
  where status in ('pending_approval', 'live');

create table public.edu_bids (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  listing_id uuid not null references public.edu_listings(id) on delete cascade,
  bidder_id uuid not null references public.students(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  -- Only the single 'leading' bid on a listing holds money.
  status text not null default 'leading' check (status in ('leading', 'outbid', 'won', 'released')),
  created_at timestamptz not null default now()
);
create index edu_bids_listing_idx on public.edu_bids (listing_id, amount desc);
create index edu_bids_bidder_idx on public.edu_bids (bidder_id, created_at desc);
create unique index edu_bids_one_leader_idx on public.edu_bids (listing_id) where status = 'leading';

-- What drives the red count on the Marketplace nav item and the "Bids"
-- section of the marketplace page.
create table public.edu_market_events (
  id bigint generated always as identity primary key,
  class_id uuid not null references public.classes(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  listing_id uuid references public.edu_listings(id) on delete cascade,
  kind text not null check (kind in (
    'new_bid', 'outbid', 'auction_won', 'item_sold', 'listing_approved', 'listing_rejected'
  )),
  item_name text not null,
  amount numeric(12,2),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index edu_market_events_student_idx on public.edu_market_events (student_id, created_at desc);
create index edu_market_events_unread_idx on public.edu_market_events (student_id) where read_at is null;

-- ============================================================
-- Jobs, charges, paydays
-- ============================================================

create table public.edu_jobs (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 60),
  icon text not null default '💼' check (char_length(icon) between 1 and 16),
  description text not null default '' check (char_length(description) <= 500),
  responsibilities text not null default '' check (char_length(responsibilities) <= 500),
  qualifications text not null default '' check (char_length(qualifications) <= 200),
  next_task text not null default '' check (char_length(next_task) <= 200),
  weekly_salary numeric(12,2) not null check (weekly_salary >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index edu_jobs_class_idx on public.edu_jobs (class_id);

-- A student holds a job from starts_at until ends_at. The teacher can move
-- ends_at later (extend) or earlier (cut short) at any time; ended_at is
-- stamped once the assignment is over.
create table public.edu_job_assignments (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  job_id uuid not null references public.edu_jobs(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create unique index edu_job_assignments_one_per_job_idx on public.edu_job_assignments (job_id) where ended_at is null;
create unique index edu_job_assignments_one_per_student_idx on public.edu_job_assignments (student_id) where ended_at is null;
create index edu_job_assignments_class_idx on public.edu_job_assignments (class_id);

create table public.edu_job_applications (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  job_id uuid not null references public.edu_jobs(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'withdrawn')),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create unique index edu_job_applications_one_pending_idx on public.edu_job_applications (job_id, student_id)
  where status = 'pending';
create index edu_job_applications_student_idx on public.edu_job_applications (student_id);

-- Teacher-defined recurring charges ("Desk rent", or anything else),
-- deducted from every student's cash on payday. The money leaves the
-- economy; it is not paid to anyone.
create table public.edu_charges (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 60),
  amount numeric(12,2) not null check (amount > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index edu_charges_class_idx on public.edu_charges (class_id);

-- One row per class per processed payday: the idempotency key that makes it
-- safe for pg_cron and every student's page load to race on payday.
create table public.edu_paydays (
  class_id uuid not null references public.classes(id) on delete cascade,
  pay_date date not null,
  processed_at timestamptz not null default now(),
  primary key (class_id, pay_date)
);

-- Weekly net worth, taken on payday, for the portfolio growth chart.
create table public.edu_networth_snapshots (
  student_id uuid not null references public.students(id) on delete cascade,
  snapshot_date date not null,
  net_worth numeric(12,2) not null,
  primary key (student_id, snapshot_date)
);

-- ============================================================
-- Badges (placeholders until the real set is designed)
-- ============================================================

create table public.edu_badge_defs (
  key text primary key,
  name text not null,
  description text not null default '',
  reward numeric(12,2) not null default 1 check (reward >= 0),
  sort_order int not null default 0
);

insert into public.edu_badge_defs (key, name, description, reward, sort_order)
select 'badge_' || n, 'Badge ' || n, 'Requirement coming soon.', 1, n
from generate_series(1, 8) as n;

create table public.edu_student_badges (
  student_id uuid not null references public.students(id) on delete cascade,
  badge_key text not null references public.edu_badge_defs(key),
  earned_at timestamptz not null default now(),
  primary key (student_id, badge_key)
);

-- ============================================================
-- Row Level Security (read-only for clients)
-- ============================================================

alter table public.edu_balances enable row level security;
alter table public.edu_ledger enable row level security;
alter table public.edu_store_items enable row level security;
alter table public.edu_holdings enable row level security;
alter table public.edu_listings enable row level security;
alter table public.edu_bids enable row level security;
alter table public.edu_market_events enable row level security;
alter table public.edu_jobs enable row level security;
alter table public.edu_job_assignments enable row level security;
alter table public.edu_job_applications enable row level security;
alter table public.edu_charges enable row level security;
alter table public.edu_paydays enable row level security;
alter table public.edu_networth_snapshots enable row level security;
alter table public.edu_badge_defs enable row level security;
alter table public.edu_student_badges enable row level security;

create policy edu_balances_select on public.edu_balances for select using (
  student_id = auth.uid()
  or public.edu_is_class_educator((select class_id from public.students where id = student_id))
);
create policy edu_ledger_select on public.edu_ledger for select using (
  student_id = auth.uid() or public.edu_is_class_educator(class_id)
);
create policy edu_store_items_select on public.edu_store_items for select using (
  class_id = public.edu_my_class_id() or public.edu_is_class_educator(class_id)
);
-- Classmates' holdings are only visible through edu_student_portfolio, which
-- honours show_holdings.
create policy edu_holdings_select on public.edu_holdings for select using (
  student_id = auth.uid() or public.edu_is_class_educator(class_id)
);
-- Live listings are visible to the whole class; a pending, sold or cancelled
-- one only to the student who listed or bought it.
create policy edu_listings_select on public.edu_listings for select using (
  (class_id = public.edu_my_class_id() and status = 'live')
  or seller_id = auth.uid()
  or buyer_id = auth.uid()
  or public.edu_is_class_educator(class_id)
);
create policy edu_bids_select on public.edu_bids for select using (
  bidder_id = auth.uid()
  or exists (select 1 from public.edu_listings l where l.id = listing_id and l.seller_id = auth.uid())
  or public.edu_is_class_educator(class_id)
);
create policy edu_market_events_select on public.edu_market_events for select using (
  student_id = auth.uid() or public.edu_is_class_educator(class_id)
);
create policy edu_jobs_select on public.edu_jobs for select using (
  class_id = public.edu_my_class_id() or public.edu_is_class_educator(class_id)
);
create policy edu_job_assignments_select on public.edu_job_assignments for select using (
  class_id = public.edu_my_class_id() or public.edu_is_class_educator(class_id)
);
create policy edu_job_applications_select on public.edu_job_applications for select using (
  student_id = auth.uid() or public.edu_is_class_educator(class_id)
);
create policy edu_charges_select on public.edu_charges for select using (
  class_id = public.edu_my_class_id() or public.edu_is_class_educator(class_id)
);
create policy edu_paydays_select on public.edu_paydays for select using (
  class_id = public.edu_my_class_id() or public.edu_is_class_educator(class_id)
);
create policy edu_networth_snapshots_select on public.edu_networth_snapshots for select using (
  student_id = auth.uid()
  or public.edu_is_class_educator((select class_id from public.students where id = student_id))
);
create policy edu_badge_defs_select on public.edu_badge_defs for select using (auth.uid() is not null);
create policy edu_student_badges_select on public.edu_student_badges for select using (
  student_id = auth.uid()
  or public.edu_is_class_educator((select class_id from public.students where id = student_id))
);

-- ============================================================
-- Internal helpers (never granted to clients)
-- ============================================================

-- The single writer of edu_ledger and edu_balances.
create or replace function public.edu_post(
  p_student_id uuid,
  p_account text,
  p_amount numeric,
  p_kind text,
  p_description text
)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_class_id uuid;
begin
  if p_amount is null or p_amount = 0 then
    return;
  end if;

  select class_id into v_class_id from public.students where id = p_student_id;
  if v_class_id is null then
    raise exception 'Student not found.';
  end if;

  insert into public.edu_ledger (class_id, student_id, account, amount, kind, description)
  values (v_class_id, p_student_id, p_account, p_amount, p_kind, left(p_description, 200));

  update public.edu_balances set
    cash = cash + case when p_account = 'cash' then p_amount else 0 end,
    savings = savings + case when p_account = 'savings' then p_amount else 0 end,
    held = held + case when p_account = 'held' then p_amount else 0 end,
    total_interest = total_interest + case when p_kind = 'interest' then p_amount else 0 end,
    updated_at = now()
  where student_id = p_student_id;
end; $$;

-- Validates a client-supplied EduBucks amount: positive, whole cents, sane.
create or replace function public.edu_check_amount(p_amount numeric)
returns numeric language plpgsql immutable set search_path = public as $$
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Enter an amount greater than zero.';
  end if;
  if p_amount <> round(p_amount, 2) then
    raise exception 'Amounts can have at most two decimal places.';
  end if;
  if p_amount > 1000000 then
    raise exception 'That amount is too large.';
  end if;
  return p_amount;
end; $$;

-- The calling student and their class, or an error for anyone else.
create or replace function public.edu_require_student(out o_student_id uuid, out o_class_id uuid)
language plpgsql stable security definer set search_path = public as $$
begin
  select s.id, s.class_id into o_student_id, o_class_id
  from public.students s where s.id = auth.uid();
  if o_student_id is null then
    raise exception 'Only student accounts can do this.' using errcode = '42501';
  end if;
end; $$;

-- Locks the given students' balance rows in a fixed order, so two
-- transactions that each touch the same pair of students (a bid that also
-- releases the previous leader's hold) can never deadlock.
create or replace function public.edu_lock_balances(p_student_ids uuid[])
returns void language sql security definer set search_path = public as $$
  select 1 from public.edu_balances
  where student_id = any(p_student_ids)
  order by student_id
  for update;
$$;

-- Current value of one owned unit.
--   bond      -- principal plus interest accrued so far, linearly over the term
--   venture   -- store price times the teacher-set outcome multiplier
--   otherwise -- the item's current store price
-- Redeemed and closed units are worth nothing: they have been used up or
-- already paid out.
create or replace function public.edu_holding_value(h public.edu_holdings, i public.edu_store_items)
returns numeric language sql stable set search_path = public as $$
  select case
    when h.status in ('redeemed', 'closed') then 0::numeric
    when i.asset_kind = 'bond' then round(
      h.price_paid * (1 + coalesce(i.bond_rate_pct, 0) / 100 * least(1, greatest(0,
        extract(epoch from now() - h.acquired_at)
        / nullif(extract(epoch from h.matures_at - h.acquired_at), 0)
      ))),
      2
    )
    when i.asset_kind = 'venture' then round(i.price * i.venture_multiplier, 2)
    else i.price
  end;
$$;

create or replace function public.edu_net_worth(p_student_id uuid)
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce(b.cash + b.savings + b.held, 0) + coalesce((
    select sum(public.edu_holding_value(h, i))
    from public.edu_holdings h
    join public.edu_store_items i on i.id = h.item_id
    where h.student_id = p_student_id and h.status in ('held', 'listed')
  ), 0)
  from (select p_student_id as id) s
  left join public.edu_balances b on b.student_id = s.id;
$$;

create or replace function public.edu_class_local_date(p_class_id uuid)
returns date language sql stable security definer set search_path = public as $$
  select (now() at time zone coalesce((select timezone from public.classes where id = p_class_id), 'UTC'))::date;
$$;

create or replace function public.edu_add_market_event(
  p_student_id uuid,
  p_listing_id uuid,
  p_kind text,
  p_item_name text,
  p_amount numeric
)
returns void language sql security definer set search_path = public as $$
  insert into public.edu_market_events (class_id, student_id, listing_id, kind, item_name, amount)
  select s.class_id, s.id, p_listing_id, p_kind, p_item_name, p_amount
  from public.students s where s.id = p_student_id;
$$;

-- Closes one auction whose timer has run out. The caller must hold the
-- listing's row lock.
create or replace function public.edu_settle_auction(p_listing_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_listing public.edu_listings;
  v_bid public.edu_bids;
  v_item public.edu_store_items;
  v_holding_id uuid;
begin
  select * into v_listing from public.edu_listings where id = p_listing_id;
  if v_listing.status <> 'live' or v_listing.sale_type <> 'auction'
     or v_listing.ends_at is null or v_listing.ends_at > now() then
    return;
  end if;

  select * into v_bid from public.edu_bids where listing_id = p_listing_id and status = 'leading';
  if v_bid.id is null then
    return;
  end if;

  select * into v_item from public.edu_store_items where id = v_listing.item_id;

  perform public.edu_lock_balances(array_remove(array[v_bid.bidder_id, v_listing.seller_id], null));

  -- The winner's money was already moved into held when they bid.
  perform public.edu_post(v_bid.bidder_id, 'held', -v_bid.amount, 'market_purchase',
    'Won auction: ' || v_item.name);
  if v_listing.seller_id is not null then
    perform public.edu_post(v_listing.seller_id, 'cash', v_bid.amount, 'market_sale',
      'Sold at auction: ' || v_item.name);
  end if;

  if v_listing.holding_id is not null then
    update public.edu_holdings set
      student_id = v_bid.bidder_id,
      status = 'held',
      mode = 'tradeable',
      price_paid = v_bid.amount,
      acquired_at = now()
    where id = v_listing.holding_id;
  else
    -- A teacher auction issues a new unit from the store.
    insert into public.edu_holdings (class_id, student_id, item_id, price_paid, matures_at)
    values (
      v_listing.class_id, v_bid.bidder_id, v_item.id, v_bid.amount,
      case when v_item.asset_kind = 'bond' then now() + make_interval(days => v_item.bond_term_days) end
    )
    returning id into v_holding_id;
    update public.edu_store_items set stock = greatest(stock - 1, 0)
    where id = v_item.id and stock is not null;
  end if;

  update public.edu_bids set status = 'won' where id = v_bid.id;
  update public.edu_listings set
    status = 'sold', buyer_id = v_bid.bidder_id, sold_price = v_bid.amount, sold_at = now()
  where id = p_listing_id;

  perform public.edu_add_market_event(v_bid.bidder_id, p_listing_id, 'auction_won', v_item.name, v_bid.amount);
  if v_listing.seller_id is not null then
    perform public.edu_add_market_event(v_listing.seller_id, p_listing_id, 'item_sold', v_item.name, v_bid.amount);
  end if;
end; $$;

-- Pays one class's payday for p_pay_date exactly once: salaries, item
-- income, savings interest, then charges, then a net worth snapshot.
create or replace function public.edu_run_payday(p_class_id uuid, p_pay_date date)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_rate numeric;
  r record;
  v_interest numeric;
begin
  insert into public.edu_paydays (class_id, pay_date) values (p_class_id, p_pay_date)
  on conflict do nothing;
  if not found then
    return;
  end if;

  select savings_rate_pct into v_rate from public.classes where id = p_class_id;

  -- Lock every balance in the class up front, in id order.
  perform public.edu_lock_balances(array(select id from public.students where class_id = p_class_id));

  for r in
    select a.student_id, j.title, j.weekly_salary
    from public.edu_job_assignments a
    join public.edu_jobs j on j.id = a.job_id
    where a.class_id = p_class_id and a.ended_at is null
      and a.starts_at <= now() and a.ends_at > now() and j.weekly_salary > 0
  loop
    perform public.edu_post(r.student_id, 'cash', r.weekly_salary, 'salary', 'Weekly salary (' || r.title || ')');
  end loop;

  for r in
    select h.student_id, i.name, sum(i.weekly_income) as income
    from public.edu_holdings h
    join public.edu_store_items i on i.id = h.item_id
    where h.class_id = p_class_id and h.status in ('held', 'listed') and i.weekly_income > 0
    group by h.student_id, i.name
  loop
    perform public.edu_post(r.student_id, 'cash', r.income, 'income', 'Weekly income (' || r.name || ')');
  end loop;

  if v_rate > 0 then
    for r in
      select b.student_id, b.savings
      from public.edu_balances b
      join public.students s on s.id = b.student_id
      where s.class_id = p_class_id and b.savings > 0
    loop
      v_interest := round(r.savings * v_rate / 100, 2);
      if v_interest > 0 then
        perform public.edu_post(r.student_id, 'savings', v_interest, 'interest', 'Weekly savings interest');
      end if;
    end loop;
  end if;

  for r in
    select s.id as student_id, c.name, c.amount
    from public.students s
    join public.edu_charges c on c.class_id = s.class_id and c.is_active
    where s.class_id = p_class_id
  loop
    perform public.edu_post(r.student_id, 'cash', -r.amount, 'charge', r.name);
  end loop;

  insert into public.edu_networth_snapshots (student_id, snapshot_date, net_worth)
  select s.id, p_pay_date, public.edu_net_worth(s.id)
  from public.students s where s.class_id = p_class_id
  on conflict (student_id, snapshot_date) do update set net_worth = excluded.net_worth;
end; $$;

-- Brings one class up to date: ended job terms, matured bonds, finished
-- auctions and the most recent payday. Idempotent, and safe to call as often
-- as anyone likes; concurrent callers skip rather than queue, since whoever
-- holds the lock is already doing the same work.
create or replace function public.edu_process_class(p_class_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_class public.classes;
  v_today date;
  v_last_payday date;
  r record;
begin
  if not pg_try_advisory_xact_lock(hashtextextended('edu_process_class:' || p_class_id::text, 0)) then
    return;
  end if;

  select * into v_class from public.classes where id = p_class_id;
  if v_class.id is null then
    return;
  end if;

  update public.edu_job_assignments set ended_at = ends_at
  where class_id = p_class_id and ended_at is null and ends_at <= now();

  for r in
    select h.id, h.student_id, h.price_paid, i.name, i.bond_rate_pct
    from public.edu_holdings h
    join public.edu_store_items i on i.id = h.item_id
    where h.class_id = p_class_id and h.status = 'held'
      and i.asset_kind = 'bond' and h.matures_at <= now()
    for update of h
  loop
    perform public.edu_lock_balances(array[r.student_id]);
    update public.edu_holdings set
      status = 'closed', closed_at = now(),
      payout = round(r.price_paid * (1 + r.bond_rate_pct / 100), 2)
    where id = r.id;
    perform public.edu_post(r.student_id, 'cash', round(r.price_paid * (1 + r.bond_rate_pct / 100), 2),
      'bond_payout', 'Bond matured: ' || r.name);
  end loop;

  for r in
    select id from public.edu_listings
    where class_id = p_class_id and status = 'live' and sale_type = 'auction' and ends_at <= now()
    for update skip locked
  loop
    perform public.edu_settle_auction(r.id);
  end loop;

  -- The most recent payday on or before today in the class's timezone. Only
  -- the latest one is ever caught up, so a class nobody opened for weeks
  -- without pg_cron gets one payday rather than a burst of them.
  v_today := public.edu_class_local_date(p_class_id);
  v_last_payday := v_today - ((extract(dow from v_today)::int - v_class.payday_dow + 7) % 7);
  if v_last_payday >= (v_class.created_at at time zone v_class.timezone)::date then
    perform public.edu_run_payday(p_class_id, v_last_payday);
  end if;
end; $$;

create or replace function public.edu_run_scheduled()
returns void language plpgsql security definer set search_path = public as $$
declare
  r record;
begin
  for r in select id from public.classes loop
    perform public.edu_process_class(r.id);
  end loop;
end; $$;

revoke execute on function public.edu_create_balance_row() from public, anon, authenticated;
revoke execute on function public.edu_post(uuid, text, numeric, text, text) from public, anon, authenticated;
revoke execute on function public.edu_check_amount(numeric) from public, anon, authenticated;
revoke execute on function public.edu_require_student() from public, anon, authenticated;
revoke execute on function public.edu_lock_balances(uuid[]) from public, anon, authenticated;
revoke execute on function public.edu_holding_value(public.edu_holdings, public.edu_store_items) from public, anon, authenticated;
revoke execute on function public.edu_net_worth(uuid) from public, anon, authenticated;
revoke execute on function public.edu_class_local_date(uuid) from public, anon, authenticated;
revoke execute on function public.edu_add_market_event(uuid, uuid, text, text, numeric) from public, anon, authenticated;
revoke execute on function public.edu_settle_auction(uuid) from public, anon, authenticated;
revoke execute on function public.edu_run_payday(uuid, date) from public, anon, authenticated;
revoke execute on function public.edu_process_class(uuid) from public, anon, authenticated;
revoke execute on function public.edu_run_scheduled() from public, anon, authenticated;

-- ============================================================
-- Student-facing functions
-- ============================================================

-- Called whenever the student portal opens a page: brings the class up to
-- date and counts today toward the login streak (class-local calendar day,
-- server clock -- nothing client-supplied).
create or replace function public.edu_refresh()
returns void language plpgsql security definer set search_path = public as $$
declare
  v_me uuid;
  v_class uuid;
  v_today date;
  v_last date;
begin
  select o_student_id, o_class_id into v_me, v_class from public.edu_require_student();
  perform public.edu_process_class(v_class);

  v_today := public.edu_class_local_date(v_class);
  select last_login_date into v_last from public.students where id = v_me for update;
  if v_last is distinct from v_today then
    update public.students set
      streak_count = case when v_last = v_today - 1 then streak_count + 1 else 1 end,
      last_login_date = v_today
    where id = v_me;
  end if;
end; $$;

-- Everything the portal header, sidebar and dashboard need in one call.
create or replace function public.edu_my_summary()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_me uuid;
  v_class uuid;
  v_result jsonb;
begin
  select o_student_id, o_class_id into v_me, v_class from public.edu_require_student();

  with ranked as (
    select s.id, row_number() over (order by public.edu_net_worth(s.id) desc, p.display_name, s.id) as rank
    from public.students s join public.profiles p on p.id = s.id
    where s.class_id = v_class
  )
  select jsonb_build_object(
    'studentId', s.id,
    'username', s.username,
    'displayName', p.display_name,
    'studentNumber', s.student_number,
    'avatarEmoji', s.avatar_emoji,
    'quote', s.quote,
    'savingsGoalName', s.savings_goal_name,
    'savingsGoalAmount', s.savings_goal_amount,
    'showHoldings', s.show_holdings,
    'pinnedBadges', to_jsonb(s.pinned_badges),
    'streakCount', s.streak_count,
    'classId', c.id,
    'className', c.name,
    'classCode', c.code,
    'schoolName', sc.name,
    'teacherName', tp.display_name,
    'savingsRatePct', c.savings_rate_pct,
    'paydayDow', c.payday_dow,
    'today', public.edu_class_local_date(c.id),
    'cash', b.cash,
    'savings', b.savings,
    'held', b.held,
    'totalInterest', b.total_interest,
    'netWorth', public.edu_net_worth(s.id),
    'rank', (select rank from ranked where id = s.id),
    'classSize', (select count(*) from ranked),
    'unreadMarketEvents', (
      select count(*) from public.edu_market_events e where e.student_id = s.id and e.read_at is null
    ),
    'badgesEarned', (select count(*) from public.edu_student_badges sb where sb.student_id = s.id),
    'badgesTotal', (select count(*) from public.edu_badge_defs)
  )
  into v_result
  from public.students s
  join public.profiles p on p.id = s.id
  join public.classes c on c.id = s.class_id
  join public.schools sc on sc.id = c.school_id
  left join public.profiles tp on tp.id = c.educator_id
  left join public.edu_balances b on b.student_id = s.id
  where s.id = v_me;

  return v_result;
end; $$;

create or replace function public.edu_transfer(p_direction text, p_amount numeric)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_me uuid;
  v_class uuid;
  v_amount numeric := public.edu_check_amount(p_amount);
  v_bal public.edu_balances;
begin
  select o_student_id, o_class_id into v_me, v_class from public.edu_require_student();
  select * into v_bal from public.edu_balances where student_id = v_me for update;

  if p_direction = 'deposit' then
    if v_bal.cash < v_amount then
      raise exception 'You only have % EduBucks of spending cash.', to_char(greatest(v_bal.cash, 0), 'FM999999990.00');
    end if;
    perform public.edu_post(v_me, 'cash', -v_amount, 'transfer', 'Deposit to bank');
    perform public.edu_post(v_me, 'savings', v_amount, 'transfer', 'Deposit to bank');
  elsif p_direction = 'withdraw' then
    if v_bal.savings < v_amount then
      raise exception 'You only have % EduBucks in the bank.', to_char(v_bal.savings, 'FM999999990.00');
    end if;
    perform public.edu_post(v_me, 'savings', -v_amount, 'transfer', 'Withdraw to cash');
    perform public.edu_post(v_me, 'cash', v_amount, 'transfer', 'Withdraw to cash');
  else
    raise exception 'Unknown transfer direction.';
  end if;
end; $$;

create or replace function public.edu_buy_store_item(p_item_id uuid, p_quantity int, p_mode text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_me uuid;
  v_class uuid;
  v_item public.edu_store_items;
  v_owned int;
  v_total numeric;
  v_cash numeric;
  v_mode text;
begin
  select o_student_id, o_class_id into v_me, v_class from public.edu_require_student();

  if p_quantity is null or p_quantity < 1 or p_quantity > 50 then
    raise exception 'Choose a quantity between 1 and 50.';
  end if;

  select * into v_item from public.edu_store_items where id = p_item_id for update;
  if v_item.id is null or v_item.class_id <> v_class or not v_item.is_active then
    raise exception 'That item is not available.';
  end if;
  if v_item.sale_mode <> 'buy' then
    raise exception 'That item is sold by auction in the marketplace.';
  end if;
  if v_item.stock is not null and v_item.stock < p_quantity then
    raise exception 'Only % left in stock.', v_item.stock;
  end if;

  if v_item.per_student_limit is not null then
    select count(*) into v_owned from public.edu_holdings
    where student_id = v_me and item_id = v_item.id and status in ('held', 'listed');
    if v_owned + p_quantity > v_item.per_student_limit then
      raise exception 'You can only own % of this item at a time.', v_item.per_student_limit;
    end if;
  end if;

  -- Financial assets are always tradeable; the personal-use choice applies
  -- to privileges and physical goods only.
  v_mode := case when v_item.category = 'financial' then 'tradeable' else coalesce(p_mode, 'tradeable') end;
  if v_mode not in ('tradeable', 'personal') then
    raise exception 'Unknown resale option.';
  end if;

  v_total := v_item.price * p_quantity;
  select cash into v_cash from public.edu_balances where student_id = v_me for update;
  if v_cash < v_total then
    raise exception 'Not enough spending cash. This costs % EduBucks.', to_char(v_total, 'FM999999990.00');
  end if;

  perform public.edu_post(v_me, 'cash', -v_total, 'store_purchase',
    'Class store: ' || v_item.name || case when p_quantity > 1 then ' ×' || p_quantity else '' end);

  insert into public.edu_holdings (class_id, student_id, item_id, mode, price_paid, matures_at)
  select v_class, v_me, v_item.id, v_mode, v_item.price,
    case when v_item.asset_kind = 'bond' then now() + make_interval(days => v_item.bond_term_days) end
  from generate_series(1, p_quantity);

  if v_item.stock is not null then
    update public.edu_store_items set stock = stock - p_quantity where id = v_item.id;
  end if;
end; $$;

create or replace function public.edu_set_holding_mode(p_holding_id uuid, p_mode text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_me uuid;
  v_class uuid;
  v_holding public.edu_holdings;
  v_category text;
begin
  select o_student_id, o_class_id into v_me, v_class from public.edu_require_student();
  if p_mode not in ('tradeable', 'personal') then
    raise exception 'Unknown option.';
  end if;

  select * into v_holding from public.edu_holdings where id = p_holding_id for update;
  if v_holding.id is null or v_holding.student_id <> v_me then
    raise exception 'That item is not yours.';
  end if;
  if v_holding.status = 'listed' then
    raise exception 'Take this item off the marketplace first.';
  end if;
  if v_holding.status <> 'held' then
    raise exception 'That item has already been used.';
  end if;
  select category into v_category from public.edu_store_items where id = v_holding.item_id;
  if v_category = 'financial' then
    raise exception 'Financial assets are always tradeable.';
  end if;

  update public.edu_holdings set mode = p_mode where id = p_holding_id;
end; $$;

create or replace function public.edu_redeem_holding(p_holding_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_me uuid;
  v_class uuid;
  v_holding public.edu_holdings;
  v_category text;
begin
  select o_student_id, o_class_id into v_me, v_class from public.edu_require_student();

  select * into v_holding from public.edu_holdings where id = p_holding_id for update;
  if v_holding.id is null or v_holding.student_id <> v_me then
    raise exception 'That item is not yours.';
  end if;
  select category into v_category from public.edu_store_items where id = v_holding.item_id;
  if v_category = 'financial' then
    raise exception 'Financial assets cannot be redeemed.';
  end if;
  if v_holding.status <> 'held' or v_holding.mode <> 'personal' then
    raise exception 'Only personal-use items you are holding can be redeemed.';
  end if;

  update public.edu_holdings set status = 'redeemed', redeemed_at = now() where id = p_holding_id;
end; $$;

-- Lists an owned, tradeable item. Whether it goes live immediately is
-- decided here, not by the client: an item the class store is currently
-- selling is a "commodity" and goes live; anything else (sold out, retired,
-- auction-only) is a new item and waits for the teacher's approval, visible
-- only to the seller until then.
create or replace function public.edu_create_listing(
  p_holding_id uuid,
  p_sale_type text,
  p_price numeric,
  p_duration_hours int default 24
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_me uuid;
  v_class uuid;
  v_price numeric := public.edu_check_amount(p_price);
  v_holding public.edu_holdings;
  v_item public.edu_store_items;
  v_is_commodity boolean;
  v_listing_id uuid;
begin
  select o_student_id, o_class_id into v_me, v_class from public.edu_require_student();

  if p_sale_type not in ('fixed', 'auction') then
    raise exception 'Choose Buy now or Auction.';
  end if;
  if p_sale_type = 'auction' and (p_duration_hours is null or p_duration_hours < 1 or p_duration_hours > 168) then
    raise exception 'Auction timers can be between 1 hour and 7 days.';
  end if;

  select * into v_holding from public.edu_holdings where id = p_holding_id for update;
  if v_holding.id is null or v_holding.student_id <> v_me then
    raise exception 'You can only sell items you own.';
  end if;
  if v_holding.status <> 'held' then
    raise exception 'That item is already listed or used.';
  end if;
  if v_holding.mode <> 'tradeable' then
    raise exception 'Switch this item to tradeable before listing it.';
  end if;

  select * into v_item from public.edu_store_items where id = v_holding.item_id;
  if v_item.asset_kind = 'bond' then
    raise exception 'Bonds are locked in the vault until they mature.';
  end if;

  v_is_commodity := v_item.is_active and v_item.sale_mode = 'buy'
    and (v_item.stock is null or v_item.stock > 0);

  insert into public.edu_listings (class_id, seller_id, holding_id, item_id, sale_type, price, duration_seconds, status)
  values (
    v_class, v_me, v_holding.id, v_item.id, p_sale_type, v_price,
    coalesce(p_duration_hours, 24) * 3600,
    case when v_is_commodity then 'live' else 'pending_approval' end
  )
  returning id into v_listing_id;

  update public.edu_holdings set status = 'listed' where id = v_holding.id;
  return v_listing_id;
end; $$;

create or replace function public.edu_update_listing_price(p_listing_id uuid, p_price numeric)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_me uuid;
  v_class uuid;
  v_price numeric := public.edu_check_amount(p_price);
  v_listing public.edu_listings;
begin
  select o_student_id, o_class_id into v_me, v_class from public.edu_require_student();

  select * into v_listing from public.edu_listings where id = p_listing_id for update;
  if v_listing.id is null or v_listing.seller_id is distinct from v_me then
    raise exception 'That listing is not yours.';
  end if;
  if v_listing.status not in ('live', 'pending_approval') then
    raise exception 'That listing is closed.';
  end if;
  if v_listing.sale_type = 'auction'
     and exists (select 1 from public.edu_bids where listing_id = p_listing_id) then
    raise exception 'You cannot change the starting price once someone has bid.';
  end if;

  update public.edu_listings set price = v_price where id = p_listing_id;
end; $$;

create or replace function public.edu_cancel_listing(p_listing_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_me uuid;
  v_class uuid;
  v_listing public.edu_listings;
begin
  select o_student_id, o_class_id into v_me, v_class from public.edu_require_student();

  select * into v_listing from public.edu_listings where id = p_listing_id for update;
  if v_listing.id is null or v_listing.seller_id is distinct from v_me then
    raise exception 'That listing is not yours.';
  end if;
  if v_listing.status not in ('live', 'pending_approval') then
    raise exception 'That listing is already closed.';
  end if;
  if exists (select 1 from public.edu_bids where listing_id = p_listing_id) then
    raise exception 'This auction already has bids, so it has to run until the timer ends.';
  end if;

  update public.edu_listings set status = 'cancelled' where id = p_listing_id;
  update public.edu_holdings set status = 'held' where id = v_listing.holding_id;
end; $$;

create or replace function public.edu_buy_listing(p_listing_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_me uuid;
  v_class uuid;
  v_listing public.edu_listings;
  v_item_name text;
  v_cash numeric;
begin
  select o_student_id, o_class_id into v_me, v_class from public.edu_require_student();

  select * into v_listing from public.edu_listings where id = p_listing_id for update;
  if v_listing.id is null or v_listing.class_id <> v_class or v_listing.status <> 'live' then
    raise exception 'That item is no longer for sale.';
  end if;
  if v_listing.sale_type <> 'fixed' then
    raise exception 'That item is an auction. Place a bid instead.';
  end if;
  if v_listing.seller_id = v_me then
    raise exception 'You cannot buy your own item.';
  end if;

  perform public.edu_lock_balances(array[v_me, v_listing.seller_id]);
  select cash into v_cash from public.edu_balances where student_id = v_me;
  if v_cash < v_listing.price then
    raise exception 'Not enough spending cash. This costs % EduBucks.', to_char(v_listing.price, 'FM999999990.00');
  end if;

  select name into v_item_name from public.edu_store_items where id = v_listing.item_id;

  perform public.edu_post(v_me, 'cash', -v_listing.price, 'market_purchase', 'Bought: ' || v_item_name);
  perform public.edu_post(v_listing.seller_id, 'cash', v_listing.price, 'market_sale', 'Sold: ' || v_item_name);

  update public.edu_holdings set
    student_id = v_me, status = 'held', mode = 'tradeable',
    price_paid = v_listing.price, acquired_at = now()
  where id = v_listing.holding_id;

  update public.edu_listings set
    status = 'sold', buyer_id = v_me, sold_price = v_listing.price, sold_at = now()
  where id = p_listing_id;

  perform public.edu_add_market_event(v_listing.seller_id, p_listing_id, 'item_sold', v_item_name, v_listing.price);
end; $$;

-- Places a bid. The bid amount moves from the bidder's cash into held; the
-- bid it beats (if any) is released back to that bidder's cash. Every bid
-- restarts the listing's timer.
create or replace function public.edu_place_bid(p_listing_id uuid, p_amount numeric)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_me uuid;
  v_class uuid;
  v_amount numeric := public.edu_check_amount(p_amount);
  v_listing public.edu_listings;
  v_leader public.edu_bids;
  v_item_name text;
  v_available numeric;
begin
  select o_student_id, o_class_id into v_me, v_class from public.edu_require_student();

  select * into v_listing from public.edu_listings where id = p_listing_id for update;
  if v_listing.id is null or v_listing.class_id <> v_class or v_listing.status <> 'live' then
    raise exception 'That auction is no longer running.';
  end if;
  if v_listing.sale_type <> 'auction' then
    raise exception 'That item has a fixed price. Buy it instead.';
  end if;
  if v_listing.seller_id = v_me then
    raise exception 'You cannot bid on your own item.';
  end if;
  if v_listing.ends_at is not null and v_listing.ends_at <= now() then
    perform public.edu_settle_auction(p_listing_id);
    raise exception 'That auction has just ended.';
  end if;

  select * into v_leader from public.edu_bids where listing_id = p_listing_id and status = 'leading';

  if v_leader.id is null then
    if v_amount < v_listing.price then
      raise exception 'The starting price is % EduBucks.', to_char(v_listing.price, 'FM999999990.00');
    end if;
  elsif v_amount <= v_leader.amount then
    raise exception 'Bid more than the current highest bid of % EduBucks.', to_char(v_leader.amount, 'FM999999990.00');
  end if;

  select name into v_item_name from public.edu_store_items where id = v_listing.item_id;
  perform public.edu_lock_balances(array_remove(array[v_me, v_leader.bidder_id], null));

  -- Raising your own leading bid only needs the difference.
  select cash + case when v_leader.bidder_id = v_me then v_leader.amount else 0 end
  into v_available from public.edu_balances where student_id = v_me;
  if v_available < v_amount then
    raise exception 'Not enough spending cash for that bid.';
  end if;

  if v_leader.id is not null then
    perform public.edu_post(v_leader.bidder_id, 'held', -v_leader.amount, 'bid_release', 'Bid released: ' || v_item_name);
    perform public.edu_post(v_leader.bidder_id, 'cash', v_leader.amount, 'bid_release', 'Bid released: ' || v_item_name);
    update public.edu_bids set status = case when bidder_id = v_me then 'released' else 'outbid' end
    where id = v_leader.id;
    if v_leader.bidder_id <> v_me then
      perform public.edu_add_market_event(v_leader.bidder_id, p_listing_id, 'outbid', v_item_name, v_amount);
    end if;
  end if;

  perform public.edu_post(v_me, 'cash', -v_amount, 'bid_hold', 'Bid placed: ' || v_item_name);
  perform public.edu_post(v_me, 'held', v_amount, 'bid_hold', 'Bid placed: ' || v_item_name);
  insert into public.edu_bids (class_id, listing_id, bidder_id, amount)
  values (v_class, p_listing_id, v_me, v_amount);

  update public.edu_listings set
    ends_at = now() + make_interval(secs => duration_seconds),
    high_bid = v_amount,
    high_bidder_id = v_me,
    bid_count = bid_count + 1
  where id = p_listing_id;

  if v_listing.seller_id is not null then
    perform public.edu_add_market_event(v_listing.seller_id, p_listing_id, 'new_bid', v_item_name, v_amount);
  end if;
end; $$;

create or replace function public.edu_mark_market_events_read()
returns void language plpgsql security definer set search_path = public as $$
declare
  v_me uuid;
  v_class uuid;
begin
  select o_student_id, o_class_id into v_me, v_class from public.edu_require_student();
  update public.edu_market_events set read_at = now() where student_id = v_me and read_at is null;
end; $$;

create or replace function public.edu_apply_for_job(p_job_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_me uuid;
  v_class uuid;
  v_job public.edu_jobs;
begin
  select o_student_id, o_class_id into v_me, v_class from public.edu_require_student();

  select * into v_job from public.edu_jobs where id = p_job_id;
  if v_job.id is null or v_job.class_id <> v_class or not v_job.is_active then
    raise exception 'That job is not available.';
  end if;
  if exists (
    select 1 from public.edu_job_assignments
    where job_id = p_job_id and ended_at is null and ends_at > now()
  ) then
    raise exception 'That position is already filled.';
  end if;
  if exists (
    select 1 from public.edu_job_applications
    where job_id = p_job_id and student_id = v_me and status = 'pending'
  ) then
    raise exception 'You have already applied for this job.';
  end if;

  insert into public.edu_job_applications (class_id, job_id, student_id)
  values (v_class, p_job_id, v_me);
end; $$;

create or replace function public.edu_withdraw_job_application(p_application_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_me uuid;
  v_class uuid;
begin
  select o_student_id, o_class_id into v_me, v_class from public.edu_require_student();
  update public.edu_job_applications set status = 'withdrawn', decided_at = now()
  where id = p_application_id and student_id = v_me and status = 'pending';
  if not found then
    raise exception 'That application can no longer be withdrawn.';
  end if;
end; $$;

create or replace function public.edu_update_my_profile(
  p_display_name text,
  p_avatar_emoji text,
  p_quote text,
  p_savings_goal_name text,
  p_savings_goal_amount numeric,
  p_show_holdings boolean,
  p_pinned_badges text[]
)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_me uuid;
  v_class uuid;
  v_name text := trim(coalesce(p_display_name, ''));
  v_pinned text[] := coalesce(p_pinned_badges, '{}');
begin
  select o_student_id, o_class_id into v_me, v_class from public.edu_require_student();

  if char_length(v_name) < 1 or char_length(v_name) > 40 then
    raise exception 'Display name must be between 1 and 40 characters.';
  end if;
  if p_savings_goal_amount is not null then
    perform public.edu_check_amount(p_savings_goal_amount);
  end if;
  if exists (
    select 1 from unnest(v_pinned) k
    where not exists (select 1 from public.edu_student_badges b where b.student_id = v_me and b.badge_key = k)
  ) then
    raise exception 'You can only pin badges you have earned.';
  end if;

  update public.profiles set display_name = v_name where id = v_me;
  update public.students set
    avatar_emoji = coalesce(nullif(trim(p_avatar_emoji), ''), avatar_emoji),
    quote = trim(coalesce(p_quote, '')),
    savings_goal_name = trim(coalesce(p_savings_goal_name, '')),
    savings_goal_amount = p_savings_goal_amount,
    show_holdings = coalesce(p_show_holdings, true),
    pinned_badges = v_pinned
  where id = v_me;
end; $$;

-- Names and avatars of everyone in the caller's class (seller names on the
-- marketplace). profiles RLS only exposes a user's own row.
create or replace function public.edu_classmates()
returns table (student_id uuid, display_name text, avatar_emoji text)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_me uuid;
  v_class uuid;
begin
  select o_student_id, o_class_id into v_me, v_class from public.edu_require_student();
  return query
  select s.id, p.display_name, s.avatar_emoji
  from public.students s join public.profiles p on p.id = s.id
  where s.class_id = v_class
  order by p.display_name;
end; $$;

-- The class grid. Visible to classmates only; item names are included only
-- for students who chose to show their holdings.
create or replace function public.edu_class_leaderboard()
returns table (
  student_id uuid,
  rank bigint,
  display_name text,
  avatar_emoji text,
  quote text,
  job_title text,
  net_worth numeric,
  holdings_summary text,
  is_me boolean
)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_me uuid;
  v_class uuid;
begin
  select o_student_id, o_class_id into v_me, v_class from public.edu_require_student();

  return query
  with worth as (
    select s.id, public.edu_net_worth(s.id) as nw from public.students s where s.class_id = v_class
  )
  select
    s.id,
    row_number() over (order by w.nw desc, p.display_name, s.id),
    p.display_name,
    s.avatar_emoji,
    s.quote,
    (select j.title from public.edu_job_assignments a join public.edu_jobs j on j.id = a.job_id
     where a.student_id = s.id and a.ended_at is null and a.ends_at > now() limit 1),
    w.nw,
    case when s.show_holdings then (
      select string_agg(t.cnt || ' × ' || t.name, ', ' order by t.cnt desc, t.name)
      from (
        select i.name, count(*) as cnt
        from public.edu_holdings h join public.edu_store_items i on i.id = h.item_id
        where h.student_id = s.id and h.status in ('held', 'listed')
        group by i.name
      ) t
    ) end,
    s.id = v_me
  from public.students s
  join public.profiles p on p.id = s.id
  join worth w on w.id = s.id
  order by 2;
end; $$;

-- One classmate's (or your own) full portfolio for the inspector page.
create or replace function public.edu_student_portfolio(p_student_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_me uuid;
  v_class uuid;
  v_show boolean;
  v_result jsonb;
begin
  select o_student_id, o_class_id into v_me, v_class from public.edu_require_student();

  select s.show_holdings or s.id = v_me into v_show
  from public.students s where s.id = p_student_id and s.class_id = v_class;
  if v_show is null then
    raise exception 'That student is not in your class.';
  end if;

  select jsonb_build_object(
    'studentId', s.id,
    'displayName', p.display_name,
    'avatarEmoji', s.avatar_emoji,
    'quote', s.quote,
    'isMe', s.id = v_me,
    'showHoldings', v_show,
    'netWorth', public.edu_net_worth(s.id),
    'cash', b.cash,
    'savings', b.savings,
    'weeklyInterest', round(b.savings * c.savings_rate_pct / 100, 2),
    'rank', (
      select r.rk from (
        select s2.id, row_number() over (
          order by public.edu_net_worth(s2.id) desc, p2.display_name, s2.id
        ) as rk
        from public.students s2 join public.profiles p2 on p2.id = s2.id
        where s2.class_id = v_class
      ) r where r.id = s.id
    ),
    'job', (
      select jsonb_build_object('title', j.title, 'icon', j.icon, 'weeklySalary', j.weekly_salary)
      from public.edu_job_assignments a join public.edu_jobs j on j.id = a.job_id
      where a.student_id = s.id and a.ended_at is null and a.ends_at > now() limit 1
    ),
    'assets', case when v_show then coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', t.name, 'category', t.category, 'assetKind', t.asset_kind,
        'quantity', t.qty, 'value', t.value, 'weeklyIncome', t.income
      ) order by t.value desc)
      from (
        select i.name, i.category, i.asset_kind, count(*) as qty,
          sum(public.edu_holding_value(h, i)) as value,
          sum(i.weekly_income) as income
        from public.edu_holdings h join public.edu_store_items i on i.id = h.item_id
        where h.student_id = s.id and h.status in ('held', 'listed')
        group by i.name, i.category, i.asset_kind
      ) t
    ), '[]'::jsonb) end,
    'history', coalesce((
      select jsonb_agg(jsonb_build_object('date', x.snapshot_date, 'netWorth', x.net_worth) order by x.snapshot_date)
      from (
        select snapshot_date, net_worth from public.edu_networth_snapshots
        where student_id = s.id order by snapshot_date desc limit 5
      ) x
    ), '[]'::jsonb),
    'badges', coalesce((
      select jsonb_agg(jsonb_build_object('key', d.key, 'name', d.name) order by array_position(s.pinned_badges, d.key))
      from public.edu_badge_defs d where d.key = any(s.pinned_badges)
    ), '[]'::jsonb)
  )
  into v_result
  from public.students s
  join public.profiles p on p.id = s.id
  join public.classes c on c.id = s.class_id
  left join public.edu_balances b on b.student_id = s.id
  where s.id = p_student_id;

  return v_result;
end; $$;

revoke execute on function public.edu_refresh() from public, anon;
revoke execute on function public.edu_my_summary() from public, anon;
revoke execute on function public.edu_transfer(text, numeric) from public, anon;
revoke execute on function public.edu_buy_store_item(uuid, int, text) from public, anon;
revoke execute on function public.edu_set_holding_mode(uuid, text) from public, anon;
revoke execute on function public.edu_redeem_holding(uuid) from public, anon;
revoke execute on function public.edu_create_listing(uuid, text, numeric, int) from public, anon;
revoke execute on function public.edu_update_listing_price(uuid, numeric) from public, anon;
revoke execute on function public.edu_cancel_listing(uuid) from public, anon;
revoke execute on function public.edu_buy_listing(uuid) from public, anon;
revoke execute on function public.edu_place_bid(uuid, numeric) from public, anon;
revoke execute on function public.edu_mark_market_events_read() from public, anon;
revoke execute on function public.edu_apply_for_job(uuid) from public, anon;
revoke execute on function public.edu_withdraw_job_application(uuid) from public, anon;
revoke execute on function public.edu_update_my_profile(text, text, text, text, numeric, boolean, text[]) from public, anon;
revoke execute on function public.edu_classmates() from public, anon;
revoke execute on function public.edu_class_leaderboard() from public, anon;
revoke execute on function public.edu_student_portfolio(uuid) from public, anon;

grant execute on function public.edu_refresh() to authenticated;
grant execute on function public.edu_my_summary() to authenticated;
grant execute on function public.edu_transfer(text, numeric) to authenticated;
grant execute on function public.edu_buy_store_item(uuid, int, text) to authenticated;
grant execute on function public.edu_set_holding_mode(uuid, text) to authenticated;
grant execute on function public.edu_redeem_holding(uuid) to authenticated;
grant execute on function public.edu_create_listing(uuid, text, numeric, int) to authenticated;
grant execute on function public.edu_update_listing_price(uuid, numeric) to authenticated;
grant execute on function public.edu_cancel_listing(uuid) to authenticated;
grant execute on function public.edu_buy_listing(uuid) to authenticated;
grant execute on function public.edu_place_bid(uuid, numeric) to authenticated;
grant execute on function public.edu_mark_market_events_read() to authenticated;
grant execute on function public.edu_apply_for_job(uuid) to authenticated;
grant execute on function public.edu_withdraw_job_application(uuid) to authenticated;
grant execute on function public.edu_update_my_profile(text, text, text, text, numeric, boolean, text[]) to authenticated;
grant execute on function public.edu_classmates() to authenticated;
grant execute on function public.edu_class_leaderboard() to authenticated;
grant execute on function public.edu_student_portfolio(uuid) to authenticated;
