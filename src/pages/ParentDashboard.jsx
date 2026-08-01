import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { db } from '@/api/db';
import { formatCurrency, currentBalance, transactionType } from '@/lib/finance';
import { Bell, PlusCircle, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ParentDashboard() {
  const navigate = useNavigate();
  const [children, setChildren] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      db.users.listMyChildren(),
      db.entities.Transaction.list(),
      db.alerts.list(),
    ])
      .then(([childrenDocs, txns, alertsDocs]) => {
        setChildren(childrenDocs || []);
        setTransactions(txns || []);
        setAlerts(alertsDocs || []);
      })
      .finally(() => setLoading(false));
  }, []);

  const unreadAlertCount = useMemo(
    () => alerts.filter((item) => !item.read).length,
    [alerts]
  );

  const cardData = useMemo(() => {
    return children.map((child) => {
      const childTxns = transactions.filter((t) => t.childId === child.uid);
      const balance = currentBalance(childTxns);
      const last = childTxns[0] || null;
      return {
        child,
        balance,
        last,
      };
    });
  }, [children, transactions]);

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
          <h1 className="text-3xl font-extrabold text-slate-800">Parent Dashboard</h1>
          <p className="text-muted-foreground font-semibold">Track each child at a glance.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/parent/alerts"
            className="inline-flex items-center gap-2 bg-white border-2 border-slate-200 hover:border-sky-200 px-4 py-3 rounded-2xl font-bold text-slate-700"
          >
            <Bell className="w-5 h-5 text-sky-600" />
            Alerts ({unreadAlertCount} unread)
          </Link>
          <Link
            to="/parent/add-child"
            className="inline-flex items-center gap-2 bg-sky-500 hover:bg-sky-600 text-white font-bold px-5 py-3 rounded-2xl shadow-md"
          >
            <UserPlus className="w-5 h-5" />
            Add a Child
          </Link>
          <Link
            to="/parent/add-money"
            className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold px-5 py-3 rounded-2xl shadow-md"
          >
            <PlusCircle className="w-5 h-5" />
            Add Money
          </Link>
        </div>
      </div>

      {children.length === 0 ? (
        <div className="finn-card text-center py-10">
          <p className="text-slate-700 font-bold">No child accounts yet.</p>
          <p className="text-sm text-muted-foreground font-semibold mt-1">
            Add your first child account to start tracking withdrawals and balances.
          </p>
          <Button className="mt-4" onClick={() => navigate('/parent/add-child')}>
            Add a Child
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {cardData.map(({ child, balance, last }) => {
            const lastActivityText = last
              ? `${transactionType(last) === 'deposit' ? 'Deposit' : 'Withdrawal'} on ${last.date} at ${last.time}`
              : 'No activity yet';

            return (
              <button
                key={child.uid}
                type="button"
                onClick={() => navigate(`/parent/children/${child.uid}`)}
                className="text-left finn-card hover:ring-2 hover:ring-sky-200 transition"
              >
                <p className="text-xs text-muted-foreground font-semibold">Child</p>
                <h3 className="text-xl font-extrabold text-slate-800 mt-1">{child.displayName}</h3>
                <p className="text-sm text-muted-foreground font-semibold">@{child.username}</p>
                <div className="mt-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Current balance</p>
                  <p className="text-2xl font-extrabold text-slate-800">{formatCurrency(balance)}</p>
                </div>
                <p className="mt-4 text-sm text-slate-600 font-semibold">Last activity: {lastActivityText}</p>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
