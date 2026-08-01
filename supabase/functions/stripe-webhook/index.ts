import Stripe from 'npm:stripe@17';
import { supabaseAdmin } from '../_shared/auth.ts';
import { stripe } from '../_shared/billing.ts';

const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;

// Server-to-server endpoint called directly by Stripe (no Supabase JWT, no
// browser CORS involved) — JWT verification for this specific function must
// be disabled at the Supabase project level (see supabase/config.toml).
async function upsertFromSubscription(subscription: Stripe.Subscription) {
  const parentId = subscription.metadata?.parent_id;
  if (!parentId) {
    // Not one of ours (metadata is always set at creation in
    // create-checkout-session) — nothing to do, not an error.
    return;
  }

  const item = subscription.items.data[0];
  if (!item) return;

  const { data: existing } = await supabaseAdmin
    .from('subscriptions')
    .select('stripe_subscription_id, stripe_subscription_created_at')
    .eq('parent_id', parentId)
    .single();

  const incomingCreated = new Date(subscription.created * 1000);

  // Guard against a late-arriving retry for an OLD subscription clobbering a
  // parent who has since canceled and resubscribed (new stripe_subscription_id).
  if (
    existing?.stripe_subscription_id &&
    existing.stripe_subscription_id !== subscription.id &&
    existing.stripe_subscription_created_at &&
    incomingCreated <= new Date(existing.stripe_subscription_created_at)
  ) {
    return;
  }

  const { error } = await supabaseAdmin
    .from('subscriptions')
    .upsert(
      {
        parent_id: parentId,
        stripe_customer_id: String(subscription.customer),
        stripe_subscription_id: subscription.id,
        stripe_subscription_created_at: incomingCreated.toISOString(),
        status: subscription.status,
        billing_interval: item.price.recurring?.interval || null,
        quantity: item.quantity || 1,
        // current_period_end lives on the subscription item (not the subscription
        // itself) as of Stripe API version 2026-07-29.dahlia.
        current_period_end: new Date(item.current_period_end * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'parent_id' }
    );

  if (error) throw error;
}

Deno.serve(async (req: Request) => {
  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    return new Response('Missing stripe-signature header.', { status: 400 });
  }

  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(rawBody, signature, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Stripe signature verification failed:', err);
    return new Response('Invalid signature.', { status: 400 });
  }

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await upsertFromSubscription(event.data.object as Stripe.Subscription);
        break;
      default:
        // Event types we don't act on — acknowledge so Stripe doesn't retry.
        break;
    }
    return new Response(JSON.stringify({ received: true }), { status: 200 });
  } catch (err) {
    console.error(`Error handling webhook event ${event.id} (${event.type}):`, err);
    // 500 so Stripe retries a genuine transient failure.
    return new Response('Internal error.', { status: 500 });
  }
});
