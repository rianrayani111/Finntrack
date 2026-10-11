-- One-off update for a database that already ran education_test_data.sql
-- BEFORE migration 0033. Run it once, after 0033, in the Supabase SQL editor.
--
-- 0033 changed how teachers log in (school passcode + username, on a
-- synthetic @teacher.finntrack.local address) and how students find their
-- class (class code only). The existing test teacher was created with the
-- old shape, so without this it cannot log in at all.
--
-- After running it:
--   Student login -> class code RIAN1G, usernames alex/jordan/sam/taylor,
--                    password finntrack123
--   Teacher login -> passcode LMS2026, username mdavis, password finntrack123
--
-- Safe to re-run. A fresh database does not need it: the updated
-- education_test_data.sql already creates everything in the new shape.

do $$
declare
  v_school uuid := 'e0000000-0000-0000-0000-000000000001';
  v_class uuid := 'e0000000-0000-0000-0000-000000000002';
  v_teacher uuid := 'e0000000-0000-0000-0000-000000000003';
  v_email text;
begin
  if not exists (select 1 from public.schools where id = v_school) then
    raise notice 'Test school not found; nothing to update.';
    return;
  end if;

  update public.schools
  set passcode = coalesce(passcode, 'LMS2026'),
      plan = 'small_school'
  where id = v_school;

  update public.classes
  set grade_level = coalesce(grade_level, '6-8'),
      seat_limit = 30,
      join_open = true
  where id = v_class;

  update public.educators
  set username = coalesce(username, 'mdavis'),
      role = 'admin',
      display_title = coalesce(display_title, 'Mr. Davis'),
      contact_email = coalesce(contact_email, 'teacher.test@finntrack.local')
  where id = v_teacher;

  update public.profiles
  set display_name = 'Marcus Davis',
      email = 'teacher.test@finntrack.local'
  where id = v_teacher;

  -- The login page rebuilds this address from the passcode step plus the
  -- username typed, so the auth row has to match the new format exactly.
  v_email := 'mdavis.' || replace(v_school::text, '-', '') || '@teacher.finntrack.local';

  update auth.users
  set email = v_email,
      raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object(
        'role', 'educator', 'school_id', v_school, 'username', 'mdavis',
        'educator_role', 'admin', 'display_name', 'Marcus Davis',
        'display_title', 'Mr. Davis', 'contact_email', 'teacher.test@finntrack.local'
      )
  where id = v_teacher;

  update auth.identities
  set identity_data = coalesce(identity_data, '{}'::jsonb) || jsonb_build_object('email', v_email)
  where user_id = v_teacher;

  raise notice 'Updated. Teacher: passcode LMS2026, username mdavis. Students: class code RIAN1G.';
end $$;
