-- SubscriptionGate.jsx locks the ENTIRE authenticated app behind a paywall
-- screen whenever a family's subscription isn't active -- but that is a
-- client-side check on a client-callable API. No RLS policy anywhere ever
-- referenced the subscriptions table. Verified by grep across every
-- migration: zero matches. A parent whose subscription lapsed (or who never
-- started paying, if they already had a child from before this app required
-- it) could keep reading and writing transactions, goals, requests, and
-- tasks indefinitely via a direct PostgREST call with their still-valid
-- session token -- the UI lockout was cosmetic, not a real boundary.
--
-- This closes that gap at the RLS layer (the tables) AND inside the three
-- SECURITY DEFINER functions that mutate the same data while bypassing RLS
-- entirely (resolve_request, resolve_task, submit_task).
--
-- The logic mirrors AuthContext.jsx's existing hasActiveAccess EXACTLY: base
-- plan active, and (this is the family's only child OR the addon plan is
-- also active). That business logic already exists and is already trusted
-- to gate the UI -- this migration is the same rule, just also enforced
-- where it was previously only decorative.

create or replace function public.finn_family_has_active_access(p_family_parent_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select
    coalesce(base.status, 'none') = 'active'
    and (
      (select count(*) from public.profiles c where c.parent_id = p_family_parent_id) <= 1
      or coalesce(addon.status, 'none') = 'active'
    )
  from (select p_family_parent_id as pid) t
  left join public.subscriptions base on base.parent_id = t.pid and base.plan_type = 'base'
  left join public.subscriptions addon on addon.parent_id = t.pid and addon.plan_type = 'addon';
$$;

comment on function public.finn_family_has_active_access(uuid) is
  'True if the given parent''s family currently has full paid access -- base plan active, and either only one child or the addon plan is also active. Same rule as AuthContext.jsx''s hasActiveAccess, now enforced server-side.';

-- Resolves "the paying parent" for the CALLER, whether the caller is a
-- parent or one of their children -- same coalesce pattern already used by
-- get_family_subscription_status (0007).
create or replace function public.finn_caller_has_active_access()
returns boolean language sql stable security definer set search_path = public as $$
  select public.finn_family_has_active_access(
    coalesce((select parent_id from public.profiles where id = auth.uid()), auth.uid())
  );
$$;

comment on function public.finn_caller_has_active_access() is
  'True if the calling user (parent or child) belongs to a family with active paid access. Used directly in RLS policies.';

grant execute on function public.finn_family_has_active_access(uuid) to authenticated;
grant execute on function public.finn_caller_has_active_access() to authenticated;

-- ============================================================
-- transactions
-- ============================================================

alter policy transactions_select_own on public.transactions
  using (
    (parent_id = auth.uid() or child_id = auth.uid())
    and public.finn_caller_has_active_access()
  );

alter policy transactions_insert_parent_deposit on public.transactions with check (
  type = 'deposit' and parent_id = auth.uid()
  and exists (select 1 from public.profiles p where p.id = child_id and p.parent_id = auth.uid())
  and public.finn_caller_has_active_access()
);

alter policy transactions_insert_child_withdrawal on public.transactions with check (
  type = 'withdrawal' and child_id = auth.uid()
  and parent_id = (select parent_id from public.profiles where id = auth.uid())
  and public.finn_caller_has_active_access()
);

alter policy transactions_update_parent on public.transactions
  using (parent_id = auth.uid())
  with check (
    parent_id = auth.uid()
    and exists (select 1 from public.profiles p where p.id = child_id and p.parent_id = auth.uid())
    and public.finn_caller_has_active_access()
  );

-- ============================================================
-- goals
-- ============================================================

alter policy goals_select_own on public.goals
  using (
    (parent_id = auth.uid() or child_id = auth.uid())
    and public.finn_caller_has_active_access()
  );

alter policy goals_insert_parent on public.goals with check (
  parent_id = auth.uid()
  and exists (select 1 from public.profiles p where p.id = child_id and p.parent_id = auth.uid())
  and public.finn_caller_has_active_access()
);

alter policy goals_update_parent on public.goals
  using (parent_id = auth.uid())
  with check (
    parent_id = auth.uid()
    and exists (select 1 from public.profiles p where p.id = child_id and p.parent_id = auth.uid())
    and public.finn_caller_has_active_access()
  );

alter policy goals_delete_parent on public.goals
  using (parent_id = auth.uid() and public.finn_caller_has_active_access());

-- ============================================================
-- requests
-- ============================================================

alter policy requests_select_own on public.requests
  using (
    (parent_id = auth.uid() or child_id = auth.uid())
    and public.finn_caller_has_active_access()
  );

alter policy requests_insert_child on public.requests with check (
  child_id = auth.uid()
  and status = 'pending'
  and parent_id = (select parent_id from public.profiles where id = auth.uid())
  and transaction_id is null
  and task_id is null
  and resolved_at is null
  and length(description) <= 2000
  and (proof_text is null or length(proof_text) <= 2000)
  and public.finn_proof_len_ok(proof_photo_url)
  and public.finn_caller_has_active_access()
);

-- ============================================================
-- tasks
-- ============================================================

alter policy tasks_select_own on public.tasks
  using (
    (parent_id = auth.uid() or child_id = auth.uid())
    and public.finn_caller_has_active_access()
  );

alter policy tasks_insert_parent on public.tasks with check (
  parent_id = auth.uid() and status = 'assigned'
  and child_id in (select id from public.profiles where parent_id = auth.uid())
  and proof_text is null
  and proof_photo_url is null
  and transaction_id is null
  and submitted_at is null
  and resolved_at is null
  and length(name) <= 200
  and length(description) <= 2000
  and public.finn_caller_has_active_access()
);

alter policy tasks_delete_parent on public.tasks
  using (
    parent_id = auth.uid() and status <> 'approved'
    and public.finn_caller_has_active_access()
  );

-- ============================================================
-- alerts
-- ============================================================

alter policy alerts_select_parent on public.alerts
  using (parent_id = auth.uid() and public.finn_caller_has_active_access());

alter policy alerts_update_parent on public.alerts
  using (parent_id = auth.uid())
  with check (
    parent_id = auth.uid()
    and public.finn_caller_has_active_access()
  );

-- ============================================================
-- SECURITY DEFINER functions -- these bypass table RLS entirely, so the
-- checks above don't reach them. Recreated with an explicit access check as
-- their first real action (after the usual not-found/ownership/status
-- guards, so a lapsed family still gets a clear reason rather than a
-- generic "not found").
-- ============================================================

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
  v_require_receipt boolean;
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
  if not public.finn_caller_has_active_access() then
    raise exception 'An active FinnTrack subscription is required.';
  end if;

  if p_decision = 'accept' and req.type = 'refund' then
    select require_refund_receipt into v_require_receipt
    from public.profiles where id = req.child_id;
    if v_require_receipt and req.proof_photo_url is null then
      raise exception 'This child''s account requires a receipt photo for refund requests. Decline this request, or ask them to resubmit one with a photo.';
    end if;
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
  if not public.finn_caller_has_active_access() then
    raise exception 'An active FinnTrack subscription is required.';
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

create or replace function public.submit_task(p_task_id uuid, p_proof_text text, p_proof_photo_url text)
returns public.tasks
language plpgsql security definer set search_path = public as $$
declare
  t public.tasks;
begin
  if not public.finn_proof_len_ok(p_proof_photo_url) then
    raise exception 'That photo could not be used. Please choose a photo to upload.';
  end if;
  if p_proof_text is not null and length(p_proof_text) > 2000 then
    raise exception 'That proof note is too long.';
  end if;

  select * into t from public.tasks where id = p_task_id for update;
  if not found then
    raise exception 'Task not found.';
  end if;
  if t.child_id <> auth.uid() then
    raise exception 'Not authorized to submit this task.';
  end if;
  if t.status <> 'assigned' then
    raise exception 'This task cannot be submitted right now.';
  end if;
  if not public.finn_caller_has_active_access() then
    raise exception 'An active FinnTrack subscription is required.';
  end if;

  update public.tasks
  set status = 'submitted',
      proof_text = nullif(trim(coalesce(p_proof_text, '')), ''),
      proof_photo_url = nullif(trim(coalesce(p_proof_photo_url, '')), ''),
      submitted_at = now()
  where id = p_task_id
  returning * into t;

  return t;
end; $$;

grant execute on function public.submit_task(uuid, text, text) to authenticated;
