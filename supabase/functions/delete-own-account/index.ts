import { corsHeaders, HttpError, requireParent, supabaseAdmin } from '../_shared/auth.ts';
import { stripe } from '../_shared/billing.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { uid: parentUid } = await requireParent(req);

    // Cancel Stripe billing BEFORE deleting anything. Once the auth user is
    // gone the parent has no login, so no way to reach the billing portal --
    // leaving a live subscription that charges their card forever with no
    // self-serve way to stop it. This runs first, and a failure aborts the
    // whole deletion, because "account deleted but still billing" is far worse
    // than "deletion failed, please try again".
    const { data: subs, error: subsError } = await supabaseAdmin
      .from('subscriptions')
      .select('stripe_subscription_id, status')
      .eq('parent_id', parentUid);
    if (subsError) throw new HttpError(500, subsError.message);

    for (const sub of subs || []) {
      if (!sub.stripe_subscription_id || sub.status === 'canceled') continue;
      try {
        await stripe.subscriptions.cancel(sub.stripe_subscription_id);
      } catch (err) {
        // Already gone on Stripe's side (canceled elsewhere, test-data wipe):
        // nothing left to cancel, so this is success for our purposes.
        if ((err as { code?: string })?.code === 'resource_missing') continue;
        throw new HttpError(
          502,
          'Could not cancel your subscription with our payment provider, so your account was not deleted. Please try again in a moment.'
        );
      }
    }

    const { data: children, error: childrenError } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('parent_id', parentUid);
    if (childrenError) throw new HttpError(500, childrenError.message);

    // Delete each child's auth user first. The profiles FK cascade (parent_id
    // -> profiles.id) only removes the child *profile* row when the parent
    // profile is deleted — it doesn't reach back up to delete the child's
    // auth.users row, which would otherwise be left behind as an orphaned login.
    for (const child of children || []) {
      const { error: childDeleteError } = await supabaseAdmin.auth.admin.deleteUser(child.id);
      if (childDeleteError) throw new HttpError(500, childDeleteError.message);
    }

    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(parentUid);
    if (deleteError) throw new HttpError(500, deleteError.message);

    return new Response(JSON.stringify({ success: true }), {
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
