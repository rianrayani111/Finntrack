-- finn_proof_len_ok (0017) only checked length. Nothing stopped a client from
-- posting an arbitrary external image URL as proof_photo_url instead of an
-- uploaded photo -- the app's own upload flow (compressImageFile in
-- src/lib/image.js) always produces a data:image/...;base64,... URL via
-- canvas.toDataURL(), so any http(s):// URL reaching this column had to come
-- from bypassing the UI and calling the API directly.
--
-- That matters because both proof_photo_url columns are rendered as <img src=...>
-- in the PARENT's browser during review (ParentRequests.jsx, ParentTasks.jsx).
-- An external URL there is a tracking vector: loading it leaks the reviewing
-- parent's IP address and browser fingerprint to whatever server the child
-- (or a compromised/malicious client) chose, at a time the parent doesn't
-- expect any network request to a third party at all.
--
-- Widen the same function both call sites already use to require the app's
-- own upload format -- a base64 data: URL -- rather than any remote reference.
-- Verified against the exact format canvas.toDataURL('image/jpeg', 0.6)
-- produces: "data:image/jpeg;base64,...".

create or replace function public.finn_proof_len_ok(p_value text)
returns boolean language sql immutable set search_path = public as $$
  select p_value is null
    or (
      length(p_value) <= 800000
      and p_value ~ '^data:image/[a-zA-Z0-9.+-]+;base64,'
    );
$$;

comment on function public.finn_proof_len_ok(text) is
  'True if p_value is null, or is a base64 data: image URL (the format the app''s own upload flow produces) no longer than 800000 chars. Rejects remote/external image URLs so a reviewing parent''s browser never loads a third-party URL as a side effect of opening a request or task.';

-- submit_task's failure message named only the length reason; it can now also
-- fail on format, so recreate it with a message that covers both without
-- being wrong about which one happened.
create or replace function public.submit_task(p_task_id uuid, p_proof_text text, p_proof_photo_url text)
returns public.tasks
language plpgsql security definer set search_path = public as $$
declare
  t public.tasks;
begin
  if not public.finn_proof_len_ok(p_proof_photo_url) then
    raise exception 'That photo could not be used. Please choose a photo to upload.';
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
