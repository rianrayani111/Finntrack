-- Teacher sign-up, school creation, colleague invites and class creation.
--
-- A teacher can now start a school themselves, for free: the teacher-signup
-- edge function creates the school, makes them its admin, and gives them a
-- first class. Colleagues join that same school through its invite link, so
-- one school does not end up split across several sign-ups -- each teacher
-- keeps their own classes inside it, and every class is its own separate
-- economy.
--
-- Billing is deliberately absent. When plans and checkout are added, they
-- gate these same functions (seat limits, how many classes a plan allows);
-- nothing here has to be rebuilt for that.
--
-- New classes are not born empty: edu_seed_class_starter fills them with
-- example jobs and store items, because a teacher opening a blank class has
-- nothing to copy. They are ordinary rows -- edit or delete them freely.

-- ============================================================
-- School invite link
-- ============================================================

alter table public.schools
  -- Rotatable. Whoever holds it can create a TEACHER account in this school,
  -- so it is a credential: long, random, and replaceable if it leaks.
  add column teacher_invite_token text;

create unique index schools_invite_token_idx on public.schools (teacher_invite_token)
  where teacher_invite_token is not null;

create or replace function public.edu_generate_token(p_bytes int default 24)
returns text language sql security definer set search_path = public as $$
  select replace(replace(encode(extensions.gen_random_bytes(p_bytes), 'base64'), '/', '_'), '+', '-');
$$;

-- "Lincoln Middle School" -> LMS2026. Initials plus the year, which is what
-- staff will read off a board, with a numeric suffix if that is taken.
create or replace function public.edu_generate_school_passcode(p_school_name text)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_initials text;
  v_base text;
  v_code text;
  v_suffix int := 0;
begin
  select string_agg(left(word, 1), '')
  into v_initials
  from (
    select regexp_split_to_table(upper(regexp_replace(coalesce(p_school_name, ''), '[^a-zA-Z ]', '', 'g')), '\s+') as word
  ) w
  where word <> '';

  v_base := left(coalesce(nullif(v_initials, ''), 'SCH'), 4) || to_char(now(), 'YYYY');

  loop
    v_code := v_base || case when v_suffix = 0 then '' else v_suffix::text end;
    exit when not exists (select 1 from public.schools where upper(passcode) = v_code);
    v_suffix := v_suffix + 1;
    if v_suffix > 999 then
      raise exception 'Could not generate a unique school passcode.';
    end if;
  end loop;

  return v_code;
end; $$;

revoke execute on function public.edu_generate_token(int) from public, anon, authenticated;
revoke execute on function public.edu_generate_school_passcode(text) from public, anon, authenticated;

-- Every school gets an invite link the moment it exists, including ones
-- created by a script rather than by teacher-signup.
alter table public.schools alter column teacher_invite_token set default public.edu_generate_token(24);

-- ============================================================
-- Starter content for a new class
-- ============================================================

