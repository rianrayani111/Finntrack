-- requests/tasks got length caps on their text fields in 0017; transactions
-- never did. reason, location, and notes are all child-controllable on a
-- withdrawal (see transactionApi.create in src/api/db.js), and the
-- SECURITY DEFINER handle_withdrawal_alert trigger copies reason/location
-- verbatim into a new alerts row on every withdrawal insert/update. An
-- unbounded value here is a storage/DoS nuisance (bloats the parent's alert
-- queries) rather than an XSS risk (React renders all of this as plain text
-- nodes), but there's no reason to leave it unbounded.
--
-- NOT VALID: this table has real production history, and a plain ALTER TABLE
-- ADD CONSTRAINT would revalidate every existing row, failing the whole
-- migration if even one historical row (typed by a user into a form field,
-- so implausible but not impossible) already exceeds the cap. NOT VALID
-- enforces the constraint on every future write without touching existing
-- rows -- same approach as the rest of this app's length caps (0017).

alter table public.transactions
  add constraint transactions_reason_len check (length(reason) <= 2000) not valid;
alter table public.transactions
  add constraint transactions_location_len check (length(location) <= 500) not valid;
alter table public.transactions
  add constraint transactions_notes_len check (length(notes) <= 2000) not valid;
