-- A parent can require a receipt photo before their child's refund requests
-- can be accepted (set_child_refund_receipt_required, 0011). The only place
-- that was ever checked was client-side: requestApi.create in src/api/db.js
-- blocks SUBMITTING a refund request without a photo when the flag is set,
-- and Requests.jsx shows "(required)" in the UI. resolve_request -- the
-- function that actually pays out -- never looked at the flag at all. A
-- child bypassing the client (or hitting a race where the flag was set
-- AFTER an older request without a photo was already pending) could still
-- get that request accepted and paid with no receipt ever having existed,
-- silently defeating a control the parent explicitly turned on.
--
-- Enforced at the only point that actually matters -- ACCEPTING a refund --
-- rather than at insert time, so a parent can still see and decline
-- receipt-less requests (submitted before the flag was turned on, or by a
-- client that skipped the check) instead of them being invisible.

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
