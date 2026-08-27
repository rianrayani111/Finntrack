import Stripe from 'npm:stripe@17';
import { supabaseAdmin } from './auth.ts';

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')!;

export const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
});

// create-checkout-session and create-portal-session both used to build
// Stripe's success/cancel/return URLs from the request's own Origin header,
// falling back to the production domain only if the header was absent. That
// header is fully attacker-controlled -- a direct call to either function
// (bypassing the app entirely) could set an arbitrary Origin and get Stripe
// to redirect the caller's OWN checkout/portal session back to a domain of
// their choosing. It's a self-redirect (nothing exposes another user's
// session), but there is no reason to trust a client-supplied value here at
// all when the set of legitimate origins is small and known ahead of time.
const ALLOWED_APP_ORIGINS = [
  'https://www.finntrack.net',
  'https://finntrack.net',
  // Local dev only; harmless to leave listed in production since it's not
  // reachable from outside the developer's own machine.
  'http://localhost:5173',
];

export function resolveAppOrigin(req: Request): string {
  const requested = req.headers.get('origin');
  if (requested && ALLOWED_APP_ORIGINS.includes(requested)) return requested;
  return ALLOWED_APP_ORIGINS[0];
}

// 'base' is the required account subscription (includes one complimentary
// child); 'addon' represents the cost of every child AFTER the first, as its
// own separate subscription on the same Stripe customer.
export const STRIPE_PRICE_IDS = {
  base: {
    month: Deno.env.get('STRIPE_PRICE_BASE_MONTHLY')!,
    year: Deno.env.get('STRIPE_PRICE_BASE_ANNUAL')!,
  },
  addon: {
    month: Deno.env.get('STRIPE_PRICE_MONTHLY')!,
    year: Deno.env.get('STRIPE_PRICE_ANNUAL')!,
  },
};

export type UpsertOutcome =
  | { skipped: true; reason: string; parentId?: string }
  | { skipped: false; parentId: string };

// Writes a Stripe subscription's current state into public.subscriptions.
// Shared by the stripe-webhook handler (called per incoming event) and the
// backfill-subscriptions function (called per subscription when reconciling
// rows that a past webhook failure left stale).
export async function upsertFromSubscription(
  subscription: Stripe.Subscription,
  eventCreatedAt?: Date
): Promise<UpsertOutcome> {
  const parentId = subscription.metadata?.parent_id;
  if (!parentId) {
    // Not one of ours (metadata is always set at creation in
    // create-checkout-session) — nothing to do, not an error.
    return { skipped: true, reason: 'no parent_id metadata' };
  }

  // The parent may have deleted their account. subscriptions.parent_id is a FK
  // to profiles, so upserting for a deleted parent throws a constraint
  // violation -> the webhook returns 500 -> Stripe retries for days and can
  // eventually disable the endpoint, breaking billing sync for every other
  // family. There is nothing to record for a parent who no longer exists, so
  // acknowledge and move on instead.
  const { data: parentProfile } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('id', parentId)
    .maybeSingle();

  if (!parentProfile) {
    return { skipped: true, reason: 'parent profile no longer exists', parentId };
  }

  // Older subscriptions predate the base/addon split and have no plan_type
  // metadata — they were all addon (per-child) subscriptions.
  const planType = subscription.metadata?.plan_type === 'base' ? 'base' : 'addon';

  const item = subscription.items.data[0];
  if (!item) return { skipped: true, reason: 'no subscription item', parentId };

  const { data: existing } = await supabaseAdmin
    .from('subscriptions')
    .select('stripe_subscription_id, stripe_subscription_created_at, last_event_at')
    .eq('parent_id', parentId)
    .eq('plan_type', planType)
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
    return { skipped: true, reason: 'superseded by a newer subscription on file', parentId };
  }

  // The check above only compares DIFFERENT subscriptions. Two events for the
  // SAME subscription need their own ordering guard, or a delayed/retried
  // delivery can overwrite newer state with older (a retried 'active' landing
  // after 'deleted' would restore a canceled family's access). Stripe
  // subscription objects carry no version, so order by the event's timestamp.
  if (eventCreatedAt && existing?.last_event_at && eventCreatedAt < new Date(existing.last_event_at)) {
    return { skipped: true, reason: 'older than the last event applied', parentId };
  }

  // current_period_end moved from the subscription object to the subscription
  // item as of Stripe API version 2026-07-29.dahlia. Read whichever location
  // the account's configured API version actually populates, rather than
  // assuming one — the two locations aren't necessarily in sync, and an
  // account still on an older API version won't populate the item-level
  // field at all (item.current_period_end would be undefined, silently
  // producing an Invalid Date and throwing).
  const periodEndSeconds =
    (item as unknown as { current_period_end?: number }).current_period_end ??
    (subscription as unknown as { current_period_end?: number }).current_period_end;

  if (!periodEndSeconds) {
    throw new Error(
      `No current_period_end on subscription ${subscription.id} (checked item and subscription levels).`
    );
  }

  const { error } = await supabaseAdmin
    .from('subscriptions')
    .upsert(
      {
        parent_id: parentId,
        plan_type: planType,
        stripe_customer_id: String(subscription.customer),
        stripe_subscription_id: subscription.id,
        stripe_subscription_created_at: incomingCreated.toISOString(),
        status: subscription.status,
        billing_interval: item.price.recurring?.interval || null,
        quantity: item.quantity || 1,
        current_period_end: new Date(periodEndSeconds * 1000).toISOString(),
        updated_at: new Date().toISOString(),
        // Only advanced by real webhook deliveries; the backfill job passes no
        // event and must not move the watermark forward.
        ...(eventCreatedAt ? { last_event_at: eventCreatedAt.toISOString() } : {}),
      },
      { onConflict: 'parent_id,plan_type' }
    );

  if (error) throw error;
  return { skipped: false, parentId };
}