-- The examples a teacher sees on their first day: one of every store
-- category and a handful of jobs, priced the way the sketches show them.
create or replace function public.edu_seed_class_starter(p_class_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.edu_store_items where class_id = p_class_id)
     or exists (select 1 from public.edu_jobs where class_id = p_class_id) then
    return;
  end if;

  insert into public.edu_store_items
    (class_id, name, description, category, asset_kind, price, stock, per_student_limit,
     bond_term_days, bond_rate_pct, weekly_income)
  values
    (p_class_id, 'Teacher''s Chair for a Day',
     'Sit in the main rolling chair for the entire class period.', 'privilege', null, 50, 5, 1, null, null, 0),
    (p_class_id, '1-Night Homework Pass',
     'Skip one homework assignment.', 'privilege', null, 100, null, 1, null, null, 0),
    (p_class_id, 'VIP Ice Cold Juice Box',
     'A chilled juice box to enjoy during independent work time.', 'physical', null, 20, 10, 2, null, null, 0),
    (p_class_id, 'Mystery Prize Box',
     'A surprise prize from the teacher.', 'physical', null, 125, 1, 1, null, null, 0),
    (p_class_id, 'High-Yield Savings Bond',
     'Lend the classroom bank your EduBucks and earn interest every payday.',
     'financial', 'bond', 100, null, 1, 35, 25, 0),
    (p_class_id, 'Desk Property Deed',
     'Own your desk instead of renting it.', 'financial', 'property', 100, 2, 1, null, null, 10),
    (p_class_id, 'Tech Startup Venture Fund',
     'High risk, high reward: it could crash, grow, or go public.',
     'financial', 'venture', 50, null, null, null, null, 0);

  insert into public.edu_jobs
    (class_id, title, icon, description, responsibilities, qualifications, weekly_salary)
  values
    (p_class_id, 'Tech Monitor', '💻', 'Charge iPads and make sure classroom tech is put away daily.',
     'Charge the iPads, tidy the tech station.', 'Honor roll / Math 85%+', 30),
    (p_class_id, 'Station Engineer', '🧽', 'Wipe down whiteboards and sanitize desks at the end of the day.',
     'Clean the stations at the end of each day.', 'Passed quiz', 25),
    (p_class_id, 'Librarian', '📚', 'Keep the class library organized and log borrowed books.',
     'Log borrowed books, shelve returns.', 'N/A', 30),
    (p_class_id, 'Paper Passer', '📄', 'Hand out and collect class papers.',
     'Hand out weekly quizzes, collect the homework bin.', 'N/A', 15),
    (p_class_id, 'Bank Teller', '🏦', 'Help classmates with deposits and withdrawals.',
     'Record deposits and withdrawals at the class bank.', 'Math 85%+', 22);

  insert into public.edu_charges (class_id, name, amount)
  values (p_class_id, 'Desk Rent Fee', 20);
end; $$;

revoke execute on function public.edu_seed_class_starter(uuid) from public, anon, authenticated;

-- ============================================================
-- Educator helpers and class management
-- ============================================================

create or replace function public.edu_require_educator(
  out o_educator_id uuid,
  out o_school_id uuid,
  out o_role text
)
language plpgsql stable security definer set search_path = public as $$
begin
  select e.id, e.school_id, e.role into o_educator_id, o_school_id, o_role
  from public.educators e where e.id = auth.uid();
  if o_educator_id is null then
    raise exception 'Only teacher accounts can do this.' using errcode = '42501';
  end if;
end; $$;

revoke execute on function public.edu_require_educator() from public, anon, authenticated;

