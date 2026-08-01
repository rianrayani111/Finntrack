-- FinnTrack initial schema: profiles, transactions, goals, alerts,
-- supporting triggers, and Row Level Security policies.

-- ============================================================
-- Tables
-- ============================================================

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('parent','child')),
  display_name text not null,
  email text,                          -- null for children
  username text,                       -- null for parents
  parent_id uuid references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create unique index profiles_username_lower_idx
  on public.profiles (lower(username)) where username is not null;

alter table public.profiles
  add constraint profiles_parent_shape check (
    (role = 'parent' and parent_id is null and username is null and email is not null)
    or (role = 'child' and parent_id is not null and username is not null)
  );

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.profiles(id) on delete cascade,
  parent_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('deposit','withdrawal')),
  amount numeric(12,2) not null check (amount > 0),
  category text,
  reason text not null,
  location text not null default '',
  date date not null,
  time time not null,
  created_by text not null check (created_by in ('parent','child')),
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  constraint transactions_withdrawal_shape check (
    (type = 'deposit' and category is null)
    or (type = 'withdrawal' and category is not null and location <> '')
  )
);
create index transactions_child_id_idx on public.transactions (child_id);
create index transactions_parent_id_idx on public.transactions (parent_id);

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references public.profiles(id) on delete cascade,
  child_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  goal_type text not null check (goal_type in ('earn','save')),
  target_amount numeric(12,2) not null check (target_amount > 0),
  start_date date not null,
  end_date date not null check (end_date >= start_date),
  reward text not null default '',
  baseline_balance numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index goals_child_id_idx on public.goals (child_id);
create index goals_parent_id_idx on public.goals (parent_id);

create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references public.profiles(id) on delete cascade,
  child_id uuid not null references public.profiles(id) on delete cascade,
  child_name text not null,
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  amount numeric(12,2) not null,
  category text not null,
  reason text not null,
  location text not null,
  date date not null,
  time time not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index alerts_parent_id_idx on public.alerts (parent_id);
create unique index alerts_transaction_id_idx on public.alerts (transaction_id);

-- ============================================================
-- Triggers
-- ============================================================

-- Auto-create a profile row whenever a new auth.users row appears.
-- Both parent self-signup AND the Edge Function's admin-created child accounts
-- go through this one trigger, driven entirely by user_metadata — no branching
-- needed in application code. `role` has NO default: every caller (client signUp,
-- Edge Function admin createUser) MUST pass it explicitly, so a missing/forgotten
-- metadata field fails loudly instead of silently defaulting to 'parent'.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, role, display_name, email, username, parent_id)
  values (
    new.id,
    new.raw_user_meta_data->>'role',
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    case when new.raw_user_meta_data->>'role' = 'parent' then new.email else null end,
    new.raw_user_meta_data->>'username',
    nullif(new.raw_user_meta_data->>'parent_id', '')::uuid
  );
  return new;
end; $$;

create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();

-- Auto-create an alert whenever a withdrawal transaction is inserted, AND keep it
-- in sync when that transaction is later edited by a parent (mirrors the previous
-- localStorage-fallback behavior where editing a transaction also patched its alert).
create or replace function public.handle_withdrawal_alert()
returns trigger language plpgsql security definer set search_path = public as $$
declare child_display_name text;
begin
  if new.type = 'withdrawal' then
    select display_name into child_display_name from public.profiles where id = new.child_id;
    if tg_op = 'INSERT' then
      insert into public.alerts (parent_id, child_id, child_name, transaction_id, amount, category, reason, location, date, time)
      values (new.parent_id, new.child_id, coalesce(child_display_name,''), new.id, new.amount, new.category, new.reason, new.location, new.date, new.time);
    elsif tg_op = 'UPDATE' then
      update public.alerts set
        child_id = new.child_id, child_name = coalesce(child_display_name,''),
        amount = new.amount, category = new.category, reason = new.reason,
        location = new.location, date = new.date, time = new.time
      where transaction_id = new.id;
    end if;
  end if;
  return new;
end; $$;

create trigger on_withdrawal_created
  after insert on public.transactions for each row execute function public.handle_withdrawal_alert();
create trigger on_withdrawal_updated
  after update on public.transactions for each row execute function public.handle_withdrawal_alert();

-- Username-availability check callable by any authenticated user without opening
-- up a broad cross-family SELECT policy on profiles.
create or replace function public.check_username_available(p_username text)
returns boolean language sql security definer set search_path = public as $$
  select not exists (select 1 from public.profiles where lower(username) = lower(p_username));
$$;

-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.profiles enable row level security;
alter table public.transactions enable row level security;
alter table public.goals enable row level security;
alter table public.alerts enable row level security;

-- profiles: read own row, read own children, update own row. No client INSERT
-- policy at all (rows only ever created via the security-definer trigger above).
create policy profiles_select_own on public.profiles for select using (id = auth.uid());
create policy profiles_select_children on public.profiles for select using (parent_id = auth.uid());
create policy profiles_update_own on public.profiles for update using (id = auth.uid());
create policy profiles_delete_children on public.profiles for delete using (parent_id = auth.uid());

-- transactions: parent+child can read their own; parent inserts deposits for their
-- own child, child inserts withdrawals for themself; only parent can update; no
-- delete policy (deletion is disabled by design in the app).
create policy transactions_select_own on public.transactions for select
  using (parent_id = auth.uid() or child_id = auth.uid());
create policy transactions_insert_parent_deposit on public.transactions for insert with check (
  type = 'deposit' and parent_id = auth.uid()
  and exists (select 1 from public.profiles p where p.id = child_id and p.parent_id = auth.uid())
);
create policy transactions_insert_child_withdrawal on public.transactions for insert with check (
  type = 'withdrawal' and child_id = auth.uid()
  and parent_id = (select parent_id from public.profiles where id = auth.uid())
);
create policy transactions_update_parent on public.transactions for update
  using (parent_id = auth.uid()) with check (parent_id = auth.uid());

-- goals: parent full CRUD on own family, child read-only on own goals.
create policy goals_select_own on public.goals for select
  using (parent_id = auth.uid() or child_id = auth.uid());
create policy goals_insert_parent on public.goals for insert with check (
  parent_id = auth.uid() and exists (select 1 from public.profiles p where p.id = child_id and p.parent_id = auth.uid())
);
create policy goals_update_parent on public.goals for update
  using (parent_id = auth.uid()) with check (parent_id = auth.uid());
create policy goals_delete_parent on public.goals for delete using (parent_id = auth.uid());

-- alerts: parent read/update only. No insert/delete policy for ANY client role —
-- the only writer is the SECURITY DEFINER trigger, which bypasses RLS.
create policy alerts_select_parent on public.alerts for select using (parent_id = auth.uid());
create policy alerts_update_parent on public.alerts for update
  using (parent_id = auth.uid()) with check (parent_id = auth.uid());
