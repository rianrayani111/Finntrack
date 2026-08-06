-- Tasks: a parent assigns a paid chore to one of their children. The child
-- marks it complete (optionally attaching proof — free text and/or a photo)
-- which sends it back to the parent for approval; accepting deposits the
-- reward into the child's account exactly like resolve_money_request does.

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references public.profiles(id) on delete cascade,
  child_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  description text not null,
  amount numeric(12,2) not null check (amount > 0),
  status text not null default 'assigned' check (status in ('assigned','submitted','approved','declined')),
  proof_text text,
  proof_photo_url text,
  transaction_id uuid references public.transactions(id) on delete set null,
  created_at timestamptz not null default now(),
  submitted_at timestamptz,
  resolved_at timestamptz
);
create index tasks_parent_id_idx on public.tasks (parent_id);
create index tasks_child_id_idx on public.tasks (child_id);

alter table public.tasks enable row level security;

-- Read: parent sees tasks for any of their children, child sees only their own.
create policy tasks_select_own on public.tasks for select
  using (parent_id = auth.uid() or child_id = auth.uid());

-- Insert: a parent assigns a task to one of their own children.
create policy tasks_insert_parent on public.tasks for insert with check (
  parent_id = auth.uid() and status = 'assigned'
  and child_id in (select id from public.profiles where parent_id = auth.uid())
);

-- Delete: a parent can permanently remove a task they set as long as it
-- hasn't been approved yet (an approved task already paid out a real
-- transaction, so it stays around like every other transaction).
create policy tasks_delete_parent on public.tasks for delete using (
  parent_id = auth.uid() and status <> 'approved'
);

-- No client update policy: status/proof/transaction_id only ever change
-- through the two SECURITY DEFINER functions below, so a child can't
-- self-approve and a parent can't tamper with submitted proof.

-- Child marks an assigned task complete, optionally attaching proof.
create or replace function public.submit_task(p_task_id uuid, p_proof_text text, p_proof_photo_url text)
returns public.tasks
language plpgsql security definer set search_path = public as $$
declare
  t public.tasks;
begin
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

-- Parent approves or declines a submitted task. 'accept' inserts a matching
-- deposit transaction for the child (the reward actually lands in their
-- account) and points the task at it; 'decline' just marks it declined so
-- the parent can review/delete it later. Guarded so a task can only be
-- resolved once, by the parent it actually belongs to.
create or replace function public.resolve_task(p_task_id uuid, p_decision text)
returns public.tasks
language plpgsql security definer set search_path = public as $$
declare
  t public.tasks;
  new_txn_id uuid;
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
    values (t.child_id, t.parent_id, 'deposit', t.amount, null, t.name, '', t.description, current_date, localtime, 'parent')
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

grant execute on function public.resolve_task(uuid, text) to authenticated;
