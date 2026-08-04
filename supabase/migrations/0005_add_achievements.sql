-- Achievements: badges, XP, levels, and avatar customization for child accounts.

-- ============================================================
-- Columns
-- ============================================================

alter table public.profiles add column xp int not null default 0;
alter table public.profiles add column summary_views_count int not null default 0;
alter table public.profiles add column history_views_count int not null default 0;
alter table public.profiles add column avatar_skin text not null default 'peach';
alter table public.profiles add column avatar_hair_style text not null default 'short';
alter table public.profiles add column avatar_hair_color text not null default 'brown';
alter table public.profiles add column avatar_face text not null default 'smile';

-- Optional free-text note on a transaction, separate from the required `reason`.
-- Used to distinguish "gave a reason" (always true, reason is required) from
-- "took the extra step to add more detail", which several badges reward.
alter table public.transactions add column notes text not null default '';

-- ============================================================
-- user_badges
-- ============================================================

create table public.user_badges (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.profiles(id) on delete cascade,
  badge_key text not null,
  earned_at timestamptz not null default now(),
  unique (child_id, badge_key)
);
create index user_badges_child_id_idx on public.user_badges (child_id);

alter table public.user_badges enable row level security;

-- Read-only from the client's perspective: rows are only ever written by the
-- sync_badges() function below. A child reads their own badges; a parent
-- reads their children's, mirroring the profiles_select_children pattern.
create policy user_badges_select_own on public.user_badges for select
  using (child_id = auth.uid());
create policy user_badges_select_children on public.user_badges for select
  using (exists (select 1 from public.profiles p where p.id = child_id and p.parent_id = auth.uid()));

-- ============================================================
-- Functions
-- ============================================================

-- Persists newly-earned badges for the calling child and awards their XP
-- exactly once each (ON CONFLICT DO NOTHING keeps repeat calls idempotent).
-- Badge eligibility itself is computed client-side from transaction history
-- and profile state (same trust boundary as the rest of this app's
-- gamification, e.g. the login streak); this function is the sole writer of
-- user_badges and is the only thing that can award badge XP, and it derives
-- the XP value itself from the tier prefix of the badge key rather than
-- trusting a client-supplied amount, so a badge key it doesn't recognize (or
-- a tampered call) grants nothing.
create or replace function public.sync_badges(p_badge_keys text[])
returns table(total_xp int, newly_earned text[])
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_key text;
  v_tier text;
  v_xp int;
  v_gained int := 0;
  v_new text[] := '{}';
begin
  foreach v_key in array coalesce(p_badge_keys, '{}') loop
    v_tier := split_part(v_key, '__', 1);
    v_xp := case v_tier
      when 'starter' then 100
      when 'common' then 200
      when 'regular' then 350
      when 'uncommon' then 600
      when 'rare' then 1000
      when 'epic' then 1500
      when 'legendary' then 2000
      else 0
    end;

    if v_xp > 0 then
      insert into public.user_badges (child_id, badge_key)
      values (v_uid, v_key)
      on conflict (child_id, badge_key) do nothing;
      if found then
        v_gained := v_gained + v_xp;
        v_new := array_append(v_new, v_key);
      end if;
    end if;
  end loop;

  if v_gained > 0 then
    update public.profiles set xp = xp + v_gained where id = v_uid;
  end if;

  return query select p.xp, v_new from public.profiles p where p.id = v_uid;
end; $$;

grant execute on function public.sync_badges(text[]) to authenticated;

-- Bumps the caller's monthly-summary view counter. Called once per page visit.
create or replace function public.bump_summary_views()
returns int language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  update public.profiles set summary_views_count = summary_views_count + 1
  where id = auth.uid()
  returning summary_views_count into v_count;
  return v_count;
end; $$;

grant execute on function public.bump_summary_views() to authenticated;

-- Bumps the caller's transaction-history view counter. Called once per page visit.
create or replace function public.bump_history_views()
returns int language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  update public.profiles set history_views_count = history_views_count + 1
  where id = auth.uid()
  returning history_views_count into v_count;
  return v_count;
end; $$;

grant execute on function public.bump_history_views() to authenticated;

-- Lets a child pick their own avatar options.
create or replace function public.update_avatar(p_skin text, p_hair_style text, p_hair_color text, p_face text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.profiles set
    avatar_skin = coalesce(nullif(p_skin, ''), avatar_skin),
    avatar_hair_style = coalesce(nullif(p_hair_style, ''), avatar_hair_style),
    avatar_hair_color = coalesce(nullif(p_hair_color, ''), avatar_hair_color),
    avatar_face = coalesce(nullif(p_face, ''), avatar_face)
  where id = auth.uid();
end; $$;

grant execute on function public.update_avatar(text, text, text, text) to authenticated;

-- Re-created (was defined in 0004) to also award login XP: 5 XP for a fresh
-- (1-day) streak, 10 XP for continuing a streak under a week, 35 XP once the
-- streak reaches 7+ days. Still at most once per calendar day.
create or replace function public.bump_daily_streak(p_today date)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_last date;
  v_streak int;
  v_login_xp int;
begin
  select last_login_date, streak_count into v_last, v_streak
  from public.profiles where id = auth.uid();

  if v_last = p_today then
    return v_streak;
  elsif v_last = p_today - 1 then
    v_streak := v_streak + 1;
  else
    v_streak := 1;
  end if;

  v_login_xp := case when v_streak >= 7 then 35 when v_streak > 1 then 10 else 5 end;

  update public.profiles
  set streak_count = v_streak, last_login_date = p_today, xp = xp + v_login_xp
  where id = auth.uid();

  return v_streak;
end; $$;
