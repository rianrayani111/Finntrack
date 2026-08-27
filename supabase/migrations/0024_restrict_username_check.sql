-- check_username_available (0001) is SECURITY DEFINER with no explicit grant
-- statement, so it inherited Postgres's default EXECUTE-to-PUBLIC on newly
-- created functions -- callable by the anon role, i.e. with no login at all.
-- Verified live: curl with only the public anon key (no user session)
-- against /rest/v1/rpc/check_username_available correctly distinguished a
-- taken username from a free one. Combined with the 3-20 char
-- [a-z0-9_] username space, this is a fully anonymous, zero-cost
-- enumeration oracle over every child account in the system.
--
-- The function is only ever legitimately called by an already-authenticated
-- parent, live-checking availability while typing a new child's username
-- (ParentAddChild.jsx) -- it never needs to work for a logged-out caller.
-- Restricting it to `authenticated` doesn't fully close enumeration (any
-- account, parent or child, can still call it), but it removes the
-- zero-cost anonymous path entirely, which is the part that mattered most.

revoke execute on function public.check_username_available(text) from public, anon;
grant execute on function public.check_username_available(text) to authenticated;
