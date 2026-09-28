-- bump_daily_streak (0018) broke the login streak for anyone far from UTC.
--
-- 0018 was closing a real exploit: the function trusted the client's claimed
-- local date, so a child could send alternating dates and mint login XP on
-- every call. It clamped that date to within one day of the server date, and
-- replaced the old "same local day -> no-op" check with a guard of at most
-- one change per SERVER (UTC) day, using last_streak_bump_date. The server-day
-- guard is what went wrong: the child's streak is about their local calendar,
-- the guard is about UTC's, and the two disagree for hours every day.
--
--   California (UTC-7), logging in every day at 5pm and 7am:
--     5pm on the 16th  -> UTC is already the 17th; streak increments and
--                          last_streak_bump_date = 17
--     7am on the 17th  -> UTC is still the 17th; the guard returns early and
--                          the 17th is never credited
--     7am on the 18th  -> last_login_date is still 16, not 17 -> RESET TO 1
--
--   Australia (UTC+10): opening the app at 8am and again at 8pm the same
--   local day could reset or skip, because UTC rolls over in between.
--
-- That is the entire US market after school, every day, on the app's core
-- daily-engagement mechanic for 8-12 year olds.
--
-- The fix makes the logic monotonic in the child's (clamped) local date and
-- drops the server-day guard entirely:
--
--   today <= last credited day  -> no-op (same local day, or a date earlier
--                                   than one already credited -- which is how
--                                   the clock-rollback exploit started)
--   today =  last + 1           -> increment
--   anything else               -> reset to 1
--
-- Why the exploit stays closed without last_streak_bump_date: last_login_date
-- now only ever moves forward, and the clamp caps any accepted date at
-- current_date + 1. So across any span of real days, the number of state
-- changes -- and therefore XP awards -- is at most days + 2. Checked
-- exhaustively against an adversary choosing any date, up to eight calls a
-- day, over 60 days: 62 awards maximum, against 60 for an honest daily user.
-- A cheater can gain two awards once, ever. The old guard allowed roughly the
-- same, while also breaking honest users.
--
-- Also adds FOR UPDATE on the profile read. Without it, two concurrent calls
-- (two open tabs, a double mount) could both read the same last_login_date,
-- both decide to increment, and both run xp = xp + v_login_xp -- awarding
-- login XP twice. The student streak in 0031 (edu_refresh) already locks the
-- same way.
--
-- last_streak_bump_date is still written, as a record of the server day of
-- the last change, but nothing reads it any more. The column is left in place
-- so no other migration or query has to change.
--
-- Grants are unchanged: CREATE OR REPLACE keeps the existing
-- grant to authenticated from 0018.
create or replace function public.bump_daily_streak(p_today date)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_last date;
  v_streak int;
  v_login_xp int;
  v_today date := public.finn_clamp_local_date(p_today);
begin
  select last_login_date, streak_count
  into v_last, v_streak
  from public.profiles
  where id = auth.uid()
  for update;

  if not found then
    return 0;
  end if;

  if v_last is not null and v_today <= v_last then
    return v_streak;
  end if;

  if v_last is not null and v_today = v_last + 1 then
    v_streak := v_streak + 1;
  else
    v_streak := 1;
  end if;

  v_login_xp := case when v_streak >= 7 then 35 when v_streak > 1 then 10 else 5 end;

  update public.profiles
  set streak_count = v_streak,
      last_login_date = v_today,
      last_streak_bump_date = current_date,
      xp = xp + v_login_xp
  where id = auth.uid();

  return v_streak;
end; $$;

comment on function public.bump_daily_streak(date) is
  'Credits one login day toward the streak. Monotonic in the clamped local date: same or earlier day is a no-op, the next day increments, any gap resets. Because last_login_date only moves forward and finn_clamp_local_date caps it at current_date + 1, state changes (and XP awards) are bounded by elapsed days + 2. Do not reintroduce a server-day guard -- see 0036 for why it broke non-UTC users.';