create or replace function public.edu_create_class(
  p_name text,
  p_grade_level text default null,
  p_timezone text default 'UTC',
  p_seat_limit int default 30
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_me uuid;
  v_school uuid;
  v_role text;
  v_name text := trim(coalesce(p_name, ''));
  v_class public.classes;
begin
  select o_educator_id, o_school_id, o_role into v_me, v_school, v_role
  from public.edu_require_educator();

  if char_length(v_name) < 1 or char_length(v_name) > 80 then
    raise exception 'Give the class a name between 1 and 80 characters.';
  end if;
  if p_seat_limit is null or p_seat_limit < 1 or p_seat_limit > 500 then
    raise exception 'Seats must be between 1 and 500.';
  end if;

  insert into public.classes (school_id, educator_id, name, grade_level, timezone, seat_limit)
  values (v_school, v_me, v_name, nullif(trim(p_grade_level), ''), coalesce(nullif(trim(p_timezone), ''), 'UTC'), p_seat_limit)
  returning * into v_class;

  perform public.edu_seed_class_starter(v_class.id);

  return jsonb_build_object('classId', v_class.id, 'classCode', v_class.code, 'name', v_class.name);
end; $$;

-- The caller must own the class, or be the school's admin.
create or replace function public.edu_can_manage_class(p_class_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.classes c
    join public.educators e on e.id = auth.uid()
    where c.id = p_class_id
      and c.school_id = e.school_id
      and (c.educator_id = e.id or e.role = 'admin')
  );
$$;

create or replace function public.edu_update_class(
  p_class_id uuid,
  p_name text default null,
  p_grade_level text default null,
  p_seat_limit int default null,
  p_join_open boolean default null,
  p_timezone text default null,
  p_currency_name text default null,
  p_savings_rate_pct numeric default null,
  p_payday_dow int default null,
  p_is_archived boolean default null
)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_taken int;
begin
  if not public.edu_can_manage_class(p_class_id) then
    raise exception 'That class is not yours.' using errcode = '42501';
  end if;

  if p_seat_limit is not null then
    select count(*) into v_taken from public.students where class_id = p_class_id;
    if p_seat_limit < v_taken then
      raise exception 'This class already has % students. Seats cannot be fewer than that.', v_taken;
    end if;
    if p_seat_limit > 500 then
      raise exception 'Seats must be 500 or fewer.';
    end if;
  end if;

  update public.classes set
    name = coalesce(nullif(trim(p_name), ''), name),
    grade_level = coalesce(nullif(trim(p_grade_level), ''), grade_level),
    seat_limit = coalesce(p_seat_limit, seat_limit),
    join_open = coalesce(p_join_open, join_open),
    timezone = coalesce(nullif(trim(p_timezone), ''), timezone),
    currency_name = coalesce(nullif(trim(p_currency_name), ''), currency_name),
    savings_rate_pct = coalesce(p_savings_rate_pct, savings_rate_pct),
    payday_dow = coalesce(p_payday_dow, payday_dow),
    is_archived = coalesce(p_is_archived, is_archived)
  where id = p_class_id;
end; $$;

-- Admin only: the invite link colleagues use, and the school passcode.
create or replace function public.edu_school_settings()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_me uuid;
  v_school uuid;
  v_role text;
  v_result jsonb;
begin
  select o_educator_id, o_school_id, o_role into v_me, v_school, v_role
  from public.edu_require_educator();

  select jsonb_build_object(
    'schoolId', s.id,
    'schoolName', s.name,
    'plan', s.plan,
    'passcode', s.passcode,
    'isAdmin', v_role = 'admin',
    'inviteToken', case when v_role = 'admin' then s.teacher_invite_token end,
    'teacherCount', (select count(*) from public.educators e where e.school_id = s.id),
    'classCount', (select count(*) from public.classes c where c.school_id = s.id and not c.is_archived),
    'studentCount', (
      select count(*) from public.students st
      join public.classes c on c.id = st.class_id
      where c.school_id = s.id
    )
  )
  into v_result
  from public.schools s where s.id = v_school;

  return v_result;
end; $$;

create or replace function public.edu_rotate_school_secret(p_which text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_me uuid;
  v_school uuid;
  v_role text;
  v_value text;
begin
  select o_educator_id, o_school_id, o_role into v_me, v_school, v_role
  from public.edu_require_educator();
  if v_role <> 'admin' then
    raise exception 'Only the school admin can do this.' using errcode = '42501';
  end if;

  if p_which = 'passcode' then
    v_value := public.edu_generate_school_passcode((select name from public.schools where id = v_school));
    update public.schools set passcode = v_value where id = v_school;
    return jsonb_build_object('passcode', v_value);
  elsif p_which = 'invite' then
    v_value := public.edu_generate_token(24);
    update public.schools set teacher_invite_token = v_value where id = v_school;
    return jsonb_build_object('inviteToken', v_value);
  end if;

  raise exception 'Unknown setting.';
end; $$;

revoke execute on function public.edu_create_class(text, text, text, int) from public, anon;
revoke execute on function public.edu_can_manage_class(uuid) from public, anon;
revoke execute on function public.edu_update_class(uuid, text, text, int, boolean, text, text, numeric, int, boolean) from public, anon;
revoke execute on function public.edu_school_settings() from public, anon;
revoke execute on function public.edu_rotate_school_secret(text) from public, anon;

grant execute on function public.edu_create_class(text, text, text, int) to authenticated;
grant execute on function public.edu_can_manage_class(uuid) to authenticated;
grant execute on function public.edu_update_class(uuid, text, text, int, boolean, text, text, numeric, int, boolean) to authenticated;
grant execute on function public.edu_school_settings() to authenticated;
grant execute on function public.edu_rotate_school_secret(text) to authenticated;

-- Backfill: every existing school gets an invite link and a passcode.
update public.schools
set teacher_invite_token = coalesce(teacher_invite_token, public.edu_generate_token(24)),
    passcode = coalesce(passcode, public.edu_generate_school_passcode(name));