// Re-syncs a parent's Stripe subscription item quantity to their current
// BILLABLE child count, i.e. every child beyond the first (free) one.
// proration_behavior is 'none': for a small-dollar consumer product, adding or
// removing a child mid-cycle should take effect at the next renewal rather than
// producing a surprise prorated charge or credit.
export async function syncSubscriptionQuantity(parentUid: string) {
  try {
    const { data: sub } = await supabaseAdmin
      .from('subscriptions')
      .select('stripe_subscription_id')
      .eq('parent_id', parentUid)
      .eq('plan_type', 'addon')
      .single();

    if (!sub?.stripe_subscription_id) return;

    const { count } = await supabaseAdmin
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('parent_id', parentUid);

    const quantity = Math.max((count || 0) - 1, 0);

    const subscription = await stripe.subscriptions.retrieve(sub.stripe_subscription_id);
    const item = subscription.items.data[0];
    if (!item) return;

    if (quantity === 0) {
      // No billable (2nd+) children left. Setting a licensed subscription
      // item's quantity to 0 isn't reliably supported, so instead schedule
      // the subscription to end at the current period's end -- the parent
      // keeps access through what they already paid for (matching
      // proration_behavior: 'none' above), and it lapses naturally at
      // renewal rather than being cut off or refunded immediately.
      if (!subscription.cancel_at_period_end && subscription.status !== 'canceled') {
        await stripe.subscriptions.update(sub.stripe_subscription_id, { cancel_at_period_end: true });
      }
      return;
    }

    await stripe.subscriptionItems.update(item.id, {
      quantity,
      proration_behavior: 'none',
    });

    // Undo a pending end-of-period cancellation if the parent added another
    // billable child back before the period actually ended.
    if (subscription.cancel_at_period_end) {
      await stripe.subscriptions.update(sub.stripe_subscription_id, { cancel_at_period_end: false });
    }
  } catch (err) {
    // Don't fail the parent-facing add/delete-child request over a transient
    // Stripe API blip — the next customer.subscription.updated webhook will
    // reconcile the stored quantity regardless.
    console.error(`syncSubscriptionQuantity failed for parent ${parentUid}:`, err);
  }
}

// Strict 'active' check for gating "add a child" — a parent with a failing
// card (status 'past_due') should not be able to add more billable children.
export async function hasActiveSubscription(
  parentUid: string,
  planType: 'base' | 'addon' = 'addon'
): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('subscriptions')
    .select('status')
    .eq('parent_id', parentUid)
    .eq('plan_type', planType)
    .single();

  return data?.status === 'active';
}
