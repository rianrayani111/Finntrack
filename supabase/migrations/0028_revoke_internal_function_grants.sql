-- Postgres grants EXECUTE on every newly created function to PUBLIC by
-- default, so a function is exposed over PostgREST unless a migration
-- explicitly revokes it. 0024 already hit this once (check_username_available
-- was reachable with only the anon key, confirmed live with curl) but fixed
-- only that one function; the default itself was never addressed.
--
-- Two SECURITY DEFINER functions are affected, and both take a caller-supplied
-- id WITHOUT checking it against auth.uid() -- they were written on the
-- assumption that only their SECURITY DEFINER callers could reach them:
--
--   finn_evaluate_badges(uuid, text[])  -- 0026/0027
--     0026's own header states "Not granted to authenticated/anon ... exposing
--     it directly would let any authenticated user read (though not alter) any
--     other child's aggregated activity stats". The reasoning was correct; the
--     revoke was simply never written. Reads the given child's profiles and
--     transactions rows and returns which badges they qualify for, which
--     discloses entry counts, tracked spending totals, streak length and
--     account age for that child -- an aggregated financial profile of a minor,
--     retrievable with no session at all. Child uuids are not guessable, but
--     they are not secret either (storage paths, request/task rows), so this is
--     a real disclosure rather than a purely theoretical one.
--
--   finn_family_has_active_access(uuid)  -- 0025 line 50
--     Explicitly granted to authenticated, which looks deliberate but is not
--     needed (see below). Lets any logged-in user pass any parent's uuid and
--     learn whether that family currently pays.
--
-- Revoking breaks nothing. finn_evaluate_badges is called from exactly one
-- place (sync_badges, 0026 line 482) and finn_family_has_active_access from
-- exactly one place (finn_caller_has_active_access, 0025 line 42). Neither
-- appears anywhere in src/ or supabase/functions/. Both callers are SECURITY
-- DEFINER and therefore execute as the function owner, for whom EXECUTE
-- privilege is not checked at all. The two public entry points keep their
-- grants: sync_badges() derives its child from auth.uid(), and
-- finn_caller_has_active_access() must stay granted to authenticated because
-- RLS policy expressions are evaluated with the querying user's privileges.
revoke execute on function public.finn_evaluate_badges(uuid, text[]) from public, anon, authenticated;
revoke execute on function public.finn_family_has_active_access(uuid) from public, anon, authenticated;

-- Structural guard so this class of bug cannot recur: future functions created
-- in this schema by this role are no longer world-executable on creation, and
-- must opt in with an explicit grant. This changes DEFAULT privileges only --
-- it does not retroactively revoke anything -- so every existing function
-- keeps exactly the privileges it has today.
alter default privileges in schema public revoke execute on functions from public;

comment on function public.finn_evaluate_badges(uuid, text[]) is
  'Internal to sync_badges(). SECURITY DEFINER with no ownership check on p_child_id, so it must never be granted to anon or authenticated -- enforced by the revoke in 0028, not just by convention.';

comment on function public.finn_family_has_active_access(uuid) is
  'Internal to finn_caller_has_active_access(). SECURITY DEFINER with no ownership check on p_family_parent_id, so it must never be granted to anon or authenticated -- enforced by the revoke in 0028. Grant finn_caller_has_active_access() instead; RLS policies call that one as the querying user.';
