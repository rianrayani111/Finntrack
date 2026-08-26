-- sync_badges() derived a badge's XP purely from the TIER PREFIX of the key it
-- was handed ('legendary__' -> 2000 XP), and inserted whatever key it was
-- given. The comment in 0005 claimed "a badge key it doesn't recognize (or a
-- tampered call) grants nothing", but that was only true of keys whose prefix
-- wasn't a known tier. Any invented key with a real prefix -- e.g.
-- 'legendary__made_this_up' -- passed the check, granted its tier's XP, and
-- landed a row in user_badges. Since badge eligibility is computed client-side,
-- a child with devtools could call the RPC directly and mint unlimited XP, and
-- the forged rows also counted toward the client's "Collector: earn 50 badges"
-- and "earn every badge in tier X" meta-badges.
--
-- The catalogue is small, fixed, and already duplicated across the trust
-- boundary (the client decides WHICH badges are earned; the server decides what
-- each is WORTH). Pinning the valid key set here closes the hole without moving
-- eligibility server-side: an unknown key is now silently ignored, exactly as
-- the original comment promised.
--
-- Keys must stay in sync with BADGES in src/lib/gamification.js. A badge added
-- there but missing here simply never awards XP, which is the safe direction to
-- fail.

create table public.badge_catalogue (
  badge_key text primary key,
  tier text not null check (tier in ('starter','common','regular','uncommon','rare','epic','legendary'))
);

-- No RLS policies and no grants: readable only by the SECURITY DEFINER function
-- below, which runs as the table's owner. The client already has the catalogue
-- compiled into its bundle, so there is nothing here it needs to query.
alter table public.badge_catalogue enable row level security;

insert into public.badge_catalogue (badge_key, tier)
select k, split_part(k, '__', 1)
from unnest(array[
  'starter__first_entry',
  'starter__ledger_opened',
  'starter__four_corners',
  'starter__summary_reader',
  'starter__same_day',
  'starter__note_taker',
  'starter__where_i_was',
  'starter__reason_given',
  'starter__first_deposit_seen',
  'starter__curious',
  'starter__two_days',
  'starter__named_it',
  'common__three_in_a_row',
  'common__necessity_knower',
  'common__want_spotter',
  'common__asset_builder',
  'common__liability_learner',
  'common__detailed',
  'common__looked_back',
  'common__first_ten_tracked',
  'common__ten_entries',
  'common__weekend_logger',
  'common__morning_person',
  'common__evening_review',
  'common__small_spender',
  'common__rounded_up',
  'common__back_again',
  'common__categories_complete',
  'regular__week_watcher',
  'regular__full_month',
  'regular__sorted',
  'regular__quick_logger',
  'regular__nothing_spent',
  'regular__kept_it',
  'regular__balanced_books',
  'regular__fifty_tracked',
  'regular__balance_sheet_basics',
  'regular__twenty_five',
  'regular__two_weeks_running',
  'regular__location_logger',
  'regular__honest_ledger',
  'regular__month_complete',
  'regular__needs_first',
  'regular__savers_start',
  'uncommon__fortnight',
  'uncommon__comeback',
  'uncommon__patient',
  'uncommon__precise',
  'uncommon__pattern_finder',
  'uncommon__half_kept',
  'uncommon__hundred_tracked',
  'uncommon__knows_the_difference',
  'uncommon__fifty_entries',
  'uncommon__three_months',
  'uncommon__steady_hand',
  'uncommon__asset_minded',
  'uncommon__debt_aware',
  'uncommon__quiet_month',
  'rare__month_of_mondays',
  'rare__never_missed',
  'rare__master_sorter',
  'rare__growing',
  'rare__five_hundred_tracked',
  'rare__hundred_entries',
  'rare__six_months',
  'rare__full_picture',
  'rare__saver',
  'rare__two_month_streak',
  'rare__category_master',
  'rare__reflective',
  'epic__century',
  'epic__year_in_review',
  'epic__graduate',
  'epic__hundred_days',
  'epic__thousand_tracked',
  'epic__consistent',
  'epic__half_year_saver',
  'epic__complete_ledger',
  'epic__the_long_view',
  'epic__money_mind',
  'legendary__perfect_year',
  'legendary__collector',
  'legendary__grandmaster',
  'legendary__finntrack_legend'
]::text[]) as k;

-- Only a child account can earn badges. A parent calling this previously
-- awarded themselves XP against their own profile row (harmless, but it
-- polluted user_badges with rows whose child_id is a parent).
create or replace function public.sync_badges(p_badge_keys text[])
returns table(total_xp int, newly_earned text[])
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_key text;
  v_tier text;
  v_xp int;
  v_gained int := 0;
  v_new text[] := '{}';
begin
  select p.role into v_role from public.profiles p where p.id = v_uid;
  if v_role is distinct from 'child' then
    raise exception 'Only a child account can earn badges.';
  end if;

  -- distinct: a caller repeating the same key in one array must not be able to
  -- have it counted twice. (ON CONFLICT already prevented double-inserting,
  -- but only across separate statements -- within one loop the second
  -- insert of a duplicate key would also report found = false, so this is
  -- belt-and-braces plus a smaller loop.)
  for v_key in select distinct k from unnest(coalesce(p_badge_keys, '{}'::text[])) as k loop
    -- The tier comes from the CATALOGUE, never from the caller's string, so a
    -- forged key cannot pick its own payout.
    select c.tier into v_tier from public.badge_catalogue c where c.badge_key = v_key;
    if v_tier is null then
      continue; -- unknown badge: ignore silently, award nothing
    end if;

    v_xp := case v_tier
      when 'starter' then 100
      when 'common' then 200
      when 'regular' then 350
      when 'uncommon' then 600
      when 'rare' then 1000
      when 'epic' then 1500
      when 'legendary' then 2000
      else 0
    end;

    if v_xp > 0 then
      insert into public.user_badges (child_id, badge_key)
      values (v_uid, v_key)
      on conflict (child_id, badge_key) do nothing;
      if found then
        v_gained := v_gained + v_xp;
        v_new := array_append(v_new, v_key);
      end if;
    end if;
  end loop;

  if v_gained > 0 then
    update public.profiles set xp = xp + v_gained where id = v_uid;
  end if;

  return query select p.xp, v_new from public.profiles p where p.id = v_uid;
end; $$;

grant execute on function public.sync_badges(text[]) to authenticated;

-- Existing forged rows (if any) can be found with:
--   select * from public.user_badges u
--   where not exists (select 1 from public.badge_catalogue c where c.badge_key = u.badge_key);
-- Deliberately not deleted here: XP already added to profiles.xp cannot be
-- attributed back per-row, so cleanup is a judgement call rather than a
-- mechanical one.
