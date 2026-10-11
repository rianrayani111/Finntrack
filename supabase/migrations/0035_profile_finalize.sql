-- Profiles for admin-created accounts are now created by an explicit,
-- service-role-only step instead of by the signup trigger.
--
-- Why: 0029 moved child/student/educator signup onto raw_app_meta_data,
-- because user_metadata is attacker-controlled. That is still the right
-- trust boundary, but this project's GoTrue does not have app_metadata
-- populated yet when the auth.users INSERT trigger runs, so
-- handle_new_user saw no role at all and fell through to its public-signup
-- branch -- which correctly refuses the reserved login domains:
--
--   "Database error creating new user"
--   ... ERROR: That email domain is reserved. (SQLSTATE 22023)
--
-- Every account created through the admin API hit this: teacher sign-up,
-- student self-join, and PARENTS ADDING A CHILD.
--
-- The fix keeps the same trust boundary and stops depending on when
-- metadata lands:
--
--   * the trigger still honours raw_app_meta_data when it IS there, so
--     nothing that works today changes;
--   * for a reserved-domain address with no role yet, the trigger creates
--     NO profile row and lets the insert succeed;
--   * the edge function that created the account then calls one of the
--     finalize functions below, which re-derive everything, verify the
--     synthetic address matches the account they claim to be, and create
--     the profile. They are granted to service_role ONLY, so the anon key
--     still cannot mint a child, student or teacher -- the property 0029
--     was protecting.
--
-- An account whose finalize step fails has no profile, so it cannot log in
-- (db.auth.me returns null); the edge functions delete such accounts rather
-- than leave them behind.

-- ============================================================
-- Trigger: defer instead of rejecting
-- ============================================================

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_role text := new.raw_app_meta_data->>'role';
  v_username text;
  v_class_id uuid;
  v_school_id uuid;
begin
  if v_role = 'child' then
    insert into public.profiles (id, role, display_name, email, username, parent_id)
    values (
      new.id,
      'child',
      coalesce(
        nullif(trim(new.raw_app_meta_data->>'display_name'), ''),
        split_part(new.email, '@', 1)
      ),
      null,
      new.raw_app_meta_data->>'username',
      nullif(new.raw_app_meta_data->>'parent_id', '')::uuid
    );

  elsif v_role = 'student' then
    v_username := lower(trim(new.raw_app_meta_data->>'username'));
    v_class_id := nullif(new.raw_app_meta_data->>'class_id', '')::uuid;

    if new.email is distinct from
       v_username || '.' || replace(v_class_id::text, '-', '') || '@student.finntrack.local' then
      raise exception 'Student email does not match its username and class.' using errcode = '22023';
    end if;

    insert into public.profiles (id, role, display_name, email, username, parent_id)
    values (
      new.id,
      'student',
      coalesce(nullif(trim(new.raw_app_meta_data->>'display_name'), ''), v_username),
      null,
      null,
      null
    );
    insert into public.students (id, class_id, username, student_number, recovery_email)
    values (
      new.id,
      v_class_id,
      v_username,
      nullif(trim(new.raw_app_meta_data->>'student_number'), ''),
      nullif(lower(trim(new.raw_app_meta_data->>'recovery_email')), '')
    );

  elsif v_role = 'educator' then
    v_username := lower(trim(new.raw_app_meta_data->>'username'));
    v_school_id := nullif(new.raw_app_meta_data->>'school_id', '')::uuid;

    if new.email is distinct from
       v_username || '.' || replace(v_school_id::text, '-', '') || '@teacher.finntrack.local' then
      raise exception 'Teacher email does not match its username and school.' using errcode = '22023';
    end if;

    insert into public.profiles (id, role, display_name, email, username, parent_id)
    values (
      new.id,
      'educator',
      coalesce(nullif(trim(new.raw_app_meta_data->>'display_name'), ''), v_username),
      nullif(lower(trim(new.raw_app_meta_data->>'contact_email')), ''),
      null,
      null
    );
    insert into public.educators (id, school_id, username, role, display_title, contact_email)
    values (
      new.id,
      v_school_id,
      v_username,
      coalesce(nullif(new.raw_app_meta_data->>'educator_role', ''), 'teacher'),
      nullif(trim(new.raw_app_meta_data->>'display_title'), ''),
      nullif(lower(trim(new.raw_app_meta_data->>'contact_email')), '')
    );

  elsif new.email ilike '%@child.finntrack.local'
     or new.email ilike '%@student.finntrack.local'
     or new.email ilike '%@teacher.finntrack.local' then
    -- A reserved login domain with no role in app_metadata yet. Only the
    -- admin API can reach here: a public signUp to these domains is
    -- rejected below, because PostgREST and GoTrue refuse to accept
    -- app_metadata from a client, and the finalize functions that create
    -- the profile are granted to service_role only. Leave the profile to
    -- that step.
    return new;

  else
    insert into public.profiles (id, role, display_name, email, username, parent_id)
    values (
      new.id,
      'parent',
      coalesce(
        nullif(trim(new.raw_user_meta_data->>'display_name'), ''),
        split_part(new.email, '@', 1)
      ),
      new.email,
      null,
      null
    );
  end if;

  return new;
end; $$;

comment on function public.handle_new_user() is
  'Creates the profiles row for a new auth.users record. Uses raw_app_meta_data when present (0029/0033); for a reserved-domain address without it, creates nothing and leaves the profile to the service-role finalize functions (0035). A public signUp is always a parent, and can never use a reserved domain.';

