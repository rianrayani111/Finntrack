import { corsHeaders, finalizeAccountOrDelete, HttpError, supabaseAdmin } from '../_shared/auth.ts';

// Free teacher sign-up, in two shapes:
//
//   * no invite token  -- starts a NEW school. The teacher becomes its admin,
//                         gets a school passcode, an invite link for
//                         colleagues, and a first class seeded with example
//                         jobs and store items.
//   * invite token     -- joins an EXISTING school as a teacher, so a school
//                         is never split across several sign-ups. No class is
//                         created; they make their own.
//
// There is no payment here on purpose: plans and checkout come later and will
// gate this same endpoint.
//
// Address format must match handle_new_user (0033) and teacherEmail() in
// src/api/education.js.
const TEACHER_EMAIL_DOMAIN = 'teacher.finntrack.local';
const USERNAME_PATTERN = /^[a-z0-9_.]{3,30}$/;
const MIN_PASSWORD_LENGTH = 8;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  let createdSchoolId: string | null = null;
  let createdUserId: string | null = null;

  try {
    const body = await req.json().catch(() => ({}));
    const inviteToken = String(body.inviteToken || '').trim();
    const schoolName = String(body.schoolName || '').trim();
    const displayName = String(body.displayName || '').trim();
    const displayTitle = String(body.displayTitle || '').trim();
    const username = String(body.username || '').trim().toLowerCase();
    const password = String(body.password || '');
    const contactEmail = String(body.contactEmail || '').trim().toLowerCase();
    const className = String(body.className || '').trim() || 'Period 1';
    const timezone = String(body.timezone || '').trim() || 'UTC';

    if (!USERNAME_PATTERN.test(username)) {
      throw new HttpError(
        400,
        'Your username can use lowercase letters, numbers, dots and underscores (3-30 characters).'
      );
    }
    if (!displayName) throw new HttpError(400, 'Enter your name.');
    if (password.length < MIN_PASSWORD_LENGTH) {
      throw new HttpError(400, `Your password needs at least ${MIN_PASSWORD_LENGTH} characters.`);
    }
    if (contactEmail && !EMAIL_PATTERN.test(contactEmail)) {
      throw new HttpError(400, 'That email address does not look right.');
    }

    let schoolId: string;
    let educatorRole: 'admin' | 'teacher';

    if (inviteToken) {
      const { data: school, error } = await supabaseAdmin
        .from('schools')
        .select('id')
        .eq('teacher_invite_token', inviteToken)
        .maybeSingle();
      if (error) throw new HttpError(500, error.message);
      if (!school) throw new HttpError(404, 'That invite link is no longer valid. Ask your school admin for a new one.');
      schoolId = school.id;
      educatorRole = 'teacher';
    } else {
      if (schoolName.length < 2) throw new HttpError(400, 'Enter your school name.');

      const { data: created, error } = await supabaseAdmin
        .from('schools')
        .insert({ name: schoolName, created_by_email: contactEmail || null })
        .select('id')
        .single();
      if (error) throw new HttpError(500, error.message);

      schoolId = created.id;
      createdSchoolId = created.id;
      educatorRole = 'admin';

      // Generated in the database so passcode and token rules live in one place.
      const [{ data: passcode }, { data: invite }] = await Promise.all([
        supabaseAdmin.rpc('edu_generate_school_passcode', { p_school_name: schoolName }),
        supabaseAdmin.rpc('edu_generate_token', { p_bytes: 24 }),
      ]);
      const { error: secretError } = await supabaseAdmin
        .from('schools')
        .update({ passcode, teacher_invite_token: invite })
        .eq('id', schoolId);
      if (secretError) throw new HttpError(500, secretError.message);
    }

    const syntheticEmail = `${username}.${schoolId.replaceAll('-', '')}@${TEACHER_EMAIL_DOMAIN}`;

    const { data: user, error: userError } = await supabaseAdmin.auth.admin.createUser({
      email: syntheticEmail,
      password,
      email_confirm: true,
      app_metadata: {
        role: 'educator',
        school_id: schoolId,
        username,
        educator_role: educatorRole,
        display_name: displayName,
        display_title: displayTitle || displayName,
        contact_email: contactEmail,
      },
    });

    if (userError) {
      const taken = /already been registered|duplicate key|unique constraint/i.test(userError.message);
      throw new HttpError(
        taken ? 409 : 400,
        taken ? 'That username is already taken at this school. Try another one.' : userError.message
      );
    }

    createdUserId = user!.user!.id;

    await finalizeAccountOrDelete(createdUserId, 'edu_finalize_educator', {
      p_user_id: createdUserId,
      p_school_id: schoolId,
      p_username: username,
      p_display_name: displayName,
      p_educator_role: educatorRole,
      p_display_title: displayTitle || displayName,
      p_contact_email: contactEmail,
    });

    // First class, only for a brand-new school: someone joining by invite
    // makes their own classes.
    let firstClass: { id: string; code: string } | null = null;
    if (!inviteToken) {
      const { data: klass, error: classError } = await supabaseAdmin
        .from('classes')
        .insert({ school_id: schoolId, educator_id: user!.user!.id, name: className, timezone })
        .select('id, code')
        .single();
      if (classError) throw new HttpError(500, classError.message);
      firstClass = klass;
      const { error: seedError } = await supabaseAdmin.rpc('edu_seed_class_starter', { p_class_id: klass.id });
      if (seedError) throw new HttpError(500, seedError.message);
    }

    const { data: school } = await supabaseAdmin
      .from('schools')
      .select('name, passcode')
      .eq('id', schoolId)
      .single();

    return new Response(
      JSON.stringify({
        schoolId,
        schoolName: school?.name,
        passcode: school?.passcode,
        username,
        role: educatorRole,
        classId: firstClass?.id ?? null,
        classCode: firstClass?.code ?? null,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    // Unwind a half-finished sign-up: an account whose school was rolled
    // back can never log in, and a school with no teacher in it is
    // unreachable for everyone, including whoever just tried to create it.
    if (createdUserId) {
      await supabaseAdmin.auth.admin.deleteUser(createdUserId);
    }
    if (createdSchoolId) {
      await supabaseAdmin.from('schools').delete().eq('id', createdSchoolId);
    }
    const status = err instanceof HttpError ? err.status : 500;
    const message = err instanceof Error ? err.message : 'Unexpected error.';
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
