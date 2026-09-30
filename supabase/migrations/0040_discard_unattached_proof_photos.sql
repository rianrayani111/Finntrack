-- Requests.jsx and Tasks.jsx upload a proof photo first and only then save the
-- request or submit the task, because the row has to carry the photo's path
-- (and 0023 rejects a refund with no receipt at insert time). When that save
-- was refused -- receipt rule, a lapsed subscription, a validation limit --
-- the photo was already in the bucket with nothing pointing at it, and 0021
-- deliberately has no delete policy, so nobody could remove it. Every retry of
-- a failed submit left another stranded copy of a child's photo behind.
--
-- This adds the narrowest delete that fixes it. A user may delete a proof
-- photo only if:
--
--   * it is in their own folder (same test as 0021's insert policy), and
--   * no request and no task references it.
--
-- The second condition is what keeps 0021's guarantee intact: once a photo is
-- attached to a request or task it is immutable, exactly as before. The check
-- is a SECURITY DEFINER function so that it sees every row, not just the rows
-- RLS lets the caller see -- otherwise a child in a lapsed family, whose
-- requests are hidden from them by 0025, could delete a photo that is in fact
-- attached. It also makes a lost response harmless: if the insert committed
-- but the client never heard back and tries to discard the photo, the row now
-- references it and the delete is refused.
--
-- The lookups on proof_photo_url are unindexed on purpose: this only runs on
-- the failure path of a submit, which is rare, and an index would be paid for
-- on every photo insert instead.
--
-- Safe in either deploy order. Before this migration the client's discard is
-- refused by RLS and the photo stays where it would have stayed anyway; before
-- the client update, this policy simply goes unused.

create or replace function public.finn_proof_photo_is_discardable(p_path text)
returns boolean language sql stable security definer set search_path = public as $$
  select split_part(p_path, '/', 1) = auth.uid()::text
    and not exists (select 1 from public.requests where proof_photo_url = p_path)
    and not exists (select 1 from public.tasks where proof_photo_url = p_path);
$$;

comment on function public.finn_proof_photo_is_discardable(text) is
  'True only for a proof photo in the caller''s own folder that no request or task references. SECURITY DEFINER so a row hidden from the caller by RLS still counts as a reference. Backs the storage delete policy in 0040.';

-- The policy is evaluated as the querying user, so they need EXECUTE. It
-- answers only about paths in the caller's own folder, so probing it reveals
-- nothing about anyone else's photos.
revoke execute on function public.finn_proof_photo_is_discardable(text) from public, anon;
grant execute on function public.finn_proof_photo_is_discardable(text) to authenticated;

create policy "uploader can discard an unattached proof photo"
on storage.objects for delete to authenticated
using (
  bucket_id = 'proof-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
  and public.finn_proof_photo_is_discardable(name)
);
