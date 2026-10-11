import { corsHeaders, finalizeAccountOrDelete, HttpError, supabaseAdmin } from '../_shared/auth.ts';

// Student self-signup: a class code plus a username and password the student
// picks. No session is required, so everything here is defensive:
//
//   * the class must exist, be open to joining and not archived
//   * the class must have a free seat (the teacher's seat limit is the cap
//     on how many accounts one leaked class code can ever create)
//   * usernames are unique within the class, and the synthetic login address
//     is built the same way handle_new_user (0033) expects
//
// Keep the address format in sync with handle_new_user and studentEmail() in
// src/api/education.js.
const STUDENT_EMAIL_DOMAIN = 'student.finntrack.local';
const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;
const MIN_PASSWORD_LENGTH = 6;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const classCode = String(body.classCode || '').trim().toUpperCase();
    const username = String(body.username || '').trim().toLowerCase();
    const displayName = String(body.displayName || '').trim();
    const password = String(body.password || '');

    if (!classCode) throw new HttpError(400, 'Enter your class code.');
    if (!USERNAME_PATTERN.test(username)) {
      throw new HttpError(
        400,
        'Your username can only use lowercase letters, numbers and underscores (3-20 characters).'
      );
    }
    if (!displayName) throw new HttpError(400, 'Enter your name.');
    if (password.length < MIN_PASSWORD_LENGTH) {
      throw new HttpError(400, `Your password needs at least ${MIN_PASSWORD_LENGTH} characters.`);
    }

    const { data: klass, error: classError } = await supabaseAdmin
      .from('classes')
      .select('id, name, seat_limit, join_open, is_archived')
      .ilike('code', classCode)
      .maybeSingle();
    if (classError) throw new HttpError(500, classError.message);
    if (!klass) throw new HttpError(404, "We couldn't find that class code. Check it with your teacher.");
    if (!klass.join_open || klass.is_archived) {
      throw new HttpError(403, 'This class is not accepting new students right now.');
    }

    const { count: taken, error: countError } = await supabaseAdmin
      .from('students')
      .select('id', { count: 'exact', head: true })
      .eq('class_id', klass.id);
    if (countError) throw new HttpError(500, countError.message);
    if ((taken || 0) >= klass.seat_limit) {
      throw new HttpError(409, 'This class is full. Ask your teacher to add more seats.');
    }

    const syntheticEmail = `${username}.${String(klass.id).replaceAll('-', '')}@${STUDENT_EMAIL_DOMAIN}`;

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: syntheticEmail,
      password,
      email_confirm: true,
      app_metadata: {
        role: 'student',
        class_id: klass.id,
        username,
        display_name: displayName,
      },
    });

    if (error) {
      const taken = /already been registered|duplicate key|unique constraint/i.test(error.message);
      throw new HttpError(
        taken ? 409 : 400,
        taken ? 'That username is already taken in this class. Try another one.' : error.message
      );
    }

    await finalizeAccountOrDelete(data.user!.id, 'edu_finalize_student', {
      p_user_id: data.user!.id,
      p_class_id: klass.id,
      p_username: username,
      p_display_name: displayName,
    });

    // The seat check above is not atomic: two students can both see the last
    // seat as free. Re-check now that this account exists and undo it if the
    // class is over its limit, so a seat limit is never exceeded.
    const { count: after } = await supabaseAdmin
      .from('students')
      .select('id', { count: 'exact', head: true })
      .eq('class_id', klass.id);
    if ((after || 0) > klass.seat_limit) {
      await supabaseAdmin.auth.admin.deleteUser(data.user!.id);
      throw new HttpError(409, 'This class just filled up. Ask your teacher to add more seats.');
    }

    return new Response(
      JSON.stringify({ studentUid: data.user!.id, username, classId: klass.id, className: klass.name }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500;
    const message = err instanceof Error ? err.message : 'Unexpected error.';
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
