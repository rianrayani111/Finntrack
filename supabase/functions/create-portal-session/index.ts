import { corsHeaders, HttpError, requireParent, supabaseAdmin } from '../_shared/auth.ts';
import { stripe, resolveAppOrigin } from '../_shared/billing.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { uid: parentUid } = await requireParent(req);

    // A parent can hold up to two subscription rows (base + addon) that
    // share one Stripe customer -- either one having a customer id is enough.
    const { data: subs } = await supabaseAdmin
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('parent_id', parentUid)
      .not('stripe_customer_id', 'is', null)
      .limit(1);

    const customerId = subs?.[0]?.stripe_customer_id;
    if (!customerId) {
      throw new HttpError(404, 'No billing account found for this parent yet.');
    }

    const origin = resolveAppOrigin(req);

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/parent/settings`,
    });

    return new Response(JSON.stringify({ url: portalSession.url }), {
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
