import { corsHeaders, HttpError, requireParent, supabaseAdmin } from '../_shared/auth.ts';
import { stripe, STRIPE_PRICE_IDS } from '../_shared/billing.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { uid: parentUid } = await requireParent(req);

    const body = await req.json().catch(() => ({}));
    const interval = String(body.interval || '');
    if (interval !== 'month' && interval !== 'year') {
      throw new HttpError(400, 'interval must be "month" or "year".');
    }

    const { data: existing } = await supabaseAdmin
      .from('subscriptions')
      .select('status, stripe_customer_id')
      .eq('parent_id', parentUid)
      .single();

    if (existing?.status === 'active') {
      throw new HttpError(409, 'You already have an active subscription. Use Manage Billing instead.');
    }

    let customerId = existing?.stripe_customer_id;
    if (!customerId) {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('email, display_name')
        .eq('id', parentUid)
        .single();

      const customer = await stripe.customers.create(
        { email: profile?.email || undefined, name: profile?.display_name || undefined, metadata: { parent_id: parentUid } },
        { idempotencyKey: `create-customer-${parentUid}` }
      );
      customerId = customer.id;
    }

    const origin = req.headers.get('origin') || 'https://www.finntrack.net';

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: STRIPE_PRICE_IDS[interval], quantity: 1 }],
      subscription_data: { metadata: { parent_id: parentUid } },
      success_url: `${origin}/parent?checkout=success`,
      cancel_url: `${origin}/parent?checkout=cancelled`,
    });

    return new Response(JSON.stringify({ url: session.url }), {
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
