-- upsertFromSubscription's staleness guard only rejected an out-of-order event
-- when it referred to a DIFFERENT stripe_subscription_id than the one on file.
-- Two events for the SAME subscription had no ordering check at all, so a
-- delayed delivery or a Stripe retry could overwrite newer state with older:
-- e.g. a retried 'updated' (status active) landing after 'deleted' succeeded
-- would resurrect a canceled family's access until some later event happened
-- to correct it.
--
-- Stripe subscription objects carry no monotonic version, so ordering has to
-- come from the EVENT's created timestamp. Record the newest one applied per
-- row and drop anything older.
--
-- Nullable with no backfill: existing rows simply have no recorded event yet,
-- and the guard treats a null as "nothing to compare against" so the first
-- event after this migration applies normally and sets the baseline.

alter table public.subscriptions add column last_event_at timestamptz;

comment on column public.subscriptions.last_event_at is
  'stripe Event.created of the most recent webhook event applied to this row; used to discard out-of-order/retried deliveries.';
