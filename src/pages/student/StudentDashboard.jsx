import React from "react";
import { Link } from "react-router-dom";
import { Flame, PiggyBank, Trophy, TrendingUp, Wallet, CalendarClock } from "lucide-react";

import usePageMeta from "@/hooks/usePageMeta";
import { education } from "@/api/education";
import MyListingActions from "@/components/student/MyListingActions";
import {
  DAY_NAMES,
  Empty,
  ErrorBanner,
  PageTitle,
  Pill,
  Section,
  Spinner,
  StatusDot,
  formatEdu,
  formatTimeLeft,
  ordinal,
  paydayText,
  useLoad,
  useStudent,
} from "@/components/student/StudentUI";

function Stat({ icon: Icon, label, value, hint, tone }) {
  const tones = {
    sky: "from-sky-400 to-sky-600",
    green: "from-emerald-400 to-emerald-600",
    amber: "from-amber-400 to-amber-500",
    violet: "from-violet-400 to-violet-600",
  };
  return (
    <div className={`bg-gradient-to-br ${tones[tone]} rounded-3xl p-4 text-white shadow-lg`}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold opacity-90">{label}</span>
        <Icon className="w-5 h-5 opacity-90" />
      </div>
      <p className="text-2xl font-extrabold mt-1">{value}</p>
      {hint && <p className="text-xs opacity-85 mt-0.5 font-semibold">{hint}</p>}
    </div>
  );
}

export default function StudentDashboard() {
  usePageMeta("Student Dashboard", "Your FinnTrack student dashboard.", "/student");
  const { summary, refreshSummary } = useStudent();

  const { data, loading, error, reload } = useLoad(async () => {
    const [listings, jobs] = await Promise.all([education.listings(), education.jobs()]);
    const myAssignment = jobs.assignments.find((a) => a.studentId === summary.studentId) || null;
    return {
      myListings: listings.filter((l) => l.sellerId === summary.studentId),
      myAssignment,
      myJob: myAssignment ? jobs.jobs.find((j) => j.id === myAssignment.jobId) : null,
    };
  }, [summary.studentId]);

  const onListingChanged = () => {
    reload();
    refreshSummary();
  };

  const payday = DAY_NAMES[summary.paydayDow];

  return (
    <div>
      <PageTitle>My Financial Dashboard</PageTitle>

      <Section title="My Balances">
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          <Stat icon={Wallet} tone="sky" label="Spending Cash" value={formatEdu(summary.cash)} hint="EduBucks" />
          <Stat icon={PiggyBank} tone="green" label="Bank Savings" value={formatEdu(summary.savings)} hint="EduBucks" />
          <Stat icon={TrendingUp} tone="violet" label="Net Worth" value={formatEdu(summary.netWorth)} hint="Cash, savings & items" />
          <Stat
            icon={CalendarClock}
            tone="amber"
            label="Weekly Paycheck"
            value={data?.myJob ? formatEdu(data.myJob.weeklySalary) : "$0.00"}
            hint={data?.myJob ? `Arrives ${payday} (${paydayText(summary)})` : "Apply for a job to get paid"}
          />
          <Stat
            icon={Trophy}
            tone="sky"
            label="Class Rank"
            value={`${ordinal(summary.rank)} place`}
            hint={`of ${summary.classSize} students`}
          />
          <Stat
            icon={Flame}
            tone="amber"
            label="Login Streak"
            value={`${summary.streakCount} day${summary.streakCount === 1 ? "" : "s"}`}
            hint="Log in every day to keep it going"
          />
        </div>
      </Section>

      <ErrorBanner message={error} />
      {loading ? (
        <Spinner />
      ) : (
        <>
          <Section
            title="Active Store Resale Listings"
            subtitle="Your items on the class marketplace"
            action={
              <Link to="/student/marketplace" className="text-sm font-bold text-sky-600 hover:underline">
                Go to marketplace
              </Link>
            }
          >
            <div className="finn-card overflow-x-auto">
              {data.myListings.length === 0 ? (
                <Empty>You aren&apos;t selling anything right now.</Empty>
              ) : (
                <table className="w-full text-sm min-w-[560px]">
                  <thead>
                    <tr className="text-left text-slate-500 font-bold">
                      <th className="pb-2">Item / Privilege</th>
                      <th className="pb-2">Listed price</th>
                      <th className="pb-2">Original price</th>
                      <th className="pb-2">Market status</th>
                      <th className="pb-2">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.myListings.map((l) => (
                      <tr key={l.id} className="font-semibold text-slate-700">
                        <td className="py-2.5">{l.item?.name}</td>
                        <td className="py-2.5">
                          {formatEdu(l.saleType === "auction" && l.highBid ? l.highBid : l.price)}
                          {l.saleType === "auction" && (
                            <span className="block text-xs text-slate-500">
                              {l.bidCount ? `${l.bidCount} bid${l.bidCount === 1 ? "" : "s"}` : "Auction, no bids yet"}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5">{l.originalPrice !== null ? formatEdu(l.originalPrice) : "—"}</td>
                        <td className="py-2.5">
                          {l.status === "pending_approval" ? (
                            <Pill tone="amber">Waiting for teacher</Pill>
                          ) : (
                            <StatusDot tone="green">
                              Live on market
                              {l.endsAt && <span className="text-xs text-slate-500"> · {formatTimeLeft(l.endsAt)}</span>}
                            </StatusDot>
                          )}
                        </td>
                        <td className="py-2.5">
                          <MyListingActions listing={l} onChanged={onListingChanged} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </Section>

          <Section title="My Current Classroom Job">
            <div className="finn-card space-y-2 max-w-xl">
              {data.myJob ? (
                <>
                  <p className="font-bold text-slate-700">
                    Assigned role: <span className="text-slate-900">{data.myJob.icon} {data.myJob.title}</span>
                  </p>
                  <p className="font-bold text-slate-700 flex flex-wrap items-center gap-1.5">
                    Duty status: <StatusDot tone="green">Active</StatusDot>
                    <span className="text-slate-500">(payday {paydayText(summary)})</span>
                  </p>
                  {data.myJob.nextTask && (
                    <p className="font-bold text-slate-700">
                      Next task: <span className="font-semibold">{data.myJob.nextTask}</span>
                    </p>
                  )}
                </>
              ) : (
                <p className="text-sm font-semibold text-slate-500">
                  You don&apos;t have a classroom job yet.{" "}
                  <Link to="/student/jobs" className="text-sky-600 font-bold hover:underline">
                    See open positions
                  </Link>
                </p>
              )}
            </div>
          </Section>
        </>
      )}
    </div>
  );
}
