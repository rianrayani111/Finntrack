-- profiles_update_own (0001) allows a row to update ITSELF, but places no
-- restriction on WHICH COLUMNS, so a child could PATCH their own profile row
-- with {role: 'parent', parent_id: null} and escalate straight past every
-- requireParent() check in the edge functions -- or set xp/streak_count to
-- fake achievements, or clear require_refund_receipt to void the receipt rule
-- their parent set. An RLS WITH CHECK clause can't fix this: it only sees the
-- NEW row, so it cannot express "role must not have changed".
--
-- Column-level privileges can. display_name is the only profiles column the
-- client ever writes directly (users.updateMe in src/api/db.js); every other
-- mutable column is written exclusively by SECURITY DEFINER functions --
-- update_avatar, sync_badges, bump_daily_streak, bump_summary_views,
-- bump_history_views, set_child_refund_receipt_required -- which run as their
-- owner and are unaffected by the caller's column grants. service_role
-- (used by the edge functions) is likewise untouched by this revoke.
--
-- profiles_update_own still applies on top of this, so a user can only reach
-- their own row; this narrows what they may change once there.

revoke update on public.profiles from anon, authenticated;
grant update (display_name) on public.profiles to authenticated;
