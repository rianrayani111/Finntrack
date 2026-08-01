import { corsHeaders, HttpError, requireParent, supabaseAdmin } from '../_shared/auth.ts';
import { stripe } from '../_shared/billing.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { uid: parentUid } = await requireParent(req);

    const { data: sub } = await supabaseAdmin
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('parent_id', parentUid)
      .single();

    if (!sub?.stripe_customer_id) {
      throw new HttpError(404, 'No billing account found for this parent yet.');
    }

    const origin = req.headers.get('origin') || 'https://www.finntrack.net';

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
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