-- ============================================================
-- Finalize functions (service_role only)
-- ============================================================

-- Shared guard: the account must exist and its login address must be
-- exactly the one this role/owner combination produces -- so a caller
-- cannot attach a student or teacher profile to somebody else's account.
--
-- Returns true when the profile still has to be created, false when the
-- trigger already made it (i.e. app_metadata WAS populated in time).
-- Finalizing is therefore safe to call either way, which matters because
-- whether the trigger sees the metadata is not ours to control.
create or replace function public.finn_account_needs_profile(p_user_id uuid, p_expected_email text)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_email text;
begin
  select email into v_email from auth.users where id = p_user_id;
  if v_email is null then
    raise exception 'That account does not exist.' using errcode = '22023';
  end if;
  if lower(v_email) is distinct from lower(p_expected_email) then
    raise exception 'That account does not match the login address it claims.' using errcode = '22023';
  end if;
  return not exists (select 1 from public.profiles where id = p_user_id);
end; $$;

create or replace function public.finn_finalize_child(
  p_user_id uuid,
  p_parent_id uuid,
  p_username text,
  p_display_name text
)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_username text := lower(trim(p_username));
begin
  if not public.finn_account_needs_profile(p_user_id, v_username || '@child.finntrack.local') then
    -- The trigger got there first; make sure it built the same account.
    if not exists (
      select 1 from public.profiles
      where id = p_user_id and role = 'child' and username = v_username and parent_id = p_parent_id
    ) then
      raise exception 'That account already belongs to someone else.' using errcode = '22023';
    end if;
    return;
  end if;

  if not exists (select 1 from public.profiles where id = p_parent_id and role = 'parent') then
    raise exception 'That parent account does not exist.' using errcode = '22023';
  end if;

  insert into public.profiles (id, role, display_name, email, username, parent_id)
  values (
    p_user_id,
    'child',
    coalesce(nullif(trim(p_display_name), ''), v_username),
    null,
    v_username,
    p_parent_id
  );
end; $$;

create or replace function public.edu_finalize_student(
  p_user_id uuid,
  p_class_id uuid,
  p_username text,
  p_display_name text,
  p_student_number text default null,
  p_recovery_email text default null
)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_username text := lower(trim(p_username));
begin
  if not public.finn_account_needs_profile(
    p_user_id,
    v_username || '.' || replace(p_class_id::text, '-', '') || '@student.finntrack.local'
  ) then
    if not exists (
      select 1 from public.students where id = p_user_id and class_id = p_class_id and username = v_username
    ) then
      raise exception 'That account already belongs to someone else.' using errcode = '22023';
    end if;
    return;
  end if;

  if not exists (select 1 from public.classes where id = p_class_id) then
    raise exception 'That class does not exist.' using errcode = '22023';
  end if;

  insert into public.profiles (id, role, display_name, email, username, parent_id)
  values (p_user_id, 'student', coalesce(nullif(trim(p_display_name), ''), v_username), null, null, null);

  insert into public.students (id, class_id, username, student_number, recovery_email)
  values (
    p_user_id,
    p_class_id,
    v_username,
    nullif(trim(p_student_number), ''),
    nullif(lower(trim(p_recovery_email)), '')
  );
end; $$;

create or replace function public.edu_finalize_educator(
  p_user_id uuid,
  p_school_id uuid,
  p_username text,
  p_display_name text,
  p_educator_role text default 'teacher',
  p_display_title text default null,
  p_contact_email text default null
)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_username text := lower(trim(p_username));
  v_role text := coalesce(nullif(trim(p_educator_role), ''), 'teacher');
begin
  if not public.finn_account_needs_profile(
    p_user_id,
    v_username || '.' || replace(p_school_id::text, '-', '') || '@teacher.finntrack.local'
  ) then
    if not exists (
      select 1 from public.educators where id = p_user_id and school_id = p_school_id and username = v_username
    ) then
      raise exception 'That account already belongs to someone else.' using errcode = '22023';
    end if;
    return;
  end if;

  if not exists (select 1 from public.schools where id = p_school_id) then
    raise exception 'That school does not exist.' using errcode = '22023';
  end if;
  if v_role not in ('admin', 'teacher') then
    raise exception 'Unknown teacher role.' using errcode = '22023';
  end if;

  insert into public.profiles (id, role, display_name, email, username, parent_id)
  values (
    p_user_id,
    'educator',
    coalesce(nullif(trim(p_display_name), ''), v_username),
    nullif(lower(trim(p_contact_email)), ''),
    null,
    null
  );

  insert into public.educators (id, school_id, username, role, display_title, contact_email)
  values (
    p_user_id,
    p_school_id,
    v_username,
    v_role,
    nullif(trim(p_display_title), ''),
    nullif(lower(trim(p_contact_email)), '')
  );
end; $$;

revoke execute on function public.finn_account_needs_profile(uuid, text) from public, anon, authenticated;
revoke execute on function public.finn_finalize_child(uuid, uuid, text, text) from public, anon, authenticated;
revoke execute on function public.edu_finalize_student(uuid, uuid, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.edu_finalize_educator(uuid, uuid, text, text, text, text, text) from public, anon, authenticated;

grant execute on function public.finn_finalize_child(uuid, uuid, text, text) to service_role;
grant execute on function public.edu_finalize_student(uuid, uuid, text, text, text, text) to service_role;
grant execute on function public.edu_finalize_educator(uuid, uuid, text, text, text, text, text) to service_role;
