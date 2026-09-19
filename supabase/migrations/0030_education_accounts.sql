-- Schools & institutions: student and educator accounts.
--
-- These are a separate product line from families. A student is not a child
-- and an educator is not a parent: the roles never overlap, and every family
-- table stays unreachable for them because finn_caller_has_active_access()
-- (0025) resolves no paying parent for a student or educator.
--
-- Shape:
--   schools   -- the institution; owns the "students may reset their own
--                password" setting
--   educators -- one row per educator profile, tied to a school
--   classes   -- belongs to a school, optionally owned by an educator; its
--                code is what a student types at login, together with the
--                school name
--   students  -- one row per student profile, tied to exactly one class
--
-- Student login never exposes an email. Supabase Auth still needs one, so
-- every student gets a synthetic, undeliverable address built from their
-- username and their class id:
--
--   <username>.<class id without dashes>@student.finntrack.local
--
-- Usernames are unique per class (not globally), and the class id in the
-- address is what keeps two "alex" accounts in different classes apart. The
-- client rebuilds the address from the class it looked up (edu_find_class)
-- plus the username typed, exactly as the child login does with
-- child.finntrack.local.

-- ============================================================
-- Roles
-- ============================================================

alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('parent', 'child', 'student', 'educator'));

-- Students and educators never have a parent, and never use profiles.username:
-- that column carries a GLOBAL unique index (0001) meant for child logins,
-- while student usernames are only unique within a class (students.username).
alter table public.profiles drop constraint profiles_parent_shape;
alter table public.profiles add constraint profiles_parent_shape check (
  (role = 'parent' and parent_id is null and username is null and email is not null)
  or (role = 'child' and parent_id is not null and username is not null)
  or (role in ('student', 'educator') and parent_id is null and username is null)
);

-- ============================================================
-- Tables
-- ============================================================

create table public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 120),
  -- Off by default: a student who forgets their password asks the school.
  -- When on, students with a recovery_email on file may reset it themselves.
  allow_student_password_reset boolean not null default false,
  created_at timestamptz not null default now()
);
create index schools_name_lower_idx on public.schools (lower(trim(name)));

