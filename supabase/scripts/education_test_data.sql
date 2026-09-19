-- Test data for the student portal: one school, one class, one teacher and
-- four students with a small working economy. NOT a migration -- run it by
-- hand in the Supabase SQL editor, once, after 0030-0032.
--
-- Logins it creates
--   Student login -> School: Lincoln Middle   Class ID: RIAN1G
--     usernames alex, jordan, sam, taylor    password: finntrack123
--   Teacher login -> teacher.test@finntrack.local   password: finntrack123
--
-- Accounts are inserted straight into auth.users with their role in
-- raw_app_meta_data, which is what the school-side account creation will do
-- through the admin API later (create-student-account). handle_new_user then
-- creates the profiles/students/educators rows as it would for real.
--
-- Safe to re-run: it does nothing if the test school already exists. To
-- start over, delete the four students' and the teacher's auth users
-- (Authentication -> Users) and then: delete from public.schools where id = 'e0000000-0000-0000-0000-000000000001';

do $$
declare
  v_school uuid := 'e0000000-0000-0000-0000-000000000001';
  v_class uuid := 'e0000000-0000-0000-0000-000000000002';
  v_teacher uuid := 'e0000000-0000-0000-0000-000000000003';
  v_password text := 'finntrack123';
  v_students text[][] := array[
    array['e0000000-0000-0000-0000-000000000011', 'alex', 'Alex C.', '1042'],
    array['e0000000-0000-0000-0000-000000000012', 'jordan', 'Jordan K.', '1043'],
    array['e0000000-0000-0000-0000-000000000013', 'sam', 'Sam R.', '1044'],
    array['e0000000-0000-0000-0000-000000000014', 'taylor', 'Taylor B.', '1045']
  ];
  v_alex uuid := 'e0000000-0000-0000-0000-000000000011';
  v_jordan uuid := 'e0000000-0000-0000-0000-000000000012';
  v_sam uuid := 'e0000000-0000-0000-0000-000000000013';
  v_taylor uuid := 'e0000000-0000-0000-0000-000000000014';
  v_id uuid;
  v_email text;
  v_hw_pass uuid;
  v_chair uuid;
  v_deed uuid;
  v_venture uuid;
  v_juice uuid;
  v_bond uuid;
  v_pen uuid;
  v_job_paper uuid;
  v_job_teller uuid;
  v_job_tech uuid;
  v_job_board uuid;
  v_holding uuid;
  i int;
