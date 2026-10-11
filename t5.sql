-- @ backfill gave the test school a passcode and invite link
reset role; select name, passcode, length(teacher_invite_token) as token_len, plan from schools;
-- @ passcode generator shape
reset role; select public.edu_generate_school_passcode('Lincoln Middle School') as code, public.edu_generate_school_passcode('Lincoln Middle') as code2;
-- @ teacher creates a class, seeded with starter content
set role authenticated; set request.jwt.claim.sub = 'e0000000-0000-0000-0000-000000000003'; select public.edu_create_class('Period 1 Economics', '6-8', 'America/New_York', 24);
-- @ starter content landed
reset role; select (select count(*) from edu_store_items i join classes c on c.id=i.class_id where c.name='Period 1 Economics') as items, (select count(*) from edu_jobs j join classes c on c.id=j.class_id where c.name='Period 1 Economics') as jobs, (select count(*) from edu_charges ch join classes c on c.id=ch.class_id where c.name='Period 1 Economics') as charges;
-- @ codes are unique and 6 chars
reset role; select code, length(code) from classes order by created_at;
-- @ school settings for admin
set role authenticated; set request.jwt.claim.sub = 'e0000000-0000-0000-0000-000000000003'; select public.edu_school_settings();
-- @ seat limit cannot drop below enrolled
set role authenticated; set request.jwt.claim.sub = 'e0000000-0000-0000-0000-000000000003'; select public.edu_update_class('e0000000-0000-0000-0000-000000000002', p_seat_limit => 2);
-- @ seat limit raise works
set role authenticated; set request.jwt.claim.sub = 'e0000000-0000-0000-0000-000000000003'; select public.edu_update_class('e0000000-0000-0000-0000-000000000002', p_seat_limit => 40, p_currency_name => 'ClassCash'); reset role; select seat_limit, currency_name from classes where id='e0000000-0000-0000-0000-000000000002';
-- @ student cannot create a class
set role authenticated; set request.jwt.claim.sub = 'e0000000-0000-0000-0000-000000000011'; select public.edu_create_class('Hacker Class');
-- @ student cannot read invite token
set role authenticated; set request.jwt.claim.sub = 'e0000000-0000-0000-0000-000000000011'; select count(*) from schools;
-- @ rotate passcode + invite (admin)
set role authenticated; set request.jwt.claim.sub = 'e0000000-0000-0000-0000-000000000003'; select public.edu_rotate_school_secret('passcode'); select public.edu_rotate_school_secret('invite');
-- @ simulated teacher signup: new school + admin + class
reset role;
do $$
declare v_school uuid; v_user uuid := gen_random_uuid(); v_email text; v_class record;
begin
  insert into schools (name) values ('Oakwood High') returning id into v_school;
  update schools set passcode = public.edu_generate_school_passcode('Oakwood High'), teacher_invite_token = public.edu_generate_token(24) where id = v_school;
  v_email := 'jsmith.' || replace(v_school::text,'-','') || '@teacher.finntrack.local';
  insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data)
  values (v_user, v_email, jsonb_build_object('role','educator','school_id',v_school,'username','jsmith','educator_role','admin','display_name','Jane Smith','display_title','Ms. Smith','contact_email','jane@oakwood.edu'), '{}');
  insert into classes (school_id, educator_id, name) values (v_school, v_user, 'Period 1') returning * into v_class;
  perform public.edu_seed_class_starter(v_class.id);
end $$;
select s.name, s.passcode, e.username, e.role, p.email as contact, c.name as class_name, c.code from schools s join educators e on e.school_id=s.id join profiles p on p.id=e.id join classes c on c.school_id=s.id where s.name='Oakwood High';
-- @ new school sees only its own classes
set role authenticated; set request.jwt.claim.sub = (select id from educators where username='jsmith')::text; select count(*) as visible_classes from classes; select count(*) as visible_staff from educators;
