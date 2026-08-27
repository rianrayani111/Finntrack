-- requests.list() and tasks.list() select('*'), which pulls proof_photo_url
-- for every row -- up to ~800000 chars of base64 per photo (see 0017's cap).
-- A parent's Requests/Tasks list therefore downloads every proof photo in
-- their family's history on every visit, whether or not they ever open one.
--
-- Fix the query shape, not the storage: add a cheap generated boolean so list
-- queries can tell a row HAS a photo without pulling the photo itself, and let
-- the client fetch the actual proof_photo_url for one row on demand (see
-- requestApi.getProofPhoto / taskApi.getProofPhoto in src/api/db.js and the
-- new LazyProofPhoto component). Existing rows' has_proof_photo backfills
-- automatically from their current proof_photo_url -- no data is touched,
-- copied, or moved; this is purely an additional column.

alter table public.requests
  add column has_proof_photo boolean generated always as (proof_photo_url is not null) stored;

alter table public.tasks
  add column has_proof_photo boolean generated always as (proof_photo_url is not null) stored;

comment on column public.requests.has_proof_photo is
  'Generated from proof_photo_url so list queries can show "has a photo" without selecting the (up to ~800KB) photo itself.';
comment on column public.tasks.has_proof_photo is
  'Generated from proof_photo_url so list queries can show "has a photo" without selecting the (up to ~800KB) photo itself.';
