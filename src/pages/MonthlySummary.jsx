import React, { useEffect, useState } from "react";
import { db } from '@/api/db';

import { ChevronLeft, ChevronRight } from "lucide-react";
import FinnLogo from "@/components/FinnLogo";
import {
  buildMonthToDateSummary,
  buildMonthlySummary,
  formatCurrency,
} from "@/lib/finance";

export default function MonthlySummary() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth());

  useEffect(() => {
    db.entities.Transaction.list()
      .then((items) => setTransactions(items || []))
      .catch((error) => {
        setLoadError(error.message || "Could not load your summary. Please refresh and try again.");
      })
      .finally(() => setLoading(false));
    db.users.bumpSummaryViews().catch(() => {});
  }, []);

  const summary = buildMonthlySummary(transactions, year, month);
  const monthToDateSummary = buildMonthToDateSummary(transactions, year, month);
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();
  const hasAnyData = transactions.length > 0;

  // Computed from the current values rather than nesting setYear inside the
  // setMonth updater: updaters must be pure and React may run them twice (it
  // does under StrictMode), which would step the year by 2 on a year boundary.
  const shiftMonth = (delta) => {
    const absolute = year * 12 + month + delta;
    setYear(Math.floor(absolute / 12));
    setMonth(((absolute % 12) + 12) % 12);
  };

  const monthLabel = new Date(year, month).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-800">Monthly Summary</h1>
          <p className="text-muted-foreground font-semibold">A single month of deposits and withdrawals at a glance.</p>
        </div>
        <div className="flex items-center gap-2 bg-white rounded-2xl border-2 border-border px-2 py-1 shadow-sm">
          <button
            onClick={() => shiftMonth(-1)}
            className="p-2 rounded-xl hover:bg-sky-50 text-sky-600"
            aria-label="Previous month"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="font-extrabold text-slate-700 text-lg w-40 text-center">{monthLabel}</span>
          <button
            onClick={() => shiftMonth(1)}
            disabled={year >= currentYear && month >= currentMonth}
            className="p-2 rounded-xl hover:bg-sky-50 text-sky-600 disabled:opacity-30"
            aria-label="Next month"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-sky-200 border-t-sky-600 rounded-full animate-spin" />
        </div>
      ) : loadError ? (
        // Checked ahead of the empty state: a failed load also produces zero
        // transactions, and "No data available yet" would hide the failure.
        <div className="finn-card text-center py-10">
          <p className="text-slate-700 font-bold">Could not load your summary</p>
          <p className="text-sm text-muted-foreground font-semibold mt-1">{loadError}</p>
        </div>
      ) : !hasAnyData ? (
        <div className="finn-card flex flex-col items-center text-center py-10">
          <FinnLogo className="w-40 h-40" />
          <p className="mt-4 text-base font-extrabold text-slate-700">No data available yet.</p>
        </div>
      ) : (
        <div className="finn-card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-sky-500 text-white">
                  <th className="text-left font-bold px-4 py-4 sticky top-0 z-10">Month</th>
                  <th className="text-right font-bold px-4 py-4">Assets</th>
                  <th className="text-right font-bold px-4 py-4">Liabilities</th>
                  <th className="text-right font-bold px-4 py-4">Necessity</th>
                  <th className="text-right font-bold px-4 py-4">Want</th>
                  <th className="text-right font-bold px-4 py-4">Money Added</th>
                  <th className="text-right font-bold px-4 py-4">Net Profit / Loss</th>
                </tr>
              </thead>
              <tbody>
                <tr className={summary.hasData ? "bg-white" : "bg-sky-50/50 text-muted-foreground"}>
                  <td className="px-4 py-3 font-bold text-slate-700">{summary.name}</td>
                  <td className={`px-4 py-3 text-right ${summary.hasData ? "text-red-500 font-bold" : ""}`}>
                    {summary.hasData ? formatCurrency(summary.asset) : "—"}
                  </td>
                  <td className={`px-4 py-3 text-right ${summary.hasData ? "text-red-500 font-bold" : ""}`}>
                    {summary.hasData ? formatCurrency(summary.liability) : "—"}
                  </td>
                  <td className={`px-4 py-3 text-right ${summary.hasData ? "text-red-500 font-bold" : ""}`}>
                    {summary.hasData ? formatCurrency(summary.necessity) : "—"}
                  </td>
                  <td className={`px-4 py-3 text-right ${summary.hasData ? "text-red-500 font-bold" : ""}`}>
                    {summary.hasData ? formatCurrency(summary.want) : "—"}
                  </td>
                  <td className={`px-4 py-3 text-right ${summary.hasData ? "text-emerald-600 font-bold" : ""}`}>
                    {summary.hasData ? formatCurrency(summary.earned) : "—"}
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-extrabold ${
                      !summary.hasData
                        ? ""
                        : summary.net >= 0
                        ? "text-emerald-600"
                        : "text-red-500"
                    }`}
                  >
                    {summary.hasData ? formatCurrency(summary.net) : "—"}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {year === currentYear && month === currentMonth && (
        <div className="finn-card border-sky-200 bg-sky-50/70">
          <p className="text-sm font-bold text-sky-700">So far this month</p>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Earned</p>
              <p className="text-lg font-extrabold text-emerald-600">
                {formatCurrency(monthToDateSummary.earned)}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Spent</p>
              <p className="text-lg font-extrabold text-red-500">
                {formatCurrency(monthToDateSummary.spending)}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Net</p>
              <p className={`text-lg font-extrabold ${monthToDateSummary.net >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                {formatCurrency(monthToDateSummary.net)}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="finn-card">
          <p className="text-sm font-bold text-muted-foreground">Total Added ({monthLabel})</p>
          <p className="text-2xl font-extrabold text-emerald-600 mt-1">
            {formatCurrency(summary.earned)}
          </p>
        </div>
        <div className="finn-card">
          <p className="text-sm font-bold text-muted-foreground">Total Spent ({monthLabel})</p>
          <p className="text-2xl font-extrabold text-red-500 mt-1">
            {formatCurrency(summary.necessity + summary.want + summary.asset + summary.liability)}
          </p>
        </div>
        <div className="finn-card">
          <p className="text-sm font-bold text-muted-foreground">Net ({monthLabel})</p>
          <p className={`text-2xl font-extrabold mt-1 ${summary.net >= 0 ? "text-emerald-600" : "text-red-500"}`}>
            {formatCurrency(summary.net)}
          </p>
        </div>
      </div>
    </div>
  );
}