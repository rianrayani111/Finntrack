-- resolve_request and resolve_task stamp their payout transaction with
-- current_date/localtime, which is the DATABASE server's clock (UTC on
-- Supabase) -- while every client-created transaction carries the USER's local
-- date and time. A parent in EDT accepting a request at 8:30pm on Aug 31
-- therefore produced a deposit dated Sep 1, so the child saw a deposit dated
-- "tomorrow", August's monthly summary excluded it, and month-boundary badge
-- math ran against the wrong month.
--
-- Both functions now accept the caller's local date/time, matching the
-- existing bump_daily_streak(p_today date) convention. Both params default to
-- the old server-clock values so any caller that omits them keeps working.
-- The 2-arg signatures are dropped first: leaving them in place alongside the
-- 4-arg versions would make a 2-arg call ambiguous ("function is not unique")
-- rather than resolving to either one.

drop function if exists public.resolve_request(uuid, text);

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
  v_date date := coalesce(p_date, current_date);
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

drop function if exists public.resolve_task(uuid, text);

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
  v_date date := coalesce(p_date, current_date);
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
