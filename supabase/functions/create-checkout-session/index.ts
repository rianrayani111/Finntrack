import { corsHeaders, HttpError, requireParent, supabaseAdmin } from '../_shared/auth.ts';
import { stripe, STRIPE_PRICE_IDS, resolveAppOrigin } from '../_shared/billing.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { uid: parentUid } = await requireParent(req);

    const body = await req.json().catch(() => ({}));
    const plan = body.plan === 'base' ? 'base' : 'addon';

    const interval = String(body.interval || '');
    if (interval !== 'month' && interval !== 'year') {
      throw new HttpError(400, 'interval must be "month" or "year".');
    }

    // Where to send the parent back after Stripe Checkout -- e.g. the add-child
    // page, so it can resume creating the child that triggered this checkout.
    // Restricted to a same-app path under /parent to avoid an open redirect.
    const requestedReturnTo = String(body.returnTo || '');
    const returnTo = requestedReturnTo.startsWith('/parent') ? requestedReturnTo : '/parent';

    // A parent can hold up to two independent subscriptions (base + addon)
    // on one shared Stripe customer, so this is no longer a single row.
    const { data: existingRows } = await supabaseAdmin
      .from('subscriptions')
      .select('plan_type, status, stripe_customer_id')
      .eq('parent_id', parentUid);

    const existing = existingRows?.find((row) => row.plan_type === plan);
    if (existing?.status === 'active') {
      throw new HttpError(409, 'You already have an active subscription. Use Manage Billing instead.');
    }

    let customerId = existingRows?.find((row) => row.stripe_customer_id)?.stripe_customer_id;
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

    const origin = resolveAppOrigin(req);

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: STRIPE_PRICE_IDS[plan][interval], quantity: 1 }],
      subscription_data: { metadata: { parent_id: parentUid, plan_type: plan } },
      success_url: `${origin}${returnTo}?checkout=success`,
      cancel_url: `${origin}${returnTo}?checkout=cancelled`,
      allow_promotion_codes: true,
      // Skips the card-collection step entirely when the total due (now and for
      // all future renewals) is $0 — e.g. a forever/100%-off promo code. Any
      // checkout with a real amount due still collects a card as normal.
      payment_method_collection: 'if_required',
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
