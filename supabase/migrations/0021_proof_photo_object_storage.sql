-- 0017/0019 fixed proof photos' correctness (size cap, upload-only format) but
-- not their architecture: they still live as base64 text inline in the
-- requests/tasks rows themselves, up to ~800000 chars each. 0020 stopped list
-- queries from downloading them all at once, but a single "View photo" click
-- still pulls the whole blob out of Postgres through PostgREST.
--
-- Move the bytes to Supabase Storage (an S3-compatible object store) and keep
-- only a short reference in the DB column. Reads go through short-lived signed
-- URLs generated on demand (see requestApi/taskApi.getProofPhoto in
-- src/api/db.js), so the actual image data never round-trips through Postgres
-- at all after upload.
--
-- Existing rows are untouched. Their proof_photo_url values are still raw
-- data:image/...;base64,... strings from before this migration -- the client
-- (resolveProofPhotoUrl in db.js) detects that format and renders it directly,
-- exactly as it always has. Nothing is backfilled, copied, or moved; this is a
-- forward-only change to how NEW photos are stored.

-- Private bucket: file_size_limit and allowed_mime_types are enforced by
-- Supabase Storage itself at upload time, independent of (and in addition to)
-- whatever the client-side compressor produces -- a client that skips the
-- app's own compression step still can't upload something huge or non-image.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('proof-photos', 'proof-photos', false, 1048576, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Objects are stored under {uploader_uid}/{uuid}.{ext} -- storage.foldername()
-- splits the object path on '/', so foldername(name)[1] is that uid segment.
-- Only children ever submit proof (refund requests, task completions), so
-- "own folder" is enough for insert; read access mirrors the existing
-- child-or-their-parent pattern used throughout requests/tasks RLS.
create policy "children upload proof photos to their own folder"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'proof-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "own or family can read proof photos"
on storage.objects for select to authenticated
using (
  bucket_id = 'proof-photos'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (
      select 1 from public.profiles p
      where p.id::text = (storage.foldername(name))[1]
        and p.parent_id = auth.uid()
    )
  )
);

-- No update/delete policies: proof photos are immutable once uploaded, same
-- as every other proof/receipt record in this app.

-- finn_proof_len_ok validated the OLD inline format (a data:image/...;base64,...
-- string under 800000 chars). Going forward, proof_photo_url holds a storage
-- object path instead, produced only by a real upload (src/api/db.js
-- storageApi.uploadProofPhoto). The format check here is a loose sanity bound,
-- not the real security boundary -- a client could still stuff an
-- arbitrary-but-matching path into the column directly via the API, but the
-- SELECT policy above is what actually gates whether createSignedUrl() can
-- resolve it to anything, so a forged path just fails to load rather than
-- exposing another family's photo.
create or replace function public.finn_proof_len_ok(p_value text)
returns boolean language sql immutable set search_path = public as $$
  select p_value is null
    or p_value ~ '^[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}\.(jpg|jpeg|png|webp)$';
$$;

comment on function public.finn_proof_len_ok(text) is
  'True if p_value is null, or matches the {uploader_uid}/{uuid}.{ext} object-path shape storageApi.uploadProofPhoto produces. The real access control is the storage.objects SELECT policy, not this format check.';
