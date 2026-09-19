import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Award } from "lucide-react";

import usePageMeta from "@/hooks/usePageMeta";
import { education } from "@/api/education";
import {
  ASSET_KIND_LABELS,
  CATEGORY_LABELS,
  Chip,
  ChipRow,
  Empty,
  ErrorBanner,
  PageTitle,
  Section,
  SmallButton,
  Spinner,
  formatEdu,
  ordinal,
  useLoad,
} from "@/components/student/StudentUI";

const shortDate = (value) =>
  new Date(`${value}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });

export default function StudentPortfolio() {
  usePageMeta("Portfolio Inspector", "A classmate's portfolio.", "/student/class");
  const { studentId } = useParams();
  const navigate = useNavigate();
  const { data: p, loading, error } = useLoad(() => education.portfolio(studentId), [studentId]);

  if (loading) return <Spinner />;
  if (!p) return <ErrorBanner message={error} />;

  // Weekly payday snapshots, plus today's value as the last point.
  const history = [
    ...(p.history || []).map((h) => ({ label: shortDate(h.date), value: Number(h.netWorth) })),
    { label: "Now", value: Number(p.netWorth) },
  ];
  const weeklyInterest = Number(p.weeklyInterest) || 0;

  return (
    <div>
      <div className="flex items-start justify-between gap-2">
        <PageTitle>Detailed Portfolio Inspector</PageTitle>
        <SmallButton onClick={() => navigate("/student/class")}>Close</SmallButton>
      </div>
      <ChipRow>
        <Chip label="Selected" value={`${p.displayName} (Rank #${p.rank})`} />
        <Chip label="Net worth" value={formatEdu(p.netWorth)} tone="green" />
        <Chip label="Liquid cash" value={formatEdu(p.cash)} tone="amber" />
      </ChipRow>

      <Section title="Student Profile & Custom Quote">
        <div className="finn-card space-y-1 text-sm font-semibold text-slate-700 max-w-2xl">
          <p>
            Name: <span className="font-extrabold text-slate-900">{p.avatarEmoji} {p.displayName}</span>
          </p>
          {p.quote && <p>Personal quote: &ldquo;{p.quote}&rdquo;</p>}
          <p>
            Current job:{" "}
            {p.job ? `${p.job.icon} ${p.job.title} (${formatEdu(p.job.weeklySalary)} EduBucks/week base salary)` : "None"}
          </p>
          <p>Class rank: {ordinal(p.rank)} place</p>
        </div>
      </Section>

      <Section title="Net Worth Growth" subtitle="Taken every payday">
        <div className="finn-card">
          {history.length < 2 ? (
            <Empty>The chart fills in after the first payday.</Empty>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={history} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 12, fontWeight: 700 }} />
                  <YAxis tickFormatter={(v) => `$${v}`} tick={{ fontSize: 12, fontWeight: 700 }} width={56} />
                  <Tooltip
                    formatter={(v) => [formatEdu(v), "Net worth"]}
                    contentStyle={{ borderRadius: 16, border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.1)" }}
                  />
                  <Line type="stepAfter" dataKey="value" stroke="#0ea5e9" strokeWidth={3} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </Section>

      <Section title="Asset Breakdown & Portfolio Allocation">
        <div className="finn-card overflow-x-auto">
          {!p.showHoldings ? (
            <Empty>{p.displayName} keeps their holdings private.</Empty>
          ) : (
            <table className="w-full text-sm min-w-[520px]">
              <thead>
                <tr className="text-left text-slate-500 font-bold">
                  <th className="pb-2">Asset</th>
                  <th className="pb-2">Category</th>
                  <th className="pb-2">Qty owned</th>
                  <th className="pb-2 text-right">Current value</th>
                  <th className="pb-2 text-right">Weekly income</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                {p.assets.map((a) => (
                  <tr key={a.name}>
                    <td className="py-2">{a.name}</td>
                    <td className="py-2">{a.assetKind ? ASSET_KIND_LABELS[a.assetKind] : CATEGORY_LABELS[a.category]}</td>
                    <td className="py-2">{a.quantity}</td>
                    <td className="py-2 text-right">{formatEdu(a.value)}</td>
                    <td className="py-2 text-right">{Number(a.weeklyIncome) > 0 ? `+${formatEdu(a.weeklyIncome)} rent` : "—"}</td>
                  </tr>
                ))}
                <tr>
                  <td className="py-2">Bank Vault Balance</td>
                  <td className="py-2">Savings</td>
                  <td className="py-2">—</td>
                  <td className="py-2 text-right">{formatEdu(p.savings)}</td>
                  <td className="py-2 text-right">{weeklyInterest > 0 ? `+${formatEdu(weeklyInterest)} interest` : "—"}</td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
      </Section>

      <Section title="Displayed Badges">
        <div className="finn-card flex flex-wrap gap-2">
          {p.badges.length === 0 ? (
            <Empty>No badges pinned yet.</Empty>
          ) : (
            p.badges.map((b) => (
              <span key={b.key} className="inline-flex items-center gap-1.5 rounded-2xl bg-amber-50 border-2 border-amber-100 px-3 py-1.5 text-sm font-extrabold text-amber-800">
                <Award className="w-4 h-4" /> {b.name}
              </span>
            ))
          )}
        </div>
      </Section>
    </div>
  );
}
