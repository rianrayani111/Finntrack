-- handle_new_user (0001) built the profiles row from new.raw_user_meta_data,
-- including role, parent_id and username. raw_user_meta_data is the
-- options.data object of a public supabase.auth.signUp() call, so it is
-- entirely attacker-controlled by anyone holding the anon key -- which ships
-- in the frontend and is public by design. The trigger fires on auth.users
-- INSERT, i.e. before email confirmation, so no working mailbox was needed
-- either:
--
--   signUp({ email, password, options: { data: {
--     role: 'child', parent_id: '<victim parent uuid>',
--     username: 'x', display_name: 'x' } } })
--
-- created a live child profile inside a stranger's family. Consequences:
-- finn_family_has_active_access counts children per parent, so a second
-- "child" flips a one-free-child family to "needs addon" and locks the real
-- parent and real child out of the app (and, through RLS, out of their own
-- data) until they pay for an addon they never asked for;
-- syncSubscriptionQuantity then bills them for the forged child; the forged
-- child shows up in the parent's dashboard and can file unlimited money
-- requests. It also bypassed every control in create-child-account: the
-- base-plan check, the addon check, the 8-char password minimum and the
-- username pattern. Parent uuids are not secret -- they sit in every child's
-- session as profile.parentId, in proof-photo storage paths, and on request
-- and task rows.
--
-- Fix: the trigger now trusts ONLY raw_app_meta_data, which PostgREST and
-- GoTrue refuse to accept from a client and which can be set only through the
-- admin API with the service-role key -- i.e. only by create-child-account,
-- which is where all the subscription and validation checks already live.
-- A public signUp is now always a parent no matter what it claims to be:
-- role is forced to 'parent', parent_id and username to null. display_name
-- still comes from raw_user_meta_data in that branch, which is safe -- it is
-- the one field a parent legitimately asserts about themselves, it is not
-- used for authorization, and profiles_parent_shape constrains the rest.
--
-- Also reserves the synthetic child login domain. Previously anyone could
-- signUp as a parent with maya@child.finntrack.local; the account stayed
-- unconfirmed but the profiles row (and the auth.users email) persisted,
-- permanently burning the child username "maya" while
-- check_username_available still reported it free.
--
-- Existing accounts are unaffected: this trigger runs only on INSERT into
-- auth.users, and every current profile row already exists. To find children
-- forged through the old path before this shipped:
--
--   select p.id, p.username, p.parent_id, p.created_at
--   from public.profiles p
--   join auth.users u on u.id = p.id
--   where p.role = 'child'
--     and coalesce(u.raw_app_meta_data->>'role', '') <> 'child';
--
-- Note that this lists EVERY child created before this migration, not just
-- forged ones, since none of them have app_metadata yet. Read the list once --
-- it is short -- and confirm each child belongs to the family it claims. Then
-- back-fill them all so the same query becomes a real forgery detector from
-- here on, returning rows only for children that did not come through
-- create-child-account:
--
--   update auth.users u set raw_app_meta_data =
--     coalesce(u.raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role','child')
--   from public.profiles p
--   where p.id = u.id and p.role = 'child';
--
-- Delete anything you could not account for BEFORE running that, via the
-- delete-child-account function rather than by hand, so billing quantity and
-- proof-photo cleanup run with it.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.raw_app_meta_data->>'role' = 'child' then
    -- Service-role path only (create-child-account). Deliberately has no
    -- defaults: a missing username or parent_id trips profiles_parent_shape
    -- and fails loudly rather than creating a malformed child, which is the
    -- same fail-loud contract 0001 intended for role.
    insert into public.profiles (id, role, display_name, email, username, parent_id)
    values (
      new.id,
      'child',
      coalesce(
        nullif(trim(new.raw_app_meta_data->>'display_name'), ''),
        split_part(new.email, '@', 1)
      ),
      null,
      new.raw_app_meta_data->>'username',
      nullif(new.raw_app_meta_data->>'parent_id', '')::uuid
    );
  else
    -- Every public signup, whatever its user_metadata claims to be.
    if new.email ilike '%@child.finntrack.local' then
      raise exception 'That email domain is reserved.' using errcode = '22023';
    end if;

    insert into public.profiles (id, role, display_name, email, username, parent_id)
    values (
      new.id,
      'parent',
      coalesce(
        nullif(trim(new.raw_user_meta_data->>'display_name'), ''),
        split_part(new.email, '@', 1)
      ),
      new.email,
      null,
      null
    );
  end if;

  return new;
end; $$;

comment on function public.handle_new_user() is
  'Creates the profiles row for a new auth.users record. Reads role, username and parent_id ONLY from raw_app_meta_data, which is settable exclusively through the admin API (service-role) and therefore only by create-child-account. Anything signing up through the public anon key becomes a parent regardless of the metadata it supplies. Do not reintroduce raw_user_meta_data for any field other than a parent display_name -- see 0029.';
