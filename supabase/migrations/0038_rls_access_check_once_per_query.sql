-- The subscription gate added in 0025 made every family-data read slower in
-- proportion to how much data the family has.
--
-- finn_caller_has_active_access() is SECURITY DEFINER, so Postgres cannot
-- inline it into the query. Called bare inside a policy's USING clause, it is
-- re-executed for every candidate row -- and each execution runs a count(*)
-- over profiles plus two subscriptions lookups. A child with 2,000 logged
-- transactions paid for 2,000 of those on every Dashboard and History load.
-- auth.uid() has the same shape on a smaller scale: it re-reads and parses
-- the JWT claims setting per row.
--
-- Wrapping a call as (select f()) turns it into an uncorrelated scalar
-- subquery, which the planner evaluates once per statement as an InitPlan and
-- then reuses. When the access check is false, the plan can also short-circuit
-- to a one-time "false" filter and scan nothing at all. This is Supabase's own
-- documented RLS performance pattern. The semantics are identical: every
-- expression below is 0025's text with only the wrapping added -- no clause is
-- added, removed or reordered. All 15 policies were last defined in 0025.
--
-- Separately, profiles.parent_id had no index. The access check's
-- count(*) ... where parent_id = X therefore scanned the whole profiles table
-- -- once per row before this migration, once per statement after it, but a
-- full scan on every API request either way, growing with every child who
-- signs up. The same column backs the parent_id -> profiles(id) ON DELETE
-- CASCADE foreign key, which needs an index to find a parent's children
-- without scanning, and every "children of this parent" lookup in the edge
-- functions (create-child-account, syncSubscriptionQuantity,
-- delete-own-account). Plain CREATE INDEX rather than CONCURRENTLY because
-- migrations run inside a transaction; at current table sizes the write lock
-- lasts milliseconds.

create index if not exists profiles_parent_id_idx on public.profiles (parent_id);

-- ============================================================
-- transactions
-- ============================================================

alter policy transactions_select_own on public.transactions
  using (
    (parent_id = (select auth.uid()) or child_id = (select auth.uid()))
    and (select public.finn_caller_has_active_access())
  );

alter policy transactions_insert_parent_deposit on public.transactions with check (
  type = 'deposit' and parent_id = (select auth.uid())
  and exists (select 1 from public.profiles p where p.id = child_id and p.parent_id = (select auth.uid()))
  and (select public.finn_caller_has_active_access())
);

alter policy transactions_insert_child_withdrawal on public.transactions with check (
  type = 'withdrawal' and child_id = (select auth.uid())
  and parent_id = (select parent_id from public.profiles where id = (select auth.uid()))
  and (select public.finn_caller_has_active_access())
);

alter policy transactions_update_parent on public.transactions
  using (parent_id = (select auth.uid()))
  with check (
    parent_id = (select auth.uid())
    and exists (select 1 from public.profiles p where p.id = child_id and p.parent_id = (select auth.uid()))
    and (select public.finn_caller_has_active_access())
  );

-- ============================================================
-- goals
-- ============================================================

alter policy goals_select_own on public.goals
  using (
    (parent_id = (select auth.uid()) or child_id = (select auth.uid()))
    and (select public.finn_caller_has_active_access())
  );

alter policy goals_insert_parent on public.goals with check (
  parent_id = (select auth.uid())
  and exists (select 1 from public.profiles p where p.id = child_id and p.parent_id = (select auth.uid()))
  and (select public.finn_caller_has_active_access())
);

alter policy goals_update_parent on public.goals
  using (parent_id = (select auth.uid()))
  with check (
    parent_id = (select auth.uid())
    and exists (select 1 from public.profiles p where p.id = child_id and p.parent_id = (select auth.uid()))
    and (select public.finn_caller_has_active_access())
  );

alter policy goals_delete_parent on public.goals
  using (parent_id = (select auth.uid()) and (select public.finn_caller_has_active_access()));

-- ============================================================
-- requests
-- ============================================================

alter policy requests_select_own on public.requests
  using (
    (parent_id = (select auth.uid()) or child_id = (select auth.uid()))
    and (select public.finn_caller_has_active_access())
  );

alter policy requests_insert_child on public.requests with check (
  child_id = (select auth.uid())
  and status = 'pending'
  and parent_id = (select parent_id from public.profiles where id = (select auth.uid()))
  and transaction_id is null
  and task_id is null
  and resolved_at is null
  and length(description) <= 2000
  and (proof_text is null or length(proof_text) <= 2000)
  and public.finn_proof_len_ok(proof_photo_url)
  and (select public.finn_caller_has_active_access())
);

-- ============================================================
-- tasks
-- ============================================================

alter policy tasks_select_own on public.tasks
  using (
    (parent_id = (select auth.uid()) or child_id = (select auth.uid()))
    and (select public.finn_caller_has_active_access())
  );

alter policy tasks_insert_parent on public.tasks with check (
  parent_id = (select auth.uid()) and status = 'assigned'
  and child_id in (select id from public.profiles where parent_id = (select auth.uid()))
  and proof_text is null
  and proof_photo_url is null
  and transaction_id is null
  and submitted_at is null
  and resolved_at is null
  and length(name) <= 200
  and length(description) <= 2000
  and (select public.finn_caller_has_active_access())
);

alter policy tasks_delete_parent on public.tasks
  using (
    parent_id = (select auth.uid()) and status <> 'approved'
    and (select public.finn_caller_has_active_access())
  );

-- ============================================================
-- alerts
-- ============================================================

alter policy alerts_select_parent on public.alerts
  using (parent_id = (select auth.uid()) and (select public.finn_caller_has_active_access()));

alter policy alerts_update_parent on public.alerts
  using (parent_id = (select auth.uid()))
  with check (
    parent_id = (select auth.uid())
    and (select public.finn_caller_has_active_access())
  );
