-- Money requests: a child asks their parent for a specific amount with a
-- description of what it's for; the parent accepts (which deposits the
-- amount into the child's account as a normal transaction) or declines.

create table public.money_requests (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references public.profiles(id) on delete cascade,
  child_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  description text not null,
  status text not null default 'pending' check (status in ('pending','accepted','declined')),
  transaction_id uuid references public.transactions(id) on delete set null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index money_requests_parent_id_idx on public.money_requests (parent_id);
create index money_requests_child_id_idx on public.money_requests (child_id);

alter table public.money_requests enable row level security;

-- Read: parent sees requests from any of their children, child sees only their own.
create policy money_requests_select_own on public.money_requests for select
  using (parent_id = auth.uid() or child_id = auth.uid());

-- Insert: a child creates a pending request for themself, addressed to their own parent.
create policy money_requests_insert_child on public.money_requests for insert with check (
  child_id = auth.uid() and status = 'pending'
  and parent_id = (select parent_id from public.profiles where id = auth.uid())
);

-- No client update/delete policy: the only writer of status/transaction_id is
-- the SECURITY DEFINER function below, so a parent can never tamper with the
-- amount, resolve someone else's request, or resolve the same request twice.

-- Resolves a pending request as the calling parent. 'accept' inserts a
-- matching deposit transaction for the child (so the money actually lands in
-- their account) and points the request at it; 'decline' just marks it
-- declined. Guarded so a request can only be resolved once, by the parent it
-- actually belongs to.
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
    values (req.child_id, req.parent_id, 'deposit', req.amount, null, req.description, '', '', current_date, to_char(now(), 'HH24:MI'), 'parent')
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
