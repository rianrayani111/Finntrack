import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { db } from '@/api/db';
import { useAuth } from '@/lib/AuthContext';
import {
  buildMonthlySummary,
  CATEGORY_LABELS,
  currentBalance,
  formatCurrency,
  transactionReason,
  transactionType,
} from '@/lib/finance';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Pencil } from 'lucide-react';
import AchievementsPanel from '@/components/AchievementsPanel';

export default function ParentChildDetail() {
  const { childId } = useParams();
  const navigate = useNavigate();
  const { refreshSubscription } = useAuth();
  const [child, setChild] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [earnedBadgeKeys, setEarnedBadgeKeys] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const now = new Date();

  useEffect(() => {
    Promise.all([db.users.getByUid(childId), db.entities.Transaction.list(), db.users.listBadgesForChild(childId)])
      .then(([childDoc, txns, badgeRows]) => {
        setChild(childDoc);
        setTransactions((txns || []).filter((t) => t.childId === childId));
        setEarnedBadgeKeys(new Set((badgeRows || []).map((r) => r.badge_key)));
      })
      .finally(() => setLoading(false));
  }, [childId]);

  const balance = useMemo(() => currentBalance(transactions), [transactions]);
  const summary = useMemo(
    () => buildMonthlySummary(transactions, now.getFullYear(), now.getMonth()),
    [transactions]
  );

  const handleDeleteChild = async () => {
    const confirmDelete = window.confirm(
      'Delete this child account and all their transactions/alerts? This cannot be undone.'
    );
    if (!confirmDelete) return;

    setDeleting(true);
    try {
      await db.users.deleteChild(childId);
      refreshSubscription();
      navigate('/parent');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-4 border-sky-200 border-t-sky-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!child) {
    return (
      <div className="finn-card text-center py-10">
        <p className="font-bold text-slate-700">Child not found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="finn-card">
        <p className="text-sm text-muted-foreground font-semibold">Child detail</p>
        <h1 className="text-3xl font-extrabold text-slate-800 mt-1">{child.displayName}</h1>
        <p className="text-sm text-muted-foreground font-semibold">@{child.username}</p>

        <div className="mt-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Current balance</p>
          <p className="text-4xl font-extrabold text-slate-800">{formatCurrency(balance)}</p>
        </div>

        <Button
          className="mt-6"
          variant="destructive"
          onClick={handleDeleteChild}
          disabled={deleting}
        >
          {deleting ? 'Deleting...' : 'Delete Child Account'}
        </Button>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="achievements">Achievements</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-4">
          <div className="finn-card">
            <h2 className="text-xl font-extrabold text-slate-800">Monthly Summary</h2>
            <p className="text-sm text-muted-foreground font-semibold mt-1">
              {now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </p>

            <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
              <p><span className="font-bold">Necessity:</span> {formatCurrency(summary.necessity)}</p>
              <p><span className="font-bold">Want:</span> {formatCurrency(summary.want)}</p>
              <p><span className="font-bold">Asset:</span> {formatCurrency(summary.asset)}</p>
              <p><span className="font-bold">Liability:</span> {formatCurrency(summary.liability)}</p>
              <p><span className="font-bold">Deposits:</span> {formatCurrency(summary.earned)}</p>
              <p><span className="font-bold">Net:</span> {formatCurrency(summary.net)}</p>
            </div>
          </div>

          <div className="finn-card">
            <h2 className="text-xl font-extrabold text-slate-800">Transaction History</h2>
            {transactions.length === 0 ? (
              <p className="text-sm text-muted-foreground font-semibold mt-3">No transactions yet.</p>
            ) : (
              <div className="space-y-3 mt-4">
                {transactions.map((txn) => {
                  const type = transactionType(txn);
                  return (
                    <div key={txn.id} className="rounded-2xl bg-slate-50 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-extrabold text-slate-800">
                          {type === 'deposit' ? 'Deposit' : 'Withdrawal'}
                        </p>
                        <p className={`font-extrabold ${type === 'deposit' ? 'text-emerald-600' : 'text-rose-500'}`}>
                          {type === 'deposit' ? '+' : '-'}{formatCurrency(txn.amount)}
                        </p>
                      </div>
                      <p className="text-sm text-muted-foreground font-semibold mt-1">
                        {txn.date} at {txn.time}
                      </p>
                      <p className="text-sm mt-2"><span className="font-bold">Reason:</span> {transactionReason(txn)}</p>
                      <p className="text-sm"><span className="font-bold">Category:</span> {CATEGORY_LABELS[String(txn.category)] || '—'}</p>
                      <p className="text-sm"><span className="font-bold">Location:</span> {txn.location || '—'}</p>
                      {txn.notes && (
                        <p className="text-sm"><span className="font-bold">Notes:</span> {txn.notes}</p>
                      )}
                      <div className="mt-3">
                        <Button
                          type="button"
                          variant="outline"
                          className="gap-2"
                          onClick={() => navigate(`/parent/transactions/${txn.id}/edit`)}
                        >
                          <Pencil className="w-4 h-4" />
                          Edit Entry
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="achievements" className="mt-4">
          <AchievementsPanel profile={child} earnedBadgeKeys={earnedBadgeKeys} editable={false} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
