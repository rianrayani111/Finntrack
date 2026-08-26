import Stripe from 'npm:stripe@17';
import { stripe, upsertFromSubscription } from '../_shared/billing.ts';

const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;

// Server-to-server endpoint called directly by Stripe (no Supabase JWT, no
// browser CORS involved) — JWT verification for this specific function must
// be disabled at the Supabase project level (see supabase/config.toml).
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
        await upsertFromSubscription(
          event.data.object as Stripe.Subscription,
          new Date(event.created * 1000)
        );
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
