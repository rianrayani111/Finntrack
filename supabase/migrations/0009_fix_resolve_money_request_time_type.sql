-- Fix resolve_money_request(): to_char(now(), 'HH24:MI') produces a text
-- value, and there is no implicit/assignment cast from text to the
-- transactions.time column (time without time zone), so accepting a request
-- failed with "column "time" is of type time without time zone but
-- expression is of type text". `localtime` is already the right type.

create or replace function public.resolve_money_request(p_request_id uuid, p_decision text)
returns public.money_requests
language plpgsql security definer set search_path = public as $$
declare
  req public.money_requests;
  new_txn_id uuid;
begin
  if p_decision not in ('accept', 'decline') then
    raise exception 'Invalid decision.';
  end if;

  select * into req from public.money_requests where id = p_request_id for update;
  if not found then
    raise exception 'Request not found.';
  end if;
  if req.parent_id <> auth.uid() then
    raise exception 'Not authorized to resolve this request.';
  end if;
  if req.status <> 'pending' then
    raise exception 'This request has already been resolved.';
  end if;

  if p_decision = 'accept' then
    insert into public.transactions (child_id, parent_id, type, amount, category, reason, location, notes, date, time, created_by)
    values (req.child_id, req.parent_id, 'deposit', req.amount, null, req.description, '', '', current_date, localtime, 'parent')
    returning id into new_txn_id;

    update public.money_requests
    set status = 'accepted', transaction_id = new_txn_id, resolved_at = now()
    where id = p_request_id
    returning * into req;
  else
    update public.money_requests
    set status = 'declined', resolved_at = now()
    where id = p_request_id
    returning * into req;
  end if;

  return req;
end; $$;

grant execute on function public.resolve_money_request(uuid, text) to authenticated;
