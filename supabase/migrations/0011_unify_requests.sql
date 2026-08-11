-- Unifies money requests, chore promises, and refund requests into a single
-- `requests` table (renamed from money_requests) distinguished by `type`, so
-- the child-side request page can show one Active/Closed list instead of
-- juggling separate money-request and task entities for things that all
-- start the same way: a child asking a parent for money.
--
-- 'money' and 'refund' behave exactly like the old money_requests flow: on
-- accept, a deposit transaction is created immediately. 'chore_promise' is
-- different — accepting it doesn't pay out yet, it spawns a row in the
-- existing `tasks` table so the child still has to submit proof of
-- completion and the parent still gives a final approval before payout,
-- matching how parent-assigned chores already work.

alter table public.money_requests rename to requests;
alter table public.requests rename constraint money_requests_pkey to requests_pkey;
alter index money_requests_parent_id_idx rename to requests_parent_id_idx;
alter index money_requests_child_id_idx rename to requests_child_id_idx;

alter table public.requests
  add column type text not null default 'money' check (type in ('money', 'chore_promise', 'refund')),
  add column due_date date,
  add column proof_text text,
  add column proof_photo_url text,
  add column task_id uuid references public.tasks(id) on delete set null;

alter table public.requests alter column type drop default;

-- Lets a parent require a receipt/photo before a given child's refund
-- requests can be accepted. Off by default, and only meaningful for
-- children (parents never carry this flag).
alter table public.profiles add column require_refund_receipt boolean not null default false;

drop policy money_requests_select_own on public.requests;
drop policy money_requests_insert_child on public.requests;

create policy requests_select_own on public.requests for select
  using (parent_id = auth.uid() or child_id = auth.uid());

create policy requests_insert_child on public.requests for insert with check (
  child_id = auth.uid() and status = 'pending'
  and parent_id = (select parent_id from public.profiles where id = auth.uid())
);

-- No client update/delete policy: the only writer of status/transaction_id/
-- task_id is the SECURITY DEFINER function below.

drop function public.resolve_money_request(uuid, text);

create or replace function public.resolve_request(p_request_id uuid, p_decision text)
returns public.requests
language plpgsql security definer set search_path = public as $$
declare
  req public.requests;
  new_txn_id uuid;
  new_task_id uuid;
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
    values (req.child_id, req.parent_id, 'deposit', req.amount, null, req.description, '', '', current_date, localtime, 'parent')
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

grant execute on function public.resolve_request(uuid, text) to authenticated;

-- Lets a parent turn the "require a receipt photo" flag on/off for one of
-- their own children. A plain client-side update isn't possible because
-- profiles_update_own only allows a row to update itself.
create or replace function public.set_child_refund_receipt_required(p_child_id uuid, p_required boolean)
returns public.profiles
language plpgsql security definer set search_path = public as $$
declare
  child public.profiles;
begin
  select * into child from public.profiles where id = p_child_id for update;
  if not found or child.parent_id <> auth.uid() then
    raise exception 'Not authorized to update this child.';
  end if;

  update public.profiles set require_refund_receipt = p_required where id = p_child_id
  returning * into child;

  return child;
end; $$;

grant execute on function public.set_child_refund_receipt_required(uuid, boolean) to authenticated;
