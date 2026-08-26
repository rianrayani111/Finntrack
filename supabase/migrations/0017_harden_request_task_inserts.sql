-- requests_insert_child (0011) and tasks_insert_parent (0010) pinned down WHO a
-- row may belong to and its starting status, but left every other column free.
-- A client posting directly to PostgREST could therefore insert a request that
-- already carries a transaction_id / task_id (pointing at any row it likes),
-- a resolved_at timestamp, or a multi-megabyte proof_photo_url -- none of which
-- the UI can produce, and none of which the resolve_* functions expect to find
-- already set on a 'pending' row.
--
-- Photos are stored inline as base64 data URLs (src/lib/image.js caps them at
-- 700_000 chars before upload), so an uncapped column is also the cheapest way
-- for one account to bloat every list query for its whole family. The ceiling
-- here sits just above the client's cap rather than at it, so a legitimate
-- photo that compresses to just under the client limit can never be rejected
-- by a rounding difference.

-- Enforced in the RLS policies rather than as table CHECK constraints: a table
-- constraint is validated against existing rows at ALTER time, and this is a
-- live database whose history predates the rule.
create or replace function public.finn_proof_len_ok(p_value text)
returns boolean language sql immutable set search_path = public as $$
  select p_value is null or length(p_value) <= 800000;
$$;

alter policy requests_insert_child on public.requests with check (
  child_id = auth.uid()
  and status = 'pending'
  and parent_id = (select parent_id from public.profiles where id = auth.uid())
  -- Only the resolve_request() SECURITY DEFINER function may ever set these.
  and transaction_id is null
  and task_id is null
  and resolved_at is null
  and length(description) <= 2000
  and (proof_text is null or length(proof_text) <= 2000)
  and public.finn_proof_len_ok(proof_photo_url)
);

alter policy tasks_insert_parent on public.tasks with check (
  parent_id = auth.uid()
  and status = 'assigned'
  and child_id in (select id from public.profiles where parent_id = auth.uid())
  -- A freshly assigned task has not been submitted, proved, or paid out yet;
  -- submit_task() and resolve_task() are the only writers of these.
  and proof_text is null
  and proof_photo_url is null
  and transaction_id is null
  and submitted_at is null
  and resolved_at is null
  and length(name) <= 200
  and length(description) <= 2000
);

-- submit_task runs SECURITY DEFINER and so bypasses RLS entirely -- the cap
-- above would not apply to the child's proof photo without this.
create or replace function public.submit_task(p_task_id uuid, p_proof_text text, p_proof_photo_url text)
returns public.tasks
language plpgsql security definer set search_path = public as $$
declare
  t public.tasks;
begin
  if not public.finn_proof_len_ok(p_proof_photo_url) then
    raise exception 'That photo is too large.';
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
