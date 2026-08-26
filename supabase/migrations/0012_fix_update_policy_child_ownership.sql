-- transactions_update_parent and goals_update_parent only checked
-- parent_id = auth.uid() in their WITH CHECK clause, unlike their sibling
-- insert policies (transactions_insert_parent_deposit, goals_insert_parent),
-- which also verify the row's child_id belongs to that parent's family via
-- an exists(...) check against profiles. Without that check on update, a
-- parent could reassign an existing transaction or goal to ANY child_id in
-- the system (not just their own children) by updating child_id while
-- leaving parent_id untouched, since parent_id = auth.uid() alone still
-- passed. This brings both update policies in line with their insert
-- counterparts.

alter policy transactions_update_parent on public.transactions
  with check (
    parent_id = auth.uid()
    and exists (select 1 from public.profiles p where p.id = child_id and p.parent_id = auth.uid())
  );

alter policy goals_update_parent on public.goals
  with check (
    parent_id = auth.uid()
    and exists (select 1 from public.profiles p where p.id = child_id and p.parent_id = auth.uid())
  );
