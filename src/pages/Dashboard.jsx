import React, { useEffect, useState } from "react";
import { db } from '@/api/base44Client';
import { Link } from "react-router-dom";

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import { TrendingUp, TrendingDown, PiggyBank, Wallet, PlusCircle } from "lucide-react";
import FinnLogo from "@/components/FinnLogo";
import {
  formatCurrency,
  currentBalance,
  earningsForMonth,
  spendingForMonth,
  needsVsWantsData,
  assetsVsLiabilitiesData,
  sortByDateDesc,
  CATEGORY_LABELS,
  transactionType,
  transactionReason,
} from "@/lib/finance";

const now = new Date();

function StatCard({ title, value, icon: Icon, tone, subtitle }) {
  const tones = {
    sky: "from-sky-400 to-sky-600",
    green: "from-emerald-400 to-emerald-600",
    red: "from-rose-400 to-rose-600",
    amber: "from-amber-400 to-amber-500",
  };
  return (
    <div className={`bg-gradient-to-br ${tones[tone]} rounded-3xl p-5 text-white shadow-lg`}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold opacity-90">{title}</span>
        <Icon className="w-5 h-5 opacity-90" />
      </div>
      <p className="text-3xl font-extrabold mt-2">{value}</p>
      {subtitle && <p className="text-xs opacity-80 mt-1 font-semibold">{subtitle}</p>}
    </div>
  );
}

function PieChartCard({ title, data, emptyText }) {
  return (
    <div className="finn-card">
      <h3 className="font-extrabold text-slate-700 mb-3">{title}</h3>
      {data.length === 0 ? (
        <div className="h-48 flex items-center justify-center text-sm text-muted-foreground font-semibold text-center">
          {emptyText}
        </div>
      ) : (
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={80}
                innerRadius={45}
                paddingAngle={3}
              >
                {data.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(v) => formatCurrency(v)}
                contentStyle={{ borderRadius: 16, border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.1)" }}
              />
              <Legend wrapperStyle={{ fontSize: 13, fontWeight: 700 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    db.entities.Transaction.list("-date", 500)
      .then((items) => setTransactions(items || []))
      .finally(() => setLoading(false));
  }, []);

  const balance = currentBalance(transactions);
  const earnedThisMonth = earningsForMonth(transactions, now.getFullYear(), now.getMonth());
  const spentThisMonth = spendingForMonth(transactions, now.getFullYear(), now.getMonth());
  const savings = balance;
  const needsWants = needsVsWantsData(transactions);
  const assetsLiab = assetsVsLiabilitiesData(transactions);
  const recent = sortByDateDesc(transactions).slice(0, 5);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-4 border-sky-200 border-t-sky-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-800">Dashboard</h1>
          <p className="text-muted-foreground font-semibold">
            {now.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </p>
        </div>
        <Link
          to="/add"
          className="inline-flex items-center gap-2 bg-sky-500 hover:bg-sky-600 text-white font-bold px-5 py-3 rounded-2xl shadow-md transition-all"
        >
          <PlusCircle className="w-5 h-5" />
          Log Withdrawal
        </Link>
      </div>

      {transactions.length === 0 && (
        <div className="finn-card flex flex-col items-center text-center py-10">
          <FinnLogo className="w-40 h-40" />
          <p className="mt-4 text-base font-extrabold text-slate-700">No transactions yet.</p>
          <p className="text-sm text-muted-foreground font-semibold">
            Start by logging your first withdrawal.
          </p>
        </div>
      )}

      {/* Balance hero */}
      <div className="bg-gradient-to-br from-sky-500 to-sky-700 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute -right-6 -top-6 w-32 h-32 bg-white/10 rounded-full" />
        <div className="absolute right-10 bottom-0 w-20 h-20 bg-white/10 rounded-full" />
        <div className="relative">
          <div className="flex items-center gap-2 text-sm font-bold opacity-90">
            <Wallet className="w-4 h-4" />
            Current Balance
          </div>
          <p className="text-5xl sm:text-6xl font-extrabold mt-2">{formatCurrency(balance)}</p>
          <p className="text-sm opacity-90 mt-2 font-semibold">
            {balance >= 0 ? "You're in the green — great job! 🐬" : "Keep tracking to stay on top of it!"}
          </p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Earned This Month"
          value={formatCurrency(earnedThisMonth)}
          icon={TrendingUp}
          tone="green"
          subtitle="Money in"
        />
        <StatCard
          title="Spent This Month"
          value={formatCurrency(spentThisMonth)}
          icon={TrendingDown}
          tone="red"
          subtitle="Money out"
        />
        <StatCard
          title="Savings"
          value={formatCurrency(savings)}
          icon={PiggyBank}
          tone="amber"
          subtitle="Available balance"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PieChartCard
          title="Needs vs Wants"
          data={needsWants}
          emptyText="Add spending to see your Needs vs Wants breakdown."
        />
        <PieChartCard
          title="Assets vs Liabilities"
          data={assetsLiab}
          emptyText="Add spending to see your Assets vs Liabilities breakdown."
        />
      </div>

      {/* Recent transactions */}
      <div className="finn-card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-extrabold text-slate-700">Recent Transactions</h3>
          <Link to="/history" className="text-sm text-sky-600 font-bold hover:underline">
            View all
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="text-sm text-muted-foreground font-semibold py-6 text-center">
            No transactions yet.
          </p>
        ) : (
          <div className="space-y-2">
            {recent.map((t) => {
              const isEarn = transactionType(t) === "deposit";
              return (
                <div
                  key={t.id}
                  className="flex items-center justify-between py-3 px-4 rounded-2xl bg-slate-50 hover:bg-sky-50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        isEarn ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-500"
                      }`}
                    >
                      {isEarn ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-slate-700 truncate">{transactionReason(t)}</p>
                      <p className="text-xs text-muted-foreground font-semibold">
                        {new Date(t.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })} ·{" "}
                        {CATEGORY_LABELS[String(t.category)] || 'Deposit'}
                      </p>
                    </div>
                  </div>
                  <span className={`font-extrabold ${isEarn ? "text-emerald-600" : "text-rose-500"}`}>
                    {isEarn ? "+" : "-"}
                    {formatCurrency(t.amount)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}