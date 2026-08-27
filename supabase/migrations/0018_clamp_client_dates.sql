-- bump_daily_streak, resolve_request, and resolve_task all take a calendar date
-- from the client so that streaks and payout transactions line up with the
-- USER's local day rather than the database server's UTC day (see 0004 and
-- 0014). None of them checked that the date was plausible -- coalesce(p_date,
-- current_date) supplies a default, it does not validate.
--
-- The legitimate range is narrow: every real timezone sits within UTC-12..UTC+14,
-- so a client's local date can differ from the server's by at most one day in
-- either direction. Anything outside that is either tampering or a badly set
-- device clock. Out-of-range dates are CLAMPED to the server date rather than
-- rejected -- bump_daily_streak is called fire-and-forget from the dashboard
-- (`.catch(() => {})`), so a user whose device clock is simply wrong would
-- otherwise silently lose their streak forever with no way to tell why.
--
-- For resolve_request/resolve_task, clamping alone is sufficient: each request
-- or task row can only ever be resolved ONCE (guarded by `status <> 'pending'`
-- / `'submitted'` raising), so at most one payout transaction per row can be
-- misdated, and only by up to a day.
--
-- bump_daily_streak has no such per-row lock -- it is designed to be called
-- once per real day, forever, from the same profile row -- so clamping p_today
-- alone does NOT close it. A client can force a REGRESSION by claiming a date
-- one step outside the clamp window (which snaps back to a date behind its own
-- last_login_date), triggering the streak-reset branch with no time cost, then
-- walk the ±1-day window back up to re-earn the same XP. Repeating that
-- reset-then-walk cycle mints unlimited XP within a single real day. (Verified
-- by simulation: 20 cycles of a 4-call reset+walk pattern yielded 600 XP from
-- 80 calls inside one simulated calendar day, versus 5 XP for one legitimate
-- call.)
--
-- The fix has to be a guard the client cannot influence at all: track the
-- SERVER's own current_date on which the streak last actually changed, and
-- refuse a second state change on the same server day regardless of what the
-- client claims p_today is. p_today is still used (after clamping) for the
-- continues-vs-resets streak arithmetic, so the timezone-flexibility this
-- function was built for (0004's stated purpose) is unaffected; only the
-- "how many times can this fire per real day" question is now decided by the
-- database's own clock.

alter table public.profiles add column last_streak_bump_date date;

create or replace function public.finn_clamp_local_date(p_date date)
returns date language sql stable set search_path = public as $$
  select case
    when p_date is null then current_date
    when p_date between current_date - 1 and current_date + 1 then p_date
    else current_date
  end;
$$;

comment on function public.finn_clamp_local_date(date) is
  'Accepts a client-supplied local date only if it is within one day of the server date (the widest real timezone spread); otherwise falls back to the server date. Bounds display/arithmetic drift only -- NOT a substitute for a server-clock-based once-per-day guard where a function can be called repeatedly (see bump_daily_streak).';

create or replace function public.bump_daily_streak(p_today date)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_last date;
  v_streak int;
  v_last_bump date;
  v_login_xp int;
  v_today date := public.finn_clamp_local_date(p_today);
begin
  select last_login_date, streak_count, last_streak_bump_date
  into v_last, v_streak, v_last_bump
  from public.profiles where id = auth.uid();

  -- Non-spoofable idempotency guard: at most one state change per SERVER
  -- calendar day, no matter how many times this is called or what p_today
  -- claims. This replaces the old `if v_last = p_today then return` check,
  -- which used the client's own value as its own proof of "already done today".
  if v_last_bump = current_date then
    return v_streak;
  end if;

  if v_last = v_today - 1 then
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

grant execute on function public.bump_daily_streak(date) to authenticated;

-- Unchanged from 0014 apart from clamping p_date.
create or replace function public.resolve_request(
  p_request_id uuid,
  p_decision text,
  p_date date default null,
  p_time time default null
)
returns public.requests
language plpgsql security definer set search_path = public as $$
declare
  req public.requests;
  new_txn_id uuid;
  new_task_id uuid;
  v_date date := public.finn_clamp_local_date(p_date);
  v_time time := coalesce(p_time, localtime);
begin
  if p_decision not in ('accept', 'decline') then
    raise exception 'Invalid decision.';
  end if;

  select * into req from public.requests where id = p_request_id for update;
  if not found then
    raise exception 'Request not found.';
  end if;
  if req.parent_id <> auth.uid() then
    raise exception 'Not authorized to resolve this request.';
  end if;
  if req.status <> 'pending' then
    raise exception 'This request has already been resolved.';
  end if;

  if p_decision = 'accept' and req.type = 'chore_promise' then
    insert into public.tasks (parent_id, child_id, name, description, amount)
    values (req.parent_id, req.child_id, req.description, req.description, req.amount)
    returning id into new_task_id;

    update public.requests
    set status = 'accepted', task_id = new_task_id, resolved_at = now()
    where id = p_request_id
    returning * into req;
  elsif p_decision = 'accept' then
    insert into public.transactions (child_id, parent_id, type, amount, category, reason, location, notes, date, time, created_by)
    values (req.child_id, req.parent_id, 'deposit', req.amount, null, req.description, '', '', v_date, v_time, 'parent')
    returning id into new_txn_id;

    update public.requests
    set status = 'accepted', transaction_id = new_txn_id, resolved_at = now()
    where id = p_request_id
    returning * into req;
  else
    update public.requests
    set status = 'declined', resolved_at = now()
    where id = p_request_id
    returning * into req;
  end if;

  return req;
end; $$;

grant execute on function public.resolve_request(uuid, text, date, time) to authenticated;

-- Unchanged from 0014 apart from clamping p_date.
create or replace function public.resolve_task(
  p_task_id uuid,
  p_decision text,
  p_date date default null,
  p_time time default null
)
returns public.tasks
language plpgsql security definer set search_path = public as $$
declare
  t public.tasks;
  new_txn_id uuid;
  v_date date := public.finn_clamp_local_date(p_date);
  v_time time := coalesce(p_time, localtime);
begin
  if p_decision not in ('accept', 'decline') then
    raise exception 'Invalid decision.';
  end if;

  select * into t from public.tasks where id = p_task_id for update;
  if not found then
    raise exception 'Task not found.';
  end if;
  if t.parent_id <> auth.uid() then
    raise exception 'Not authorized to resolve this task.';
  end if;
  if t.status <> 'submitted' then
    raise exception 'This task has already been resolved.';
  end if;

  if p_decision = 'accept' then
    insert into public.transactions (child_id, parent_id, type, amount, category, reason, location, notes, date, time, created_by)
    values (t.child_id, t.parent_id, 'deposit', t.amount, null, t.name, '', t.description, v_date, v_time, 'parent')
    returning id into new_txn_id;

    update public.tasks
    set status = 'approved', transaction_id = new_txn_id, resolved_at = now()
    where id = p_task_id
    returning * into t;
  else
    update public.tasks
    set status = 'declined', resolved_at = now()
    where id = p_task_id
    returning * into t;
  end if;

  return t;
end; $$;

grant execute on function public.resolve_task(uuid, text, date, time) to authenticated;
