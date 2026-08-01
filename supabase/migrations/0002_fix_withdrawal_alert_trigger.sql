-- Fix handle_withdrawal_alert() so editing a transaction's type keeps the
-- alerts table in sync instead of leaving stale/missing alerts behind:
--   * withdrawal -> deposit edit: previously left the old alert dangling
--     forever (trigger only acted when new.type = 'withdrawal').
--   * deposit -> withdrawal edit: previously created no alert at all,
--     because the old UPDATE branch only ever ran a bare UPDATE, which
--     matches zero rows when no alert exists yet.
-- Insert-time behavior for withdrawals is unchanged.

create or replace function public.handle_withdrawal_alert()
returns trigger language plpgsql security definer set search_path = public as $$
declare child_display_name text;
begin
  if tg_op = 'INSERT' then
    if new.type = 'withdrawal' then
      select display_name into child_display_name from public.profiles where id = new.child_id;
      insert into public.alerts (parent_id, child_id, child_name, transaction_id, amount, category, reason, location, date, time)
      values (new.parent_id, new.child_id, coalesce(child_display_name,''), new.id, new.amount, new.category, new.reason, new.location, new.date, new.time);
    end if;
  elsif tg_op = 'UPDATE' then
    if new.type = 'withdrawal' then
      select display_name into child_display_name from public.profiles where id = new.child_id;
      -- Upsert: the transaction may have just become a withdrawal (no
      -- existing alert row), or may already have one from insert time.
      insert into public.alerts (parent_id, child_id, child_name, transaction_id, amount, category, reason, location, date, time)
      values (new.parent_id, new.child_id, coalesce(child_display_name,''), new.id, new.amount, new.category, new.reason, new.location, new.date, new.time)
      on conflict (transaction_id) do update set
        parent_id = excluded.parent_id,
        child_id = excluded.child_id,
        child_name = excluded.child_name,
        amount = excluded.amount,
        category = excluded.category,
        reason = excluded.reason,
        location = excluded.location,
        date = excluded.date,
        time = excluded.time;
    else
      -- Transaction was edited away from 'withdrawal' (e.g. to 'deposit');
      -- any alert tied to it no longer reflects a real withdrawal.
      delete from public.alerts where transaction_id = new.id;
    end if;
  end if;
  return new;
end; $$;
