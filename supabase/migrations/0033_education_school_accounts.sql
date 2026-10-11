-- School accounts, teacher logins and student self-join.
--
-- What changes from 0030:
--   Teachers log in with the SCHOOL PASSCODE + their username + password,
--   not an email. A teacher's real email is still kept (invites, receipts),
--   but it is contact detail, not a credential, so it never has to be typed
--   in front of a class. Their auth address is synthetic, like a student's:
--
--     <username>.<school id without dashes>@teacher.finntrack.local
--
--   Students log in with the CLASS CODE + username + password -- the school
--   name step is gone, so class codes are now unique across every school,
--   not just within one. Codes are generated here (6 characters, no
--   look-alikes) whenever a class is created, never typed by a person.
--
--   Students also JOIN THEMSELVES with the class code, up to the class's
--   seat limit, through the join-class edge function. Teachers can still
--   create accounts from the roster.
--
-- Class creation stays closed: there is no way for a teacher or admin to
-- create a class yet, because that belongs with the plans and checkout that
-- are not built. Classes come from the test-data script for now.

-- ============================================================
-- Schools: passcode and plan
-- ============================================================

alter table public.schools
  -- What a teacher types to reach their school's login. Not a secret from
  -- the staff who share it, and useless without a username and password.
  add column passcode text,
  add column plan text not null default 'per_student'
    check (plan in ('per_student', 'small_school', 'large_school')),
  add column created_by_email text;

create unique index schools_passcode_idx on public.schools (upper(passcode)) where passcode is not null;

-- ============================================================
-- Educators: username, admin vs teacher
-- ============================================================

alter table public.educators
  add column username text check (username ~ '^[a-z0-9_.]{3,30}$'),
  -- The person who bought the plan is the admin: they see every class in
  -- the school, invite teachers and reset the school passcode.
  add column role text not null default 'teacher' check (role in ('admin', 'teacher')),
  -- "Mr. Davis" -- what students see, as opposed to the full name.
  add column display_title text,
  add column contact_email text;

create unique index educators_school_username_idx on public.educators (school_id, lower(username))
  where username is not null;

-- ============================================================
-- Classes: global codes, generated on creation
-- ============================================================

drop index public.classes_school_code_idx;
create unique index classes_code_idx on public.classes (upper(code));

alter table public.classes
  add column grade_level text check (char_length(grade_level) <= 20),
  -- Each class names its own currency; every student page follows it.
  add column currency_name text not null default 'EduBucks'
    check (char_length(trim(currency_name)) between 1 and 20),
  add column seat_limit int not null default 30 check (seat_limit between 1 and 500),
  -- Students may sign themselves up with the class code while this is on
  -- and there are seats left.
  add column join_open boolean not null default true,
  add column is_archived boolean not null default false;

-- Ambiguous characters are left out (no 0/O, 1/I/L), because these codes get
-- read off a board and typed by children.
create or replace function public.edu_generate_class_code()
returns text language plpgsql security definer set search_path = public as $$
declare
  v_alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_code text;
  v_attempt int := 0;
begin
  loop
    v_code := '';
    for i in 1 .. 6 loop
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.classes where upper(code) = v_code);
    v_attempt := v_attempt + 1;
    if v_attempt > 50 then
      raise exception 'Could not generate a unique class code.';
    end if;
  end loop;
  return v_code;
end; $$;

revoke execute on function public.edu_generate_class_code() from public, anon, authenticated;

-- A class row never has to supply its own code.
alter table public.classes alter column code set default public.edu_generate_class_code();

-- ============================================================
-- Signup trigger: teacher usernames, student self-join
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

    -- Same contract as students: the login page rebuilds this address from
    -- the school passcode plus the username typed.
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

  else
    if new.email ilike '%@child.finntrack.local'
       or new.email ilike '%@student.finntrack.local'
       or new.email ilike '%@teacher.finntrack.local' then
      raise exception 'That email domain is reserved.' using errcode = '22023';
    end if;

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
  'Creates the profiles row (plus students/educators) for a new auth.users record. Role and every authorization field come ONLY from raw_app_meta_data, settable exclusively through the service-role admin API. A public signUp is always a parent. See 0029, 0030, 0033.';

-- ============================================================
-- Login lookups
-- ============================================================

-- Step one of student login/join: the class code alone identifies the class.
create or replace function public.edu_find_class(p_class_code text)
returns table (
  class_id uuid,
  class_name text,
  school_name text,
  allow_student_password_reset boolean,
  join_open boolean,
  seats_left int
)
language sql stable security definer set search_path = public as $$
  select
    c.id,
    c.name,
    s.name,
    s.allow_student_password_reset,
    c.join_open and not c.is_archived,
    greatest(c.seat_limit - (select count(*) from public.students st where st.class_id = c.id), 0)::int
  from public.classes c
  join public.schools s on s.id = c.school_id
  where upper(c.code) = upper(trim(p_class_code))
  limit 1;
$$;

-- The old two-argument version (school name + code) is gone: the login page
-- no longer asks for a school name.
drop function if exists public.edu_find_class(text, text);

revoke execute on function public.edu_find_class(text) from public;
grant execute on function public.edu_find_class(text) to anon, authenticated;

-- Step one of teacher login: the school passcode identifies the school.
create or replace function public.edu_find_school(p_passcode text)
returns table (school_id uuid, school_name text)
language sql stable security definer set search_path = public as $$
  select s.id, s.name
  from public.schools s
  where s.passcode is not null and upper(s.passcode) = upper(trim(p_passcode))
  limit 1;
$$;

revoke execute on function public.edu_find_school(text) from public;
grant execute on function public.edu_find_school(text) to anon, authenticated;

-- ============================================================
-- RLS for the new columns/rows
-- ============================================================

-- A policy on educators may not query educators: Postgres re-applies the
-- same policy to that subquery and the read fails with "infinite recursion
-- detected in policy". SECURITY DEFINER lookups break the cycle, which is
-- the pattern edu_my_class_id() (0030) already uses for students.
create or replace function public.edu_my_school_id()
returns uuid language sql stable security definer set search_path = public as $$
  select school_id from public.educators where id = auth.uid();
$$;

revoke execute on function public.edu_my_school_id() from public, anon;
grant execute on function public.edu_my_school_id() to authenticated;

-- Teachers see the other staff in their school (the admin dashboard's
-- teacher list); students never read this table.
create policy educators_select_school on public.educators for select using (
  school_id = public.edu_my_school_id()
);

-- Schools are readable by that school's staff only. 0030 let a student read
-- their own school row, which now carries the teacher passcode -- a student
-- knowing it could brute-force a teacher login. Students get the school name
-- through edu_my_summary (SECURITY DEFINER), so nothing is lost.
drop policy schools_select_member on public.schools;

create policy schools_select_staff on public.schools for select using (
  id = public.edu_my_school_id()
);

-- Every class in the school is visible to that school's staff: the admin
-- dashboard lists them all, and a teacher's sidebar lists their own.
create policy classes_select_school_staff on public.classes for select using (
  school_id = public.edu_my_school_id()
);
