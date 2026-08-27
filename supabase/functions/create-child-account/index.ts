import { corsHeaders, HttpError, requireParent, supabaseAdmin } from '../_shared/auth.ts';
import { hasActiveSubscription, syncSubscriptionQuantity } from '../_shared/billing.ts';

const CHILD_EMAIL_DOMAIN = 'child.finntrack.local';
const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;
// update-child-password already enforced this; account CREATION never did --
// only a client-side check in ParentAddChild.jsx did, which a direct call to
// this function bypasses entirely. Raised from 6 to 8 here (and to match, in
// update-child-password) since this guards a child's real financial history.
const MIN_CHILD_PASSWORD_LENGTH = 8;

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
    if (password.length < MIN_CHILD_PASSWORD_LENGTH) {
      throw new HttpError(400, `Password must be at least ${MIN_CHILD_PASSWORD_LENGTH} characters.`);
    }

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

    // The count-then-create check above isn't atomic: two concurrent requests
    // for the same parent can both read "0 existing children" (or both pass
    // the addon-subscription check) before either has actually created one,
    // and both proceed. Re-verify the SAME invariant now that this child
    // definitely exists -- if a race let a second free/unpaid child through,
    // undo it here rather than leaving two children active on one free plan.
    // A legitimate single request always passes this: nothing about the
    // parent's subscription changed between the two checks, so the only way
    // this fails is the exact race this guards against.
    const { count: childCountAfter } = await supabaseAdmin
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('parent_id', parentUid);

    if ((childCountAfter || 0) > 1 && !(await hasActiveSubscription(parentUid, 'addon'))) {
      await supabaseAdmin.auth.admin.deleteUser(data.user!.id);
      throw new HttpError(
        409,
        'Another child account was created for this family at the same moment. Please try again.'
      );
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
