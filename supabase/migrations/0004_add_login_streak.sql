-- Daily login streak for child accounts: tracks consecutive calendar days
-- (child's local "today" as sent by the client) a child has opened the app.

alter table public.profiles add column streak_count int not null default 0;
alter table public.profiles add column last_login_date date;

-- Bumps the caller's own streak at most once per calendar day. SECURITY
-- DEFINER + auth.uid() scoping (same pattern as check_username_available)
-- so a child can update their own streak columns without a broad UPDATE
-- policy on profiles. p_today is passed by the client so the streak lines
-- up with the child's local day rather than the database server's.
create or replace function public.bump_daily_streak(p_today date)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_last date;
  v_streak int;
begin
  select last_login_date, streak_count into v_last, v_streak
  from public.profiles where id = auth.uid();

  if v_last = p_today then
    return v_streak;
  elsif v_last = p_today - 1 then
    v_streak := v_streak + 1;
  else
    v_streak := 1;
  end if;

  update public.profiles set streak_count = v_streak, last_login_date = p_today where id = auth.uid();
  return v_streak;
end; $$;

grant execute on function public.bump_daily_streak(date) to authenticated;
