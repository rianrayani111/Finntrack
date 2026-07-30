import React, { useEffect, useMemo, useState } from 'react';
import { db } from '@/api/base44Client';
import { Progress } from '@/components/ui/progress';
import { formatCurrency } from '@/lib/finance';
import { calculateGoalProgress, GOAL_TYPE_LABELS, timelineLabel } from '@/lib/goals';
import { CalendarDays, Target, Trophy } from 'lucide-react';

const statusStyles = {
  completed: 'bg-emerald-100 text-emerald-700',
  overdue: 'bg-rose-100 text-rose-700',
  active: 'bg-sky-100 text-sky-700',
};

const statusLabels = {
  completed: 'Completed',
  overdue: 'Overdue',
  active: 'Active',
};

export default function Goals() {
  const [goals, setGoals] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([db.entities.Goal.list(), db.entities.Transaction.list()])
      .then(([goalDocs, txnDocs]) => {
        setGoals(goalDocs || []);
        setTransactions(txnDocs || []);
      })
      .finally(() => setLoading(false));
  }, []);

  const goalsWithProgress = useMemo(() => {
    return goals.map((goal) => ({
      goal,
      progress: calculateGoalProgress(goal, transactions),
    }));
  }, [goals, transactions]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-4 border-sky-200 border-t-sky-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="finn-card">
        <h1 className="text-3xl font-extrabold text-slate-800">My Goals</h1>
        <p className="text-sm text-muted-foreground font-semibold mt-1">
          See what your parent set for you and track your progress.
        </p>
      </div>

      {goalsWithProgress.length === 0 ? (
        <div className="finn-card text-center py-10">
          <p className="text-slate-700 font-bold">No goals have been set yet.</p>
          <p className="text-sm text-muted-foreground font-semibold mt-1">
            Check back soon after your parent creates one.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {goalsWithProgress.map(({ goal, progress }) => (
            <div key={goal.id} className="finn-card space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-extrabold text-slate-800">{goal.title}</h2>
                    <span
                      className={`text-xs font-bold px-2.5 py-1 rounded-full ${statusStyles[progress.status] || statusStyles.active}`}
                    >
                      {statusLabels[progress.status] || statusLabels.active}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground font-semibold mt-1">
                    {GOAL_TYPE_LABELS[goal.goalType] || 'Goal'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div className="rounded-2xl bg-slate-50 p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">Timeline</p>
                  <p className="font-bold text-slate-800 mt-1 flex items-center gap-2">
                    <CalendarDays className="w-4 h-4 text-sky-600" />
                    {timelineLabel(goal)}
                  </p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">Reward</p>
                  <p className="font-bold text-slate-800 mt-1 flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-sky-600" />
                    {goal.reward || 'No reward set'}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <Target className="w-4 h-4 text-sky-600" />
                  {formatCurrency(progress.currentAmount)} of {formatCurrency(progress.targetAmount)}
                </p>
                <Progress value={progress.percentComplete} className="mt-2 h-3" />
                <div className="mt-2 flex items-center justify-between text-sm text-muted-foreground font-semibold">
                  <p>{Math.round(progress.percentComplete)}% complete</p>
                  <p>Remaining {formatCurrency(progress.remainingAmount)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
