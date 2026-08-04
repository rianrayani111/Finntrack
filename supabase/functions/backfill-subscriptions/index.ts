import { stripe, upsertFromSubscription } from '../_shared/billing.ts';

const BACKFILL_SECRET = Deno.env.get('BACKFILL_SECRET')!;

// One-off ops endpoint: re-syncs public.subscriptions from Stripe for
// subscriptions a past webhook failure left stale or missing (see the
// current_period_end fix in _shared/billing.ts). Not called by the app —
// invoked manually with the BACKFILL_SECRET header. Defaults to a dry run
// (no writes) unless the caller explicitly passes dryRun: false.
//
// Body: { dryRun?: boolean, parentId?: string }
Deno.serve(async (req: Request) => {
  if (req.headers.get('x-backfill-secret') !== BACKFILL_SECRET) {
    return new Response('Unauthorized.', { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const dryRun = body.dryRun !== false;
  const onlyParentId = typeof body.parentId === 'string' ? body.parentId : undefined;

  const results: Array<{ subscriptionId: string; parentId?: string; status: string; action: string }> = [];

  for await (const subscription of stripe.subscriptions.list({ status: 'all', limit: 100 })) {
    const parentId = subscription.metadata?.parent_id;
    if (!parentId) continue;
    if (onlyParentId && parentId !== onlyParentId) continue;

    if (dryRun) {
      results.push({
        subscriptionId: subscription.id,
        parentId,
        status: subscription.status,
        action: 'would sync (dry run)',
      });
      continue;
    }

    try {
      const outcome = await upsertFromSubscription(subscription);
      results.push({
        subscriptionId: subscription.id,
        parentId,
        status: subscription.status,
        action: outcome.skipped ? `skipped: ${outcome.reason}` : 'synced',
      });
    } catch (err) {
      results.push({
        subscriptionId: subscription.id,
        parentId,
        status: subscription.status,
        action: `error: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  return new Response(JSON.stringify({ dryRun, count: results.length, results }, null, 2), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
