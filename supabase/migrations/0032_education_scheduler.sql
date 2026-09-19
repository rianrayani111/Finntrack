-- Runs the classroom economy's timed work (auctions ending, bonds maturing,
-- job terms ending, paydays) every five minutes via pg_cron.
--
-- Everything here also runs lazily whenever a student opens the portal
-- (edu_refresh, 0031), so the portal stays correct without this job. What
-- the job adds: an auction still ends on time when nobody in the class is
-- online, and payday lands on payday rather than on the next visit.
--
-- Kept in its own migration because it needs the pg_cron extension. On a
-- hosted project, enable it first under Database -> Extensions -> pg_cron
-- (the create extension below is then a no-op).

create extension if not exists pg_cron with schema pg_catalog;

-- Re-running this migration replaces the job instead of adding a second one.
select cron.unschedule(jobid) from cron.job where jobname = 'edu-process-classes';

select cron.schedule('edu-process-classes', '*/5 * * * *', $$select public.edu_run_scheduled();$$);
