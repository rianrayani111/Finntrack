import { currentBalance, transactionType, parseLocalDate } from '@/lib/finance';

export const GOAL_TYPE_LABELS = {
  earn: 'Earn money',
  save: 'Save money',
};

const toDayTs = (dateStr) => {
  const value = String(dateStr || '').trim();
  if (!value) return NaN;
  return parseLocalDate(value).getTime();
};

const isTransactionWithinTimeline = (transaction, startDate, endDate) => {
  const ts = toDayTs(transaction?.date);
  const startTs = toDayTs(startDate);
  const endTs = toDayTs(endDate);

  if (!Number.isFinite(ts) || !Number.isFinite(startTs) || !Number.isFinite(endTs)) {
    return false;
  }

  return ts >= startTs && ts <= endTs;
};

export const timelineLabel = (goal) => {
  const start = goal?.startDate ? parseLocalDate(goal.startDate).toLocaleDateString() : 'N/A';
  const end = goal?.endDate ? parseLocalDate(goal.endDate).toLocaleDateString() : 'N/A';
  return `${start} - ${end}`;
};

export const goalStatus = (goal, percentComplete) => {
  if (percentComplete >= 100) return 'completed';
  const endTs = toDayTs(goal?.endDate);
  if (Number.isFinite(endTs) && Date.now() > endTs + 24 * 60 * 60 * 1000) {
    return 'overdue';
  }
  return 'active';
};

export const calculateGoalProgress = (goal, transactions = []) => {
  const targetAmount = Number(goal?.targetAmount || 0);
  if (!(targetAmount > 0)) {
    return {
      currentAmount: 0,
      targetAmount: 0,
      remainingAmount: 0,
      percentComplete: 0,
      status: 'active',
    };
  }

  const goalType = String(goal?.goalType || 'save');

  let currentAmount = 0;
  if (goalType === 'earn') {
    currentAmount = transactions
      .filter((txn) => transactionType(txn) === 'deposit')
      .filter((txn) => isTransactionWithinTimeline(txn, goal?.startDate, goal?.endDate))
      .reduce((sum, txn) => sum + Number(txn.amount || 0), 0);
  } else {
    const baseline = Number(goal?.baselineBalance || 0);
    // Unlike 'earn' (already bounded to the timeline above), a 'save' goal's
    // progress used to be measured against ALL transactions ever, with no
    // upper bound. That let progress keep moving after the goal's own end
    // date -- a goal a child hit 100% on could later drop back below 100%
    // (and re-flip from "Completed" to "Overdue" via goalStatus below) simply
    // because they spent money weeks afterward, on something unrelated to
    // this goal.
    //
    // Match goalStatus's own definition of "the window is over": the day
    // AFTER endDate, not endDate itself (a goal stays active through the
    // whole of its last day). Before that point, behavior is unchanged --
    // real-time balance vs baseline. Once the window has closed, freeze the
    // tally at the balance as of endDate: later, unrelated activity can no
    // longer move a goal that has already run its course.
    const endTs = toDayTs(goal?.endDate);
    const dayAfterEndTs = Number.isFinite(endTs) ? endTs + 24 * 60 * 60 * 1000 : Infinity;
    const windowHasClosed = Date.now() >= dayAfterEndTs;
    const relevantTransactions = windowHasClosed
      ? transactions.filter((txn) => {
          const ts = toDayTs(txn?.date);
          return Number.isFinite(ts) && ts <= endTs;
        })
      : transactions;
    const balanceAsOfWindow = currentBalance(relevantTransactions);
    currentAmount = Math.max(balanceAsOfWindow - baseline, 0);
  }

  const safeCurrentAmount = Number.isFinite(currentAmount) ? currentAmount : 0;
  const percentComplete = Math.min((safeCurrentAmount / targetAmount) * 100, 100);
  const remainingAmount = Math.max(targetAmount - safeCurrentAmount, 0);
  const status = goalStatus(goal, percentComplete);

  return {
    currentAmount: safeCurrentAmount,
    targetAmount,
    remainingAmount,
    percentComplete,
    status,
  };
};
