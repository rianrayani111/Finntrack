import React, { useState } from "react";
import { Loader2, Plus } from "lucide-react";

import usePageMeta from "@/hooks/usePageMeta";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/use-toast";
import { education } from "@/api/education";
import {
  Chip,
  ChipRow,
  DAY_NAMES,
  Empty,
  ErrorBanner,
  PageTitle,
  Pill,
  Section,
  SmallButton,
  Spinner,
  StatusDot,
  formatDate,
  formatEdu,
  useLoad,
  useStudent,
} from "@/components/student/StudentUI";

const PAYROLL_KINDS = ["salary", "charge", "income", "interest"];

export default function StudentJobs() {
  usePageMeta("Job Board", "Classroom jobs and payroll.", "/student/jobs");
  const { summary } = useStudent();
  const [busyJobId, setBusyJobId] = useState(null);
  const [detailsJob, setDetailsJob] = useState(null);

  const { data, loading, error, reload } = useLoad(async () => {
    const [jobs, payroll] = await Promise.all([education.jobs(), education.ledger({ kinds: PAYROLL_KINDS, limit: 30 })]);
    return { ...jobs, payroll };
  }, []);

  if (loading) return <Spinner />;
  if (!data) return <ErrorBanner message={error} />;

  const myAssignment = data.assignments.find((a) => a.studentId === summary.studentId);
  const myJob = myAssignment && data.jobs.find((j) => j.id === myAssignment.jobId);
  const pendingByJob = new Map(data.applications.filter((a) => a.status === "pending").map((a) => [a.jobId, a]));
  const openPositions = data.jobs.filter((j) => j.id !== myJob?.id);
  const payday = DAY_NAMES[summary.paydayDow];

  const apply = async (job) => {
    setBusyJobId(job.id);
    try {
      await education.applyForJob(job.id);
      toast({ title: `Applied for ${job.title}`, description: "Your teacher will choose who gets the job." });
      await reload();
    } catch (err) {
      toast({ title: "Could not apply", description: err.message, variant: "destructive" });
    } finally {
      setBusyJobId(null);
    }
  };

  const withdraw = async (job) => {
    setBusyJobId(job.id);
    try {
      await education.withdrawJobApplication(pendingByJob.get(job.id).id);
      toast({ title: `Application for ${job.title} withdrawn` });
      await reload();
    } catch (err) {
      toast({ title: "Could not withdraw", description: err.message, variant: "destructive" });
    } finally {
      setBusyJobId(null);
    }
  };

  return (
    <div>
      <PageTitle>Classroom Job Board &amp; Workforce</PageTitle>
      <ChipRow>
        <Chip label="Current job" value={myJob ? myJob.title : "None"} />
        <Chip label="Weekly salary" value={formatEdu(myJob?.weeklySalary || 0)} tone="green" />
        <Chip label="Payday" value={payday} tone="amber" />
      </ChipRow>
      <ErrorBanner message={error} />

      <Section title="Your Current Assignment & Duties">
        <div className="finn-card space-y-1.5 text-sm font-bold text-slate-700 max-w-2xl">
          {myJob ? (
            <>
              <p>
                Position: <span className="text-slate-900">{myJob.icon} {myJob.title}</span>
              </p>
              <p>
                Base pay: <span className="text-slate-900">{formatEdu(myJob.weeklySalary)} EduBucks / week</span>
              </p>
              <p className="flex flex-wrap items-center gap-1.5">
                Duty status: <StatusDot tone="green">Active</StatusDot>
                <span className="text-slate-500">until {formatDate(myAssignment.endsAt)}</span>
              </p>
              {myJob.responsibilities && (
                <p>
                  Responsibilities: <span className="font-semibold">{myJob.responsibilities}</span>
                </p>
              )}
              {myJob.nextTask && (
                <p>
                  Next task: <span className="font-semibold">{myJob.nextTask}</span>
                </p>
              )}
            </>
          ) : (
            <p className="font-semibold text-slate-500">You don&apos;t have a job right now. Apply for an open position below.</p>
          )}
        </div>
      </Section>

      <Section title="Open Classroom Positions" subtitle="Apply for the next rotation. Your teacher picks who gets each job.">
        <div className="finn-card divide-y divide-slate-100">
          {openPositions.length === 0 && <Empty>No other positions right now.</Empty>}
          {openPositions.map((job) => {
            const pending = pendingByJob.get(job.id);
            return (
              <div key={job.id} className="py-3 first:pt-0 last:pb-0 space-y-1">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-lg font-extrabold text-slate-800">
                    {job.icon} {job.title}
                  </p>
                  <p className="font-extrabold text-slate-700">Weekly salary: {formatEdu(job.weeklySalary)}</p>
                </div>
                {job.description && (
                  <p className="text-sm font-semibold text-slate-600">
                    <span className="font-bold text-slate-700">Description:</span> {job.description}
                  </p>
                )}
                <p className="text-sm font-semibold text-slate-600">
                  <span className="font-bold text-slate-700">Required qualifications:</span> {job.qualifications || "N/A"}
                </p>
                <p className="text-sm">
                  <span className="font-bold text-slate-700">Status: </span>
                  {job.filled ? <StatusDot tone="red">Filled</StatusDot> : <StatusDot tone="green">Open</StatusDot>}
                </p>
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  {pending ? (
                    <div className="flex items-center gap-2">
                      <Pill tone="amber">Applied</Pill>
                      <SmallButton tone="danger" disabled={busyJobId === job.id} onClick={() => withdraw(job)}>
                        Withdraw
                      </SmallButton>
                    </div>
                  ) : (
                    <SmallButton tone="primary" disabled={job.filled || busyJobId === job.id} onClick={() => apply(job)}>
                      {busyJobId === job.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                      Apply
                    </SmallButton>
                  )}
                  <SmallButton onClick={() => setDetailsJob(job)}>View job details</SmallButton>
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="Payroll & Deduction History">
        <div className="finn-card overflow-x-auto">
          {data.payroll.length === 0 ? (
            <Empty>No paydays yet. Your first one is on {payday}.</Empty>
          ) : (
            <table className="w-full text-sm min-w-[480px]">
              <thead>
                <tr className="text-left text-slate-500 font-bold">
                  <th className="pb-2">Date</th>
                  <th className="pb-2">Description</th>
                  <th className="pb-2 text-right">Amount</th>
                  <th className="pb-2 text-right">Type</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.payroll.map((row) => (
                  <tr key={row.id} className="font-semibold text-slate-700">
                    <td className="py-2">{formatDate(row.createdAt)}</td>
                    <td className="py-2">{row.description}</td>
                    <td className={`py-2 text-right ${row.amount < 0 ? "finn-amount-negative" : "finn-amount-positive"}`}>
                      {row.amount < 0 ? "-" : "+"}
                      {formatEdu(Math.abs(row.amount))}
                    </td>
                    <td className="py-2 text-right">{row.amount < 0 ? "Expense" : "Income"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Section>

      <Section title="Career & Income Lesson">
        <div className="finn-card space-y-1.5 text-sm font-semibold text-slate-700">
          <p>
            <span className="font-extrabold">Skill premium:</span> jobs that need more skills or qualifications pay
            higher salaries.
          </p>
          <p>
            <span className="font-extrabold">Fixed expenses:</span> remember that rent and other charges are deducted on
            payday!
          </p>
        </div>
      </Section>

      <Dialog open={Boolean(detailsJob)} onOpenChange={(open) => !open && setDetailsJob(null)}>
        <DialogContent className="max-w-md rounded-3xl">
          {detailsJob && (
            <>
              <DialogHeader>
                <DialogTitle className="font-extrabold">
                  {detailsJob.icon} {detailsJob.title}
                </DialogTitle>
                <DialogDescription>{formatEdu(detailsJob.weeklySalary)} EduBucks a week, paid every {payday}</DialogDescription>
              </DialogHeader>
              <div className="space-y-2 text-sm font-semibold text-slate-700">
                {detailsJob.description && <p>{detailsJob.description}</p>}
                {detailsJob.responsibilities && (
                  <p>
                    <span className="font-extrabold">Responsibilities:</span> {detailsJob.responsibilities}
                  </p>
                )}
                <p>
                  <span className="font-extrabold">Required qualifications:</span> {detailsJob.qualifications || "N/A"}
                </p>
                <p>
                  <span className="font-extrabold">Status:</span> {detailsJob.filled ? "Filled" : "Open"}
                </p>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
