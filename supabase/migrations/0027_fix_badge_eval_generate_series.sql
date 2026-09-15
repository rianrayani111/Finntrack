-- finn_evaluate_badges (0026) called generate_series() with `date` bounds and
-- a bare integer step (`generate_series(min(wk) + 7, ..., 7)`), which isn't a
-- signature Postgres actually has -- the date-range overload requires an
-- `interval` step and timestamp bounds. This made EVERY call to
-- sync_badges() fail outright with "function generate_series(date, date,
-- integer) does not exist" (42883), caught live against the real child
-- account before this ever reached production child users. Fixes that one
-- CTE (regular__nothing_spent's "empty week" check) and makes the
-- mondays_in_month CTE explicit about the same bounds/step typing so it
-- doesn't hit the identical issue once the empty-week query stopped masking
-- it. No behavioral change from 0026's intent -- same logic, correct types.
create or replace function public.finn_evaluate_badges(p_child_id uuid, p_already_earned text[])
returns text[]
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  earned text[] := coalesce(p_already_earned, '{}'::text[]);

  v_display_name text;
  v_xp int;
  v_summary_views_count int;
  v_history_views_count int;
  v_streak_count int;
  v_profile_created_at timestamptz;
  v_account_age_days int;

  v_entry_count int;
  v_deposit_count int;
  v_necessity_count int;
  v_want_count int;
  v_asset_count int;
  v_liability_count int;
  v_total_tracked numeric;
  v_notes_count int;
  v_distinct_dates_logged int;
  v_morning_count int;
  v_evening_count int;
  v_small_spend_count int;
  v_whole_dollar_count int;
  v_categories_used_count int;
  v_location_count int;
  v_location_reason_together_count int;
  v_has_location_any boolean;
  v_has_reason_any boolean;
  v_has_honest_entry boolean;
  v_distinct_active_months int;
  v_sat_count int;
  v_sun_count int;
  v_has_weekend_pair boolean;
  v_any_week_all_four boolean;
  v_same_day_count int;
  v_quick_log_count int;

  v_longest_streak int;
  v_gap_days int;
  v_longest_weekly_streak int;
  v_has_patient_want boolean;
  v_has_empty_week boolean;

  v_months_fully_accounted int := 0;
  v_months_needs_first int := 0;
  v_months_full_detail int := 0;
  v_months_every_monday int := 0;
  v_quiet_month_found boolean := false;
  v_any_month_positive boolean := false;
  v_longest_consecutive_positive_months int := 0;
  v_longest_consecutive_half_saved_months int := 0;
  v_cur_pos_run int := 0;
  v_cur_half_run int := 0;
  v_prev_want_count int;
  v_month_rec record;

  v_projected_xp_gain numeric := 0;

  v_uncommon_keys constant text[] := array[
    'uncommon__fortnight','uncommon__comeback','uncommon__patient','uncommon__precise',
    'uncommon__pattern_finder','uncommon__half_kept','uncommon__hundred_tracked',
    'uncommon__knows_the_difference','uncommon__fifty_entries','uncommon__three_months',
    'uncommon__steady_hand','uncommon__asset_minded','uncommon__debt_aware','uncommon__quiet_month'
  ];
  v_rare_keys constant text[] := array[
    'rare__month_of_mondays','rare__never_missed','rare__master_sorter','rare__growing',
    'rare__five_hundred_tracked','rare__hundred_entries','rare__six_months','rare__full_picture',
    'rare__saver','rare__two_month_streak','rare__category_master','rare__reflective'
  ];
begin
  select display_name, xp, summary_views_count, history_views_count, streak_count, created_at
  into v_display_name, v_xp, v_summary_views_count, v_history_views_count, v_streak_count, v_profile_created_at
  from public.profiles where id = p_child_id;

  if not found then
    return earned;
  end if;

  v_account_age_days := floor(extract(epoch from (now() - v_profile_created_at)) / 86400)::int;

  -- ============================================================
  -- Entry/deposit aggregates (mirrors buildAchievementContext's single pass
  -- over `entries` / `deposits`)
  -- ============================================================
  select
    count(*) filter (where type = 'withdrawal'),
    count(*) filter (where type = 'deposit'),
    count(*) filter (where type = 'withdrawal' and category = 'necessity'),
    count(*) filter (where type = 'withdrawal' and category = 'want'),
    count(*) filter (where type = 'withdrawal' and category = 'asset'),
    count(*) filter (where type = 'withdrawal' and category = 'liability'),
    coalesce(sum(amount) filter (where type = 'withdrawal'), 0),
    count(*) filter (where type = 'withdrawal' and trim(notes) <> ''),
    count(distinct date) filter (where type = 'withdrawal'),
    count(*) filter (where type = 'withdrawal' and extract(hour from time) < 12),
    count(*) filter (where type = 'withdrawal' and extract(hour from time) >= 18),
    count(*) filter (where type = 'withdrawal' and amount < 1),
    count(*) filter (where type = 'withdrawal' and amount = floor(amount)),
    count(distinct category) filter (where type = 'withdrawal'),
    count(*) filter (where type = 'withdrawal' and trim(location) <> ''),
    count(*) filter (where type = 'withdrawal' and trim(location) <> '' and trim(reason) <> ''),
    bool_or(type = 'withdrawal' and trim(location) <> ''),
    bool_or(type = 'withdrawal' and trim(reason) <> ''),
    bool_or(type = 'withdrawal' and amount < 2 and trim(notes) <> ''),
    count(distinct date_trunc('month', date)) filter (where type = 'withdrawal'),
    count(*) filter (where type = 'withdrawal' and extract(dow from date) = 6),
    count(*) filter (where type = 'withdrawal' and extract(dow from date) = 0),
    count(*) filter (where type = 'withdrawal' and (created_at at time zone 'utc')::date = date),
    count(*) filter (
      where type = 'withdrawal'
      and abs(extract(epoch from (created_at - ((date + time) at time zone 'utc')))) <= 3600
    )
  into
    v_entry_count, v_deposit_count, v_necessity_count, v_want_count, v_asset_count, v_liability_count,
    v_total_tracked, v_notes_count, v_distinct_dates_logged, v_morning_count, v_evening_count,
    v_small_spend_count, v_whole_dollar_count, v_categories_used_count, v_location_count,
    v_location_reason_together_count, v_has_location_any, v_has_reason_any, v_has_honest_entry,
    v_distinct_active_months, v_sat_count, v_sun_count, v_same_day_count, v_quick_log_count
  from public.transactions
  where child_id = p_child_id;

  v_has_weekend_pair := v_sat_count > 0 and v_sun_count > 0;

  select exists (
    select 1 from public.transactions
    where child_id = p_child_id and type = 'withdrawal'
    group by date_trunc('week', date)
    having count(distinct category) = 4
  ) into v_any_week_all_four;

  -- ============================================================
  -- Sorted-date-derived: daily streak, longest gap, weekly streak, "patient"
  -- ============================================================
  with d as (
    select distinct date from public.transactions
    where child_id = p_child_id and type = 'withdrawal'
  ),
  numbered as (
    select date, row_number() over (order by date)::int as rn from d
  )
  select coalesce(max(cnt), 0) into v_longest_streak
  from (select count(*) as cnt from numbered group by (date - rn)) s;

  with d as (
    select distinct date from public.transactions
    where child_id = p_child_id and type = 'withdrawal'
  ),
  ordered as (
    select date, lag(date) over (order by date) as prev_date from d
  )
  select coalesce(max(date - prev_date), 0) into v_gap_days
  from ordered where prev_date is not null;

  with w as (
    select distinct date_trunc('week', date)::date as wk
    from public.transactions where child_id = p_child_id and type = 'withdrawal'
  ),
  numbered as (
    select wk, row_number() over (order by wk)::int as rn from w
  )
  select coalesce(max(cnt), 0) into v_longest_weekly_streak
  from (select count(*) as cnt from numbered group by (wk - rn * 7)) s;

  with wd as (
    select distinct date from public.transactions
    where child_id = p_child_id and type = 'withdrawal' and category = 'want'
  ),
  ordered as (
    select date, lag(date) over (order by date) as prev_date from wd
  )
  select coalesce(bool_or(date - prev_date >= 7), false) into v_has_patient_want
  from ordered where prev_date is not null;

  with weeks as (
    select distinct date_trunc('week', date)::date as wk
    from public.transactions where child_id = p_child_id and type = 'withdrawal'
  )
  select case when count(*) > 1 then
    exists (
      select 1 from generate_series(
        (min(wk) + 7)::timestamp,
        (date_trunc('week', current_date)::date - 7)::timestamp,
        interval '7 days'
      ) as gs(wk)
      where gs.wk::date not in (select wk from weeks)
    )
  else false end
  into v_has_empty_week
  from weeks;

  -- ============================================================
  -- Completed-month rollups. A month only appears here if it has at least
  -- one entry or deposit -- exactly matching monthMap in gamification.js,
  -- including its quirk that a month with zero activity is invisible to the
  -- "consecutive months" streaks below rather than breaking them.
  -- ============================================================
  v_prev_want_count := null;

  for v_month_rec in
    with entry_months as (
      select extract(year from date)::int as yr, extract(month from date)::int as mo,
        sum(amount) filter (where category = 'necessity') as necessity,
        sum(amount) filter (where category = 'want') as want,
        sum(amount) filter (where category = 'asset') as asset,
        sum(amount) filter (where category = 'liability') as liability,
        count(*) as entry_count,
        count(distinct date) as distinct_days,
        count(distinct date) filter (where extract(dow from date) = 1) as mondays_logged,
        count(*) filter (where category = 'want') as want_count,
        count(*) filter (where trim(notes) = '') as blank_notes_count
      from public.transactions
      where child_id = p_child_id and type = 'withdrawal'
      group by 1, 2
    ),
    deposit_months as (
      select extract(year from date)::int as yr, extract(month from date)::int as mo,
        sum(amount) as earned
      from public.transactions
      where child_id = p_child_id and type = 'deposit'
      group by 1, 2
    ),
    combined as (
      select coalesce(e.yr, d.yr) as yr, coalesce(e.mo, d.mo) as mo,
        coalesce(e.necessity, 0) as necessity, coalesce(e.want, 0) as want,
        coalesce(e.asset, 0) as asset, coalesce(e.liability, 0) as liability,
        coalesce(d.earned, 0) as earned,
        coalesce(e.entry_count, 0) as entry_count,
        coalesce(e.distinct_days, 0) as distinct_days,
        coalesce(e.mondays_logged, 0) as mondays_logged,
        coalesce(e.want_count, 0) as want_count,
        coalesce(e.blank_notes_count, 0) as blank_notes_count
      from entry_months e
      full outer join deposit_months d on e.yr = d.yr and e.mo = d.mo
    )
    select c.*,
      extract(day from (make_date(c.yr, c.mo, 1) + interval '1 month' - interval '1 day'))::int as days_in_month,
      (
        select count(*)::int from generate_series(
          make_date(c.yr, c.mo, 1)::timestamp,
          make_date(c.yr, c.mo, 1) + interval '1 month' - interval '1 day',
          interval '1 day'
        ) gd where extract(dow from gd) = 1
      ) as mondays_in_month
    from combined c
    where (c.yr < extract(year from current_date)::int)
       or (c.yr = extract(year from current_date)::int and c.mo < extract(month from current_date)::int)
    order by c.yr, c.mo
  loop
    if (v_month_rec.earned - (v_month_rec.necessity + v_month_rec.want + v_month_rec.asset + v_month_rec.liability)) > 0 then
      v_any_month_positive := true;
      v_cur_pos_run := v_cur_pos_run + 1;
      v_longest_consecutive_positive_months := greatest(v_longest_consecutive_positive_months, v_cur_pos_run);
    else
      v_cur_pos_run := 0;
    end if;

    if v_month_rec.earned > 0
      and (v_month_rec.earned - (v_month_rec.necessity + v_month_rec.want + v_month_rec.asset + v_month_rec.liability)) >= v_month_rec.earned / 2
    then
      v_cur_half_run := v_cur_half_run + 1;
      v_longest_consecutive_half_saved_months := greatest(v_longest_consecutive_half_saved_months, v_cur_half_run);
    else
      v_cur_half_run := 0;
    end if;

    if v_month_rec.distinct_days >= v_month_rec.days_in_month then
      v_months_fully_accounted := v_months_fully_accounted + 1;
    end if;

    if v_month_rec.necessity > v_month_rec.want then
      v_months_needs_first := v_months_needs_first + 1;
    end if;

    if v_month_rec.entry_count > 0 and v_month_rec.blank_notes_count = 0 then
      v_months_full_detail := v_months_full_detail + 1;
    end if;

    if v_month_rec.mondays_in_month > 0 and v_month_rec.mondays_logged >= v_month_rec.mondays_in_month then
      v_months_every_monday := v_months_every_monday + 1;
    end if;

    if v_prev_want_count is not null and v_month_rec.want_count < v_prev_want_count then
      v_quiet_month_found := true;
    end if;
    v_prev_want_count := v_month_rec.want_count;
  end loop;

  -- ============================================================
  -- Badge evaluation -- exact catalogue order from BADGES in gamification.js,
  -- since money_mind/collector/grandmaster read `earned` as accumulated so
  -- far, same as evaluateBadges()'s single forEach pass.
  -- ============================================================

  -- STARTER
  if not ('starter__first_entry' = any(earned)) and v_entry_count >= 1 then earned := array_append(earned, 'starter__first_entry'); end if;
  if not ('starter__ledger_opened' = any(earned)) and v_streak_count >= 1 then earned := array_append(earned, 'starter__ledger_opened'); end if;
  if not ('starter__four_corners' = any(earned)) and v_categories_used_count >= 4 then earned := array_append(earned, 'starter__four_corners'); end if;
  if not ('starter__summary_reader' = any(earned)) and v_summary_views_count >= 1 then earned := array_append(earned, 'starter__summary_reader'); end if;
  if not ('starter__same_day' = any(earned)) and v_same_day_count >= 1 then earned := array_append(earned, 'starter__same_day'); end if;
  if not ('starter__note_taker' = any(earned)) and v_notes_count >= 1 then earned := array_append(earned, 'starter__note_taker'); end if;
  if not ('starter__where_i_was' = any(earned)) and v_has_location_any then earned := array_append(earned, 'starter__where_i_was'); end if;
  if not ('starter__reason_given' = any(earned)) and v_has_reason_any then earned := array_append(earned, 'starter__reason_given'); end if;
  if not ('starter__first_deposit_seen' = any(earned)) and v_deposit_count >= 1 then earned := array_append(earned, 'starter__first_deposit_seen'); end if;
  if not ('starter__curious' = any(earned)) and v_history_views_count >= 1 then earned := array_append(earned, 'starter__curious'); end if;
  if not ('starter__two_days' = any(earned)) and v_distinct_dates_logged >= 2 then earned := array_append(earned, 'starter__two_days'); end if;
  if not ('starter__named_it' = any(earned)) and trim(coalesce(v_display_name, '')) <> '' then earned := array_append(earned, 'starter__named_it'); end if;

  -- COMMON
  if not ('common__three_in_a_row' = any(earned)) and v_longest_streak >= 3 then earned := array_append(earned, 'common__three_in_a_row'); end if;
  if not ('common__necessity_knower' = any(earned)) and v_necessity_count >= 5 then earned := array_append(earned, 'common__necessity_knower'); end if;
  if not ('common__want_spotter' = any(earned)) and v_want_count >= 5 then earned := array_append(earned, 'common__want_spotter'); end if;
  if not ('common__asset_builder' = any(earned)) and v_asset_count >= 5 then earned := array_append(earned, 'common__asset_builder'); end if;
  if not ('common__liability_learner' = any(earned)) and v_liability_count >= 5 then earned := array_append(earned, 'common__liability_learner'); end if;
  if not ('common__detailed' = any(earned)) and v_notes_count >= 10 then earned := array_append(earned, 'common__detailed'); end if;
  if not ('common__looked_back' = any(earned)) and v_history_views_count >= 10 then earned := array_append(earned, 'common__looked_back'); end if;
  if not ('common__first_ten_tracked' = any(earned)) and v_total_tracked >= 10 then earned := array_append(earned, 'common__first_ten_tracked'); end if;
  if not ('common__ten_entries' = any(earned)) and v_entry_count >= 10 then earned := array_append(earned, 'common__ten_entries'); end if;
  if not ('common__weekend_logger' = any(earned)) and v_has_weekend_pair then earned := array_append(earned, 'common__weekend_logger'); end if;
  if not ('common__morning_person' = any(earned)) and v_morning_count >= 5 then earned := array_append(earned, 'common__morning_person'); end if;
  if not ('common__evening_review' = any(earned)) and v_evening_count >= 5 then earned := array_append(earned, 'common__evening_review'); end if;
  if not ('common__small_spender' = any(earned)) and v_small_spend_count >= 5 then earned := array_append(earned, 'common__small_spender'); end if;
  if not ('common__rounded_up' = any(earned)) and v_whole_dollar_count >= 1 then earned := array_append(earned, 'common__rounded_up'); end if;
  if not ('common__back_again' = any(earned)) and v_distinct_dates_logged >= 5 then earned := array_append(earned, 'common__back_again'); end if;
  if not ('common__categories_complete' = any(earned)) and v_any_week_all_four then earned := array_append(earned, 'common__categories_complete'); end if;

  -- REGULAR
  if not ('regular__week_watcher' = any(earned)) and v_longest_streak >= 7 then earned := array_append(earned, 'regular__week_watcher'); end if;
  if not ('regular__full_month' = any(earned)) and v_account_age_days >= 30 and v_entry_count >= 1 then earned := array_append(earned, 'regular__full_month'); end if;
  if not ('regular__sorted' = any(earned)) and v_entry_count >= 25 then earned := array_append(earned, 'regular__sorted'); end if;
  if not ('regular__quick_logger' = any(earned)) and v_quick_log_count >= 10 then earned := array_append(earned, 'regular__quick_logger'); end if;
  if not ('regular__nothing_spent' = any(earned)) and v_has_empty_week then earned := array_append(earned, 'regular__nothing_spent'); end if;
  if not ('regular__kept_it' = any(earned)) and v_any_month_positive then earned := array_append(earned, 'regular__kept_it'); end if;
  if not ('regular__balanced_books' = any(earned)) and v_deposit_count >= 5 and v_entry_count >= 5 then earned := array_append(earned, 'regular__balanced_books'); end if;
  if not ('regular__fifty_tracked' = any(earned)) and v_total_tracked >= 50 then earned := array_append(earned, 'regular__fifty_tracked'); end if;
  if not ('regular__balance_sheet_basics' = any(earned)) and v_necessity_count >= 3 and v_want_count >= 3 and v_asset_count >= 3 and v_liability_count >= 3 then earned := array_append(earned, 'regular__balance_sheet_basics'); end if;
  if not ('regular__twenty_five' = any(earned)) and v_distinct_dates_logged >= 25 then earned := array_append(earned, 'regular__twenty_five'); end if;
  if not ('regular__two_weeks_running' = any(earned)) and v_longest_weekly_streak >= 2 then earned := array_append(earned, 'regular__two_weeks_running'); end if;
  if not ('regular__location_logger' = any(earned)) and v_location_count >= 15 then earned := array_append(earned, 'regular__location_logger'); end if;
  if not ('regular__honest_ledger' = any(earned)) and v_has_honest_entry then earned := array_append(earned, 'regular__honest_ledger'); end if;
  if not ('regular__month_complete' = any(earned)) and v_months_fully_accounted >= 1 then earned := array_append(earned, 'regular__month_complete'); end if;
  if not ('regular__needs_first' = any(earned)) and v_months_needs_first >= 1 then earned := array_append(earned, 'regular__needs_first'); end if;
  if not ('regular__savers_start' = any(earned)) and v_longest_consecutive_positive_months >= 2 then earned := array_append(earned, 'regular__savers_start'); end if;

  -- UNCOMMON
  if not ('uncommon__fortnight' = any(earned)) and v_longest_streak >= 14 then earned := array_append(earned, 'uncommon__fortnight'); end if;
  if not ('uncommon__comeback' = any(earned)) and v_gap_days >= 8 then earned := array_append(earned, 'uncommon__comeback'); end if;
  if not ('uncommon__patient' = any(earned)) and v_has_patient_want then earned := array_append(earned, 'uncommon__patient'); end if;
  if not ('uncommon__precise' = any(earned)) and v_location_reason_together_count >= 25 then earned := array_append(earned, 'uncommon__precise'); end if;
  if not ('uncommon__pattern_finder' = any(earned)) and v_summary_views_count >= 3 then earned := array_append(earned, 'uncommon__pattern_finder'); end if;
  if not ('uncommon__half_kept' = any(earned)) and v_longest_consecutive_half_saved_months >= 1 then earned := array_append(earned, 'uncommon__half_kept'); end if;
  if not ('uncommon__hundred_tracked' = any(earned)) and v_total_tracked >= 100 then earned := array_append(earned, 'uncommon__hundred_tracked'); end if;
  if not ('uncommon__knows_the_difference' = any(earned)) and (v_necessity_count + v_want_count) >= 20 then earned := array_append(earned, 'uncommon__knows_the_difference'); end if;
  if not ('uncommon__fifty_entries' = any(earned)) and v_entry_count >= 50 then earned := array_append(earned, 'uncommon__fifty_entries'); end if;
  if not ('uncommon__three_months' = any(earned)) and v_account_age_days >= 90 then earned := array_append(earned, 'uncommon__three_months'); end if;
  if not ('uncommon__steady_hand' = any(earned)) and v_longest_weekly_streak >= 8 then earned := array_append(earned, 'uncommon__steady_hand'); end if;
  if not ('uncommon__asset_minded' = any(earned)) and v_asset_count >= 10 then earned := array_append(earned, 'uncommon__asset_minded'); end if;
  if not ('uncommon__debt_aware' = any(earned)) and v_liability_count >= 10 then earned := array_append(earned, 'uncommon__debt_aware'); end if;
  if not ('uncommon__quiet_month' = any(earned)) and v_quiet_month_found then earned := array_append(earned, 'uncommon__quiet_month'); end if;

  -- RARE
  if not ('rare__month_of_mondays' = any(earned)) and v_months_every_monday >= 1 then earned := array_append(earned, 'rare__month_of_mondays'); end if;
  if not ('rare__never_missed' = any(earned)) and v_longest_streak >= 30 then earned := array_append(earned, 'rare__never_missed'); end if;
  if not ('rare__master_sorter' = any(earned)) and v_necessity_count >= 15 and v_want_count >= 15 and v_asset_count >= 15 and v_liability_count >= 15 then earned := array_append(earned, 'rare__master_sorter'); end if;
  if not ('rare__growing' = any(earned)) and v_longest_consecutive_positive_months >= 3 then earned := array_append(earned, 'rare__growing'); end if;
  if not ('rare__five_hundred_tracked' = any(earned)) and v_total_tracked >= 500 then earned := array_append(earned, 'rare__five_hundred_tracked'); end if;
  if not ('rare__hundred_entries' = any(earned)) and v_entry_count >= 100 then earned := array_append(earned, 'rare__hundred_entries'); end if;
  if not ('rare__six_months' = any(earned)) and v_account_age_days >= 180 then earned := array_append(earned, 'rare__six_months'); end if;
  if not ('rare__full_picture' = any(earned)) and v_months_full_detail >= 1 then earned := array_append(earned, 'rare__full_picture'); end if;
  if not ('rare__saver' = any(earned)) and v_longest_consecutive_half_saved_months >= 3 then earned := array_append(earned, 'rare__saver'); end if;
  if not ('rare__two_month_streak' = any(earned)) and v_longest_streak >= 60 then earned := array_append(earned, 'rare__two_month_streak'); end if;
  if not ('rare__category_master' = any(earned)) and v_necessity_count >= 25 and v_want_count >= 25 and v_asset_count >= 25 and v_liability_count >= 25 then earned := array_append(earned, 'rare__category_master'); end if;
  if not ('rare__reflective' = any(earned)) and v_summary_views_count >= 6 then earned := array_append(earned, 'rare__reflective'); end if;

  -- EPIC
  if not ('epic__century' = any(earned)) and v_notes_count >= 100 then earned := array_append(earned, 'epic__century'); end if;
  if not ('epic__year_in_review' = any(earned)) and v_account_age_days >= 365 and v_distinct_active_months >= 12 then earned := array_append(earned, 'epic__year_in_review'); end if;
  if not ('epic__graduate' = any(earned)) and v_account_age_days >= 365 then earned := array_append(earned, 'epic__graduate'); end if;
  if not ('epic__hundred_days' = any(earned)) and v_longest_streak >= 100 then earned := array_append(earned, 'epic__hundred_days'); end if;
  if not ('epic__thousand_tracked' = any(earned)) and v_total_tracked >= 1000 then earned := array_append(earned, 'epic__thousand_tracked'); end if;
  if not ('epic__consistent' = any(earned)) and v_longest_weekly_streak >= 26 then earned := array_append(earned, 'epic__consistent'); end if;
  if not ('epic__half_year_saver' = any(earned)) and v_longest_consecutive_positive_months >= 6 then earned := array_append(earned, 'epic__half_year_saver'); end if;
  if not ('epic__complete_ledger' = any(earned)) and v_entry_count >= 250 then earned := array_append(earned, 'epic__complete_ledger'); end if;
  if not ('epic__the_long_view' = any(earned)) and v_summary_views_count >= 12 then earned := array_append(earned, 'epic__the_long_view'); end if;
  if not ('epic__money_mind' = any(earned)) and v_uncommon_keys <@ earned then earned := array_append(earned, 'epic__money_mind'); end if;

  -- ============================================================
  -- Legendary pass: mirrors evaluateBadges()'s second pass against a
  -- projected-XP snapshot taken ONCE here, before any legendary badge is
  -- evaluated (so collector/grandmaster/finntrack_legend all see the same
  -- projection even though this loop keeps mutating `earned`).
  -- ============================================================
  select coalesce(sum(
    case split_part(k, '__', 1)
      when 'starter' then 100 when 'common' then 200 when 'regular' then 350
      when 'uncommon' then 600 when 'rare' then 1000 when 'epic' then 1500
      when 'legendary' then 2000 else 0
    end
  ), 0)
  into v_projected_xp_gain
  from unnest(earned) as k
  where not (k = any(coalesce(p_already_earned, '{}'::text[])));

  -- LEGENDARY
  if not ('legendary__perfect_year' = any(earned)) and v_longest_weekly_streak >= 52 then earned := array_append(earned, 'legendary__perfect_year'); end if;
  if not ('legendary__collector' = any(earned)) and coalesce(array_length(earned, 1), 0) >= 50 then earned := array_append(earned, 'legendary__collector'); end if;
  if not ('legendary__grandmaster' = any(earned)) and v_rare_keys <@ earned then earned := array_append(earned, 'legendary__grandmaster'); end if;
  if not ('legendary__finntrack_legend' = any(earned)) and (v_xp + v_projected_xp_gain) >= 122100 then earned := array_append(earned, 'legendary__finntrack_legend'); end if;

  return earned;
end;
$$;
