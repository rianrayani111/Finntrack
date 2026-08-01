import Stripe from 'npm:stripe@17';
import { supabaseAdmin } from './auth.ts';

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')!;

export const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
});

export const STRIPE_PRICE_IDS = {
  month: Deno.env.get('STRIPE_PRICE_MONTHLY')!,
  year: Deno.env.get('STRIPE_PRICE_ANNUAL')!,
};

// Re-syncs a parent's Stripe subscription item quantity to their current child
// count (floor of 1 — Stripe subscription items can't sit at quantity 0, and a
// parent with an active subscription is always paying for at least one slot).
// proration_behavior is 'none': for a small-dollar consumer product, adding or
// removing a child mid-cycle should take effect at the next renewal rather than
// producing a surprise prorated charge or credit.
export async function syncSubscriptionQuantity(parentUid: string) {
  try {
    const { data: sub } = await supabaseAdmin
      .from('subscriptions')
      .select('stripe_subscription_id')
      .eq('parent_id', parentUid)
      .single();

    if (!sub?.stripe_subscription_id) return;

    const { count } = await supabaseAdmin
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('parent_id', parentUid);

    const quantity = Math.max(count || 0, 1);

    const subscription = await stripe.subscriptions.retrieve(sub.stripe_subscription_id);
    const item = subscription.items.data[0];
    if (!item) return;

    await stripe.subscriptionItems.update(item.id, {
      quantity,
      proration_behavior: 'none',
    });
  } catch (err) {
    // Don't fail the parent-facing add/delete-child request over a transient
    // Stripe API blip — the next customer.subscription.updated webhook will
    // reconcile the stored quantity regardless.
    console.error(`syncSubscriptionQuantity failed for parent ${parentUid}:`, err);
  }
}

// Strict 'active' check for gating "add a child" — a parent with a failing
// card (status 'past_due') should not be able to add more billable children.
export async function hasActiveSubscription(parentUid: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('subscriptions')
    .select('status')
    .eq('parent_id', parentUid)
    .single();

  return data?.status === 'active';
}