begin
  if exists (select 1 from public.schools where id = v_school) then
    raise notice 'Test school already exists; nothing to do.';
    return;
  end if;

  insert into public.schools (id, name) values (v_school, 'Lincoln Middle');

  -- Teacher (must exist before the class that references it).
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) values (
    '00000000-0000-0000-0000-000000000000', v_teacher, 'authenticated', 'authenticated',
    'teacher.test@finntrack.local', extensions.crypt(v_password, extensions.gen_salt('bf')), now(),
    jsonb_build_object('provider', 'email', 'providers', array['email'],
      'role', 'educator', 'display_name', 'Ms. Frizzle', 'school_id', v_school),
    '{}'::jsonb, now(), now(), '', '', '', ''
  );
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (
    gen_random_uuid(), v_teacher, v_teacher::text,
    jsonb_build_object('sub', v_teacher::text, 'email', 'teacher.test@finntrack.local', 'email_verified', true),
    'email', now(), now(), now()
  );

  -- created_at is backdated so the most recent payday counts as "after the
  -- class existed" and the first page load pays out straight away.
  insert into public.classes (id, school_id, educator_id, name, code, timezone, savings_rate_pct, payday_dow, created_at)
  values (v_class, v_school, v_teacher, 'Period 3 - Social Studies', 'RIAN1G', 'America/New_York', 5, 5, now() - interval '21 days');

  for i in 1 .. array_length(v_students, 1) loop
    v_id := v_students[i][1]::uuid;
    v_email := v_students[i][2] || '.' || replace(v_class::text, '-', '') || '@student.finntrack.local';

    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
      v_email, extensions.crypt(v_password, extensions.gen_salt('bf')), now(),
      jsonb_build_object('provider', 'email', 'providers', array['email'],
        'role', 'student', 'class_id', v_class, 'username', v_students[i][2],
        'display_name', v_students[i][3], 'student_number', v_students[i][4]),
      '{}'::jsonb, now(), now(), '', '', '', ''
    );
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (
      gen_random_uuid(), v_id, v_id::text,
      jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true),
      'email', now(), now(), now()
    );
  end loop;

  update public.students set quote = 'Saving for the Deed', savings_goal_name = 'Desk Property Deed', savings_goal_amount = 200
  where id = v_alex;
  update public.students set quote = 'Grind never stops' where id = v_jordan;
  update public.students set quote = 'Tech = Easy EduBucks' where id = v_sam;
  update public.students set quote = 'Flipping items daily' where id = v_taylor;

  -- Class store
  insert into public.edu_store_items (class_id, name, description, category, price, stock, per_student_limit)
  values (v_class, 'Homework Pass for a Day', 'Skip one homework assignment.', 'privilege', 15, 5, 1)
  returning id into v_hw_pass;
  insert into public.edu_store_items (class_id, name, description, category, price, stock)
  values (v_class, 'Teacher''s Chair for a Day', 'Sit in the teacher''s chair for a whole day.', 'privilege', 12, 1)
  returning id into v_chair;
  insert into public.edu_store_items (class_id, name, description, category, asset_kind, price, stock, weekly_income)
  values (v_class, 'Desk Property Deed', 'Own a desk and collect rent every payday.', 'financial', 'property', 100, 2, 10)
  returning id into v_deed;
  insert into public.edu_store_items (class_id, name, description, category, asset_kind, price)
  values (v_class, 'Tech Startup Venture Fund', 'High risk: could crash, grow, or IPO. The teacher reveals the outcome.', 'financial', 'venture', 50)
  returning id into v_venture;
  insert into public.edu_store_items (class_id, name, description, category, price, stock)
  values (v_class, 'VIP Ice Cold Juice Box', 'One ice cold juice box.', 'physical', 5, 10)
  returning id into v_juice;
  insert into public.edu_store_items (class_id, name, description, category, asset_kind, price, bond_term_days, bond_rate_pct)
  values (v_class, 'High-Yield Savings Bond', 'Locked for 2 weeks, guaranteed 5% return.', 'financial', 'bond', 50, 14, 5)
  returning id into v_bond;
  -- Retired from the store: listing one needs teacher approval.
  insert into public.edu_store_items (class_id, name, description, category, price, stock, is_active)
  values (v_class, 'Mechanical Pen', 'A fancy mechanical pen.', 'physical', 8, 0, false)
  returning id into v_pen;

  -- Jobs
  insert into public.edu_jobs (class_id, title, icon, description, responsibilities, qualifications, next_task, weekly_salary)
  values (v_class, 'Paper Passer', '📄', 'Hand out and collect class papers.',
    'Hand out weekly quizzes, collect homework bins, organize desks.', 'N/A', 'Hand out Friday quizzes', 15)
  returning id into v_job_paper;
  insert into public.edu_jobs (class_id, title, icon, description, responsibilities, qualifications, weekly_salary)
  values (v_class, 'Bank Teller', '🏦', 'Help classmates with bank deposits.', 'Record deposits and withdrawals.', 'Math 85%+', 22)
  returning id into v_job_teller;
  insert into public.edu_jobs (class_id, title, icon, description, responsibilities, qualifications, weekly_salary)
  values (v_class, 'Tech Monitor', '💻', 'Charge iPads and make sure classroom tech is put away daily.', 'Charge iPads daily.', 'Honor roll / Math 85%+', 30)
  returning id into v_job_tech;
  insert into public.edu_jobs (class_id, title, icon, description, responsibilities, qualifications, weekly_salary)
  values (v_class, 'Station Engineer', '🧽', 'Wipe down whiteboards and sanitize desks at the end of the day.', 'Clean stations daily.', 'Passed quiz', 25)
  returning id into v_job_board;
  insert into public.edu_jobs (class_id, title, icon, description, responsibilities, qualifications, weekly_salary)
  values (v_class, 'Librarian', '📚', 'Keep the class library organized and log borrowed books.', 'Log borrowed books.', 'N/A', 15);

  insert into public.edu_job_assignments (class_id, job_id, student_id, starts_at, ends_at) values
    (v_class, v_job_paper, v_alex, now() - interval '14 days', now() + interval '28 days'),
    (v_class, v_job_teller, v_jordan, now() - interval '14 days', now() + interval '28 days'),
    (v_class, v_job_tech, v_sam, now() - interval '14 days', now() + interval '28 days'),
    (v_class, v_job_board, v_taylor, now() - interval '14 days', now() + interval '28 days');

  insert into public.edu_charges (class_id, name, amount) values (v_class, 'Desk Rent Fee', 5);

  -- Starting balances
  perform public.edu_post(v_alex, 'cash', 43, 'adjustment', 'Starting balance');
  perform public.edu_post(v_alex, 'savings', 55, 'adjustment', 'Starting balance');
  perform public.edu_post(v_jordan, 'cash', 30, 'adjustment', 'Starting balance');
  perform public.edu_post(v_jordan, 'savings', 60, 'adjustment', 'Starting balance');
  perform public.edu_post(v_sam, 'cash', 65, 'adjustment', 'Starting balance');
  perform public.edu_post(v_sam, 'savings', 100, 'adjustment', 'Starting balance');
  perform public.edu_post(v_taylor, 'cash', 80, 'adjustment', 'Starting balance');
  perform public.edu_post(v_taylor, 'savings', 40, 'adjustment', 'Starting balance');

  -- Holdings
  insert into public.edu_holdings (class_id, student_id, item_id, price_paid)
  values (v_class, v_alex, v_hw_pass, 15) returning id into v_holding;
  insert into public.edu_listings (class_id, seller_id, holding_id, item_id, sale_type, price)
  values (v_class, v_alex, v_holding, v_hw_pass, 'fixed', 18);
  update public.edu_holdings set status = 'listed' where id = v_holding;

  insert into public.edu_holdings (class_id, student_id, item_id, mode, price_paid)
  values (v_class, v_alex, v_juice, 'personal', 5);
  insert into public.edu_holdings (class_id, student_id, item_id, price_paid, matures_at, acquired_at)
  values (v_class, v_alex, v_bond, 50, now() + interval '10 days', now() - interval '4 days');
  insert into public.edu_holdings (class_id, student_id, item_id, price_paid)
  values (v_class, v_alex, v_pen, 8);

  insert into public.edu_holdings (class_id, student_id, item_id, price_paid) values (v_class, v_jordan, v_deed, 100);
  insert into public.edu_holdings (class_id, student_id, item_id, price_paid)
  select v_class, v_jordan, v_venture, 50 from generate_series(1, 2);
  insert into public.edu_holdings (class_id, student_id, item_id, price_paid, matures_at)
  select v_class, v_sam, v_bond, 50, now() + interval '7 days' from generate_series(1, 2);
  insert into public.edu_holdings (class_id, student_id, item_id, price_paid)
  select v_class, v_taylor, v_chair, 12 from generate_series(1, 1);

  -- A classmate's auction and a teacher auction, so there is something to bid on.
  insert into public.edu_holdings (class_id, student_id, item_id, price_paid)
  values (v_class, v_taylor, v_juice, 5) returning id into v_holding;
  insert into public.edu_listings (class_id, seller_id, holding_id, item_id, sale_type, price, duration_seconds)
  values (v_class, v_taylor, v_holding, v_juice, 'auction', 4, 3600);
  update public.edu_holdings set status = 'listed' where id = v_holding;

  insert into public.edu_listings (class_id, seller_id, holding_id, item_id, sale_type, price, duration_seconds)
  values (v_class, null, null, v_chair, 'auction', 10, 86400);

  raise notice 'Test class created. School: Lincoln Middle, Class ID: RIAN1G.';
end $$;
