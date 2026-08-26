import { corsHeaders, HttpError, requireParent, supabaseAdmin } from '../_shared/auth.ts';
import { hasActiveSubscription, syncSubscriptionQuantity } from '../_shared/billing.ts';

const CHILD_EMAIL_DOMAIN = 'child.finntrack.local';
const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { uid: parentUid } = await requireParent(req);

    // The base plan is required to use the app at all. SubscriptionGate already
    // blocks this in the UI, but that is a client-side check on a client-callable
    // endpoint -- without this, a parent whose base plan never started (or has
    // lapsed) could still create their "free" first child by calling the
    // function directly.
    if (!(await hasActiveSubscription(parentUid, 'base'))) {
      throw new HttpError(
        402,
        'An active FinnTrack subscription is required before adding a child.'
      );
    }

    // A parent's first child is free. Every child after that requires an
    // active subscription (checked before creating the auth user so we don't
    // have to unwind a half-created account on a 402).
    const { count: existingChildCount } = await supabaseAdmin
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('parent_id', parentUid);

    const isAdditionalChild = (existingChildCount || 0) >= 1;
    if (isAdditionalChild && !(await hasActiveSubscription(parentUid, 'addon'))) {
      throw new HttpError(
        402,
        'Your first child is free. Adding another child requires an active subscription — $3.99/month or $19.99/year.'
      );
    }

    const body = await req.json().catch(() => ({}));
    const displayName = String(body.displayName || '').trim();
    const username = String(body.username || '').trim().toLowerCase();
    const password = String(body.password || '');

    if (!username) throw new HttpError(400, 'Username is required.');
    if (!USERNAME_PATTERN.test(username)) {
      throw new HttpError(
        400,
        'Username can only contain lowercase letters, numbers, and underscores (3-20 characters).'
      );
    }
    if (!displayName) throw new HttpError(400, 'Child display name is required.');
    if (!password) throw new HttpError(400, 'Password is required.');

    const syntheticEmail = `${username}@${CHILD_EMAIL_DOMAIN}`;

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: syntheticEmail,
      password,
      email_confirm: true,
      user_metadata: {
        role: 'child',
        display_name: displayName,
        username,
        parent_id: parentUid,
      },
    });

    if (error) {
      const message = /already been registered|duplicate key|unique constraint/i.test(error.message)
        ? 'That username is already taken. Please choose another one.'
        : error.message;
      const status = /already been registered|duplicate key|unique constraint/i.test(error.message) ? 409 : 400;
      throw new HttpError(status, message);
    }

    await syncSubscriptionQuantity(parentUid);

    return new Response(
      JSON.stringify({
        childUid: data.user!.id,
        username,
        syntheticEmail,
        parentStayedLoggedIn: true,
      }),
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