create table public.educators (
  id uuid primary key references public.profiles(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index educators_school_id_idx on public.educators (school_id);

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  educator_id uuid references public.educators(id) on delete set null,
  name text not null check (char_length(trim(name)) between 1 and 80),
  code text not null check (code ~ '^[A-Z0-9]{4,12}$'),
  -- Paydays, interest and streak days follow the class's local calendar, not
  -- the database server's UTC day.
  timezone text not null default 'UTC',
  created_at timestamptz not null default now()
);
create unique index classes_school_code_idx on public.classes (school_id, code);
create index classes_educator_id_idx on public.classes (educator_id);

-- A typo here would make every date calculation for the class throw, so
-- only real IANA zone names are accepted.
create or replace function public.edu_validate_class_timezone()
returns trigger language plpgsql set search_path = public as $$
begin
  if not exists (select 1 from pg_timezone_names where name = new.timezone) then
    raise exception 'Unknown timezone: %', new.timezone using errcode = '22023';
  end if;
  return new;
end; $$;

revoke execute on function public.edu_validate_class_timezone() from public, anon, authenticated;

create trigger classes_validate_timezone
  before insert or update of timezone on public.classes
  for each row execute function public.edu_validate_class_timezone();

create table public.students (
  id uuid primary key references public.profiles(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  username text not null check (username ~ '^[a-z0-9_]{3,20}$'),
  student_number text check (char_length(student_number) <= 40),
  -- Only used when the school allows self-service password resets.
  recovery_email text check (char_length(recovery_email) <= 254),
  created_at timestamptz not null default now()
);
create unique index students_class_username_idx on public.students (class_id, username);
create index students_class_id_idx on public.students (class_id);

-- ============================================================
-- Signup trigger
-- ============================================================

-- Same trust model as 0029: role and every authorization-relevant field come
-- ONLY from raw_app_meta_data, which only the service-role admin API can set.
-- Student and educator accounts are created by the school (create-student-
-- account, or by hand for now), never by a public signUp.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_role text := new.raw_app_meta_data->>'role';
  v_username text;
  v_class_id uuid;
begin
  if v_role = 'child' then
    -- Service-role path only (create-child-account). Unchanged from 0029.
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

    -- The login page rebuilds this address from class + username, so an
    -- account created with any other address could never log in. Fail loudly
    -- here rather than leave an unreachable student behind.
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
    insert into public.profiles (id, role, display_name, email, username, parent_id)
    values (
      new.id,
      'educator',
      coalesce(
        nullif(trim(new.raw_app_meta_data->>'display_name'), ''),
        split_part(new.email, '@', 1)
      ),
      new.email,
      null,
      null
    );
    insert into public.educators (id, school_id)
    values (new.id, (new.raw_app_meta_data->>'school_id')::uuid);

  else
    -- Every public signup, whatever its user_metadata claims to be.
    if new.email ilike '%@child.finntrack.local' or new.email ilike '%@student.finntrack.local' then
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
  'Creates the profiles row (plus the students/educators row) for a new auth.users record. Reads role and every authorization field ONLY from raw_app_meta_data, which is settable exclusively through the service-role admin API. Anything signing up through the public anon key becomes a parent regardless of the metadata it supplies. See 0029 and 0030.';

-- ============================================================
-- Helpers
-- ============================================================

-- The caller's class, or null if the caller is not a student. Used directly
-- in RLS policies, so it must stay granted to authenticated.
create or replace function public.edu_my_class_id()
returns uuid language sql stable security definer set search_path = public as $$
  select class_id from public.students where id = auth.uid();
$$;

create or replace function public.edu_is_class_educator(p_class_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.classes where id = p_class_id and educator_id = auth.uid()
  );
$$;

revoke execute on function public.edu_my_class_id() from public, anon;
revoke execute on function public.edu_is_class_educator(uuid) from public, anon;
grant execute on function public.edu_my_class_id() to authenticated;
grant execute on function public.edu_is_class_educator(uuid) to authenticated;

-- Step one of student login: the school name and class code a student types
-- resolve to a class. Callable without a session. Returns nothing about any
-- student -- only what the class login screen shows, plus whether the "forgot
-- password" link may offer a self-service reset.
create or replace function public.edu_find_class(p_school_name text, p_class_code text)
returns table (
  class_id uuid,
  class_name text,
  school_name text,
  allow_student_password_reset boolean
)
language sql stable security definer set search_path = public as $$
  select c.id, c.name, s.name, s.allow_student_password_reset
  from public.classes c
  join public.schools s on s.id = c.school_id
  where lower(trim(s.name)) = lower(trim(p_school_name))
    and c.code = upper(trim(p_class_code))
  limit 1;
$$;

revoke execute on function public.edu_find_class(text, text) from public;
grant execute on function public.edu_find_class(text, text) to anon, authenticated;

-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.schools enable row level security;
alter table public.educators enable row level security;
alter table public.classes enable row level security;
alter table public.students enable row level security;

-- No client INSERT/UPDATE/DELETE policies on any of these: rows are created
-- by the signup trigger or the service role, and student-editable fields are
-- written only through SECURITY DEFINER functions (0031).

create policy schools_select_member on public.schools for select using (
  id = (select c.school_id from public.classes c where c.id = public.edu_my_class_id())
  or id = (select e.school_id from public.educators e where e.id = auth.uid())
);

create policy educators_select_own on public.educators for select using (id = auth.uid());

create policy classes_select_member on public.classes for select using (
  id = public.edu_my_class_id() or educator_id = auth.uid()
);

create policy students_select_own on public.students for select using (id = auth.uid());
create policy students_select_educator on public.students for select using (
  public.edu_is_class_educator(class_id)
);
