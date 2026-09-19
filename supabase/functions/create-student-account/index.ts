import { corsHeaders, HttpError, requireEducator, supabaseAdmin } from '../_shared/auth.ts';

// School-side student account creation. Built ahead of the educator portal
// and DISABLED until then: it refuses every call unless the
// STUDENT_ACCOUNT_CREATION_ENABLED secret is set to "true". Until that
// portal exists, test students are created by supabase/scripts/
// education_test_data.sql.
//
// Keep the address format in sync with handle_new_user (0030) and
// studentEmail() in src/api/education.js -- the login page rebuilds it from
// the class and username, so all three must agree.
const STUDENT_EMAIL_DOMAIN = 'student.finntrack.local';
const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;
const MIN_STUDENT_PASSWORD_LENGTH = 8;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (Deno.env.get('STUDENT_ACCOUNT_CREATION_ENABLED') !== 'true') {
      throw new HttpError(503, 'Student account creation is not switched on yet.');
    }

    const { uid: educatorUid } = await requireEducator(req);

    const body = await req.json().catch(() => ({}));
    const classId = String(body.classId || '').trim();
    const username = String(body.username || '').trim().toLowerCase();
    const displayName = String(body.displayName || '').trim();
    const password = String(body.password || '');
    const studentNumber = String(body.studentNumber || '').trim();
    // Optional. Only needed if the school lets students reset their own password.
    const recoveryEmail = String(body.recoveryEmail || '').trim().toLowerCase();

    if (!classId) throw new HttpError(400, 'classId is required.');
    if (!USERNAME_PATTERN.test(username)) {
      throw new HttpError(
        400,
        'Username can only contain lowercase letters, numbers, and underscores (3-20 characters).'
      );
    }
    if (!displayName) throw new HttpError(400, 'Student name is required.');
    if (password.length < MIN_STUDENT_PASSWORD_LENGTH) {
      throw new HttpError(400, `Password must be at least ${MIN_STUDENT_PASSWORD_LENGTH} characters.`);
    }
    if (recoveryEmail && !EMAIL_PATTERN.test(recoveryEmail)) {
      throw new HttpError(400, 'That recovery email does not look right.');
    }

    const { data: klass, error: classError } = await supabaseAdmin
      .from('classes')
      .select('id, educator_id')
      .eq('id', classId)
      .single();
    if (classError || !klass) throw new HttpError(404, 'That class does not exist.');
    if (klass.educator_id !== educatorUid) {
      throw new HttpError(403, 'You can only add students to your own classes.');
    }

    const syntheticEmail = `${username}.${classId.replaceAll('-', '')}@${STUDENT_EMAIL_DOMAIN}`;

    // app_metadata, never user_metadata: see handle_new_user (0029, 0030).
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: syntheticEmail,
      password,
      email_confirm: true,
      app_metadata: {
        role: 'student',
        class_id: classId,
        username,
        display_name: displayName,
        student_number: studentNumber,
        recovery_email: recoveryEmail,
      },
    });

    if (error) {
      const taken = /already been registered|duplicate key|unique constraint/i.test(error.message);
      throw new HttpError(
        taken ? 409 : 400,
        taken ? 'That username is already taken in this class.' : error.message
      );
    }

    return new Response(JSON.stringify({ studentUid: data.user!.id, username }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500;
    const message = err instanceof Error ? err.message : 'Unexpected error.';
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
