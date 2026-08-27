import React, { useEffect, useMemo, useState } from 'react';
import { db } from '@/api/db';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { toast } from '@/components/ui/use-toast';
import { formatCurrency, currentBalance, todayLocalDateString } from '@/lib/finance';
import { calculateGoalProgress, GOAL_TYPE_LABELS, timelineLabel } from '@/lib/goals';
import { CalendarDays, Pencil, Target, Trash2, Trophy } from 'lucide-react';

// A function, not a module-level constant: evaluating todayLocalDateString()
// once at import time meant a tab left open overnight defaulted new goals to
// yesterday's date.
const makeEmptyForm = () => ({
  childId: '',
  title: '',
  goalType: 'save',
  targetAmount: '',
  startDate: todayLocalDateString(),
  endDate: '',
  reward: '',
});

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

export default function ParentGoals() {
  const [children, setChildren] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingGoalId, setDeletingGoalId] = useState(null);
  const [editingGoal, setEditingGoal] = useState(null);
  const [form, setForm] = useState(makeEmptyForm);

  useEffect(() => {
    Promise.all([
      db.users.listMyChildren(),
      db.entities.Transaction.list(),
      db.entities.Goal.list(),
    ])
      .then(([childDocs, txnDocs, goalDocs]) => {
        const nextChildren = childDocs || [];
        setChildren(nextChildren);
        setTransactions(txnDocs || []);
        setGoals(goalDocs || []);

        if (nextChildren.length > 0) {
          setForm((prev) => ({
            ...prev,
            childId: prev.childId || nextChildren[0].uid,
          }));
        }
      })
      .catch((error) => {
        setLoadError(error.message || 'Could not load your goals. Please refresh and try again.');
      })
      .finally(() => setLoading(false));
  }, []);

  const childMap = useMemo(() => {
    return new Map(children.map((child) => [child.uid, child]));
  }, [children]);

  const transactionsByChild = useMemo(() => {
    return transactions.reduce((acc, txn) => {
      if (!acc[txn.childId]) {
        acc[txn.childId] = [];
      }
      acc[txn.childId].push(txn);
      return acc;
    }, {});
  }, [transactions]);

  const goalCards = useMemo(() => {
    return goals.map((goal) => {
      const childTxns = transactionsByChild[goal.childId] || [];
      const progress = calculateGoalProgress(goal, childTxns);
      return {
        goal,
        progress,
        child: childMap.get(goal.childId) || null,
      };
    });
  }, [goals, transactionsByChild, childMap]);

  const resetForm = () => {
    setEditingGoal(null);
    setForm({
      ...makeEmptyForm(),
      childId: children[0]?.uid || '',
    });
  };

  const handleInputChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleEditGoal = (goal) => {
    setEditingGoal(goal);
    setForm({
      childId: goal.childId,
      title: goal.title,
      goalType: goal.goalType,
      targetAmount: String(goal.targetAmount),
      startDate: goal.startDate,
      endDate: goal.endDate,
      reward: goal.reward || '',
    });
  };

  const refreshGoals = async () => {
    const nextGoals = await db.entities.Goal.list();
    setGoals(nextGoals || []);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!form.childId) {
      toast({ title: 'Please choose a child.', variant: 'destructive' });
      return;
    }

    if (form.startDate && form.endDate && new Date(form.endDate) < new Date(form.startDate)) {
      toast({ title: 'End date must be on or after the start date.', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        childId: form.childId,
        title: form.title.trim(),
        goalType: form.goalType,
        targetAmount: Number(form.targetAmount),
        startDate: form.startDate,
        endDate: form.endDate,
        reward: form.reward.trim(),
      };

      if (!editingGoal) {
        if (payload.goalType === 'save') {
          payload.baselineBalance = currentBalance(transactionsByChild[payload.childId] || []);
        }
        await db.entities.Goal.create(payload);
        toast({ title: 'Goal created.' });
      } else {
        const childChanged = editingGoal.childId !== payload.childId;
        const switchedToSave = editingGoal.goalType !== 'save' && payload.goalType === 'save';
        // baselineBalance is meant to be "the balance at startDate" -- but it's
        // captured as "the balance right now" at the moment the goal is
        // written, on the assumption startDate is today. Moving startDate
        // without recapturing it left the baseline anchored to whenever the
        // goal was first created (or last edited), not to the new start date,
        // which skews every later progress calculation for that goal.
        const startDateChanged = editingGoal.startDate !== payload.startDate;
        if (payload.goalType === 'save' && (childChanged || switchedToSave || startDateChanged)) {
          payload.baselineBalance = currentBalance(transactionsByChild[payload.childId] || []);
        }

        await db.entities.Goal.update(editingGoal.id, payload);
        toast({ title: 'Goal updated.' });
      }

      await refreshGoals();
      resetForm();
    } catch (error) {
      toast({
        title: 'Could not save goal',
        description: error.message || 'Please check your entries and try again.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteGoal = async (goalId) => {
    const confirmDelete = window.confirm('Delete this goal?');
    if (!confirmDelete) return;

    setDeletingGoalId(goalId);
    try {
      await db.entities.Goal.delete(goalId);
      toast({ title: 'Goal deleted.' });
      await refreshGoals();
      if (editingGoal?.id === goalId) {
        resetForm();
      }
    } catch (error) {
      toast({
        title: 'Could not delete goal',
        description: error.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setDeletingGoalId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-4 border-sky-200 border-t-sky-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="finn-card text-center py-10">
        <p className="text-slate-700 font-bold">Could not load goals</p>
        <p className="text-sm text-muted-foreground font-semibold mt-1">{loadError}</p>
      </div>
    );
  }

  if (children.length === 0) {
    return (
      <div className="finn-card text-center py-10">
        <p className="text-slate-700 font-bold">No child accounts available.</p>
        <p className="text-sm text-muted-foreground font-semibold mt-1">
          Add a child first before creating goals.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="finn-card">
        <h1 className="text-2xl font-extrabold text-slate-800">
          {editingGoal ? 'Edit Goal' : 'Set a Goal'}
        </h1>
        <p className="text-sm text-muted-foreground font-semibold mt-1">
          Create multiple goals for each child with a timeline and optional reward.
        </p>

        <form className="space-y-4 mt-6" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label>Child</Label>
            <Select value={form.childId} onValueChange={(value) => handleInputChange('childId', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select child" />
              </SelectTrigger>
              <SelectContent>
                {children.map((child) => (
                  <SelectItem key={child.uid} value={child.uid}>
                    {child.displayName} (@{child.username})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="goal-title">Goal</Label>
            <Input
              id="goal-title"
              value={form.title}
              onChange={(event) => handleInputChange('title', event.target.value)}
              placeholder="Save for a new bike"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Goal Type</Label>
              <Select value={form.goalType} onValueChange={(value) => handleInputChange('goalType', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose goal type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="earn">Earn a certain amount</SelectItem>
                  <SelectItem value="save">Save a certain amount</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="target-amount">Target Amount</Label>
              <Input
                id="target-amount"
                type="number"
                min="0"
                step="0.01"
                value={form.targetAmount}
                onChange={(event) => handleInputChange('targetAmount', event.target.value)}
                placeholder="100"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="start-date">Start Date</Label>
              <Input
                id="start-date"
                type="date"
                value={form.startDate}
                onChange={(event) => handleInputChange('startDate', event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end-date">End Date</Label>
              <Input
                id="end-date"
                type="date"
                value={form.endDate}
                min={form.startDate || undefined}
                onChange={(event) => handleInputChange('endDate', event.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reward">Reward (optional)</Label>
            <Textarea
              id="reward"
              value={form.reward}
              onChange={(event) => handleInputChange('reward', event.target.value)}
              placeholder="Ice cream trip, movie night, or another reward"
              rows={3}
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <Button type="submit" className="sm:flex-1" disabled={saving}>
              {saving ? 'Saving...' : editingGoal ? 'Update Goal' : 'Create Goal'}
            </Button>
            {editingGoal && (
              <Button type="button" variant="outline" onClick={resetForm} className="sm:flex-1">
                Cancel Editing
              </Button>
            )}
          </div>
        </form>
      </div>

      <div className="space-y-3">
        <h2 className="text-xl font-extrabold text-slate-800">Current Goals</h2>
        {goalCards.length === 0 ? (
          <div className="finn-card text-sm text-muted-foreground font-semibold text-center py-10">
            No goals yet. Create your first goal above.
          </div>
        ) : (
          goalCards.map(({ goal, progress, child }) => (
            <div key={goal.id} className="finn-card space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-extrabold text-slate-800">{goal.title}</h3>
                    <span
                      className={`text-xs font-bold px-2.5 py-1 rounded-full ${statusStyles[progress.status] || statusStyles.active}`}
                    >
                      {statusLabels[progress.status] || statusLabels.active}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground font-semibold mt-1">
                    {child ? `${child.displayName} (@${child.username})` : 'Child not found'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    onClick={() => handleEditGoal(goal)}
                  >
                    <Pencil className="w-4 h-4" />
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="gap-1"
                    disabled={deletingGoalId === goal.id}
                    onClick={() => handleDeleteGoal(goal.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                    {deletingGoalId === goal.id ? 'Deleting...' : 'Delete'}
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                <div className="rounded-2xl bg-slate-50 p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">Type</p>
                  <p className="font-bold text-slate-800 mt-1 flex items-center gap-2">
                    <Target className="w-4 h-4 text-sky-600" />
                    {GOAL_TYPE_LABELS[goal.goalType] || 'Goal'}
                  </p>
                </div>
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
                <div className="flex items-center justify-between text-sm font-semibold text-slate-700">
                  <p>
                    Progress: {formatCurrency(progress.currentAmount)} of {formatCurrency(progress.targetAmount)}
                  </p>
                  <p>{Math.round(progress.percentComplete)}%</p>
                </div>
                <Progress value={progress.percentComplete} className="mt-2 h-3" />
                <p className="text-sm text-muted-foreground font-semibold mt-2">
                  Remaining: {formatCurrency(progress.remainingAmount)}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
