import { currentBalance, transactionType } from '@/lib/finance';

export const GOAL_TYPE_LABELS = {
  earn: 'Earn money',
  save: 'Save money',
};

const toDayTs = (dateStr) => {
  const value = String(dateStr || '').trim();
  if (!value) return NaN;
  return new Date(`${value}T00:00:00`).getTime();
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
  const start = goal?.startDate ? new Date(goal.startDate).toLocaleDateString() : 'N/A';
  const end = goal?.endDate ? new Date(goal.endDate).toLocaleDateString() : 'N/A';
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
    const balanceNow = currentBalance(transactions);
    currentAmount = Math.max(balanceNow - baseline, 0);
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
