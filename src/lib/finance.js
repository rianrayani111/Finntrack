// Shared financial calculation helpers for FinnTrack

export const CATEGORIES = ["necessity", "want", "asset", "liability"];
export const TRANSACTION_TYPES = ["withdrawal", "deposit"];

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export const CATEGORY_COLORS = {
  necessity: "#f97316",
  want: "#facc15",
  asset: "#0ea5e9",
  liability: "#ef4444",
};

export const CATEGORY_LABELS = {
  necessity: "Necessity",
  want: "Want",
  asset: "Asset",
  liability: "Liability",
  null: "Deposit",
};

const getType = (transaction) => {
  if (transaction.type) return transaction.type;
  if (transaction.transaction_type === 'earning') return 'deposit';
  if (transaction.transaction_type === 'spending') return 'withdrawal';
  return '';
};

const getReason = (transaction) => transaction.reason || transaction.description || '';

export function formatCurrency(value) {
  const num = Number(value || 0);
  const sign = num < 0 ? "-" : "";
  return `${sign}$${Math.abs(num).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function isSameMonth(dateStr, year, month) {
  const d = new Date(dateStr);
  return d.getFullYear() === year && d.getMonth() === month;
}

export function totalEarnings(transactions) {
  return transactions
    .filter((t) => getType(t) === "deposit")
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);
}

export function totalSpending(transactions) {
  return transactions
    .filter((t) => getType(t) === "withdrawal")
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);
}

export function currentBalance(transactions) {
  return totalEarnings(transactions) - totalSpending(transactions);
}

export function earningsForMonth(transactions, year, month) {
  return transactions
    .filter((t) => getType(t) === "deposit" && isSameMonth(t.date, year, month))
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);
}

export function spendingForMonth(transactions, year, month) {
  return transactions
    .filter((t) => getType(t) === "withdrawal" && isSameMonth(t.date, year, month))
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);
}

export function spendingByCategory(transactions, category) {
  return transactions
    .filter((t) => getType(t) === "withdrawal" && t.category === category)
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);
}

export function needsVsWantsData(transactions) {
  return [
    { name: "Necessity", value: spendingByCategory(transactions, "necessity"), color: CATEGORY_COLORS.necessity },
    { name: "Want", value: spendingByCategory(transactions, "want"), color: CATEGORY_COLORS.want },
  ].filter((d) => d.value > 0);
}

export function assetsVsLiabilitiesData(transactions) {
  return [
    { name: "Asset", value: spendingByCategory(transactions, "asset"), color: CATEGORY_COLORS.asset },
    { name: "Liability", value: spendingByCategory(transactions, "liability"), color: CATEGORY_COLORS.liability },
  ].filter((d) => d.value > 0);
}

export function buildMonthlySummary(transactions, year, month) {
  const monthTxns = transactions.filter((t) => isSameMonth(t.date, year, month));
  const earned = monthTxns
    .filter((t) => getType(t) === "deposit")
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);
  const catTotals = {};
  CATEGORIES.forEach((c) => {
    catTotals[c] = monthTxns
      .filter((t) => getType(t) === "withdrawal" && t.category === c)
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);
  });
  const totalSpending = Object.values(catTotals).reduce((a, b) => a + b, 0);
  const net = earned - totalSpending;
  return {
    month,
    name: MONTH_NAMES[month],
    ...catTotals,
    earned,
    net,
    hasData: monthTxns.length > 0,
  };
}

export function buildMonthToDateSummary(transactions, year, month) {
  const today = new Date();
  const monthTxns = transactions.filter((t) => {
    const txDate = new Date(t.date);
    const isSameMonthYear = txDate.getFullYear() === year && txDate.getMonth() === month;
    const isBeforeOrToday = txDate <= today;
    return isSameMonthYear && isBeforeOrToday;
  });

  const earned = monthTxns
    .filter((t) => getType(t) === "deposit")
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);
  const catTotals = {};
  CATEGORIES.forEach((c) => {
    catTotals[c] = monthTxns
      .filter((t) => getType(t) === "withdrawal" && t.category === c)
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);
  });
  const totalSpending = Object.values(catTotals).reduce((a, b) => a + b, 0);
  const net = earned - totalSpending;

  return {
    earned,
    spending: totalSpending,
    net,
    hasData: monthTxns.length > 0,
  };
}

export function buildAnnualSummary(transactions, year) {
  return MONTH_NAMES.map((name, month) => {
    const monthTxns = transactions.filter((t) => isSameMonth(t.date, year, month));
    const earned = monthTxns
      .filter((t) => getType(t) === "deposit")
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);
    const catTotals = {};
    CATEGORIES.forEach((c) => {
      catTotals[c] = monthTxns
        .filter((t) => getType(t) === "withdrawal" && t.category === c)
        .reduce((sum, t) => sum + Number(t.amount || 0), 0);
    });
    const totalSpending = Object.values(catTotals).reduce((a, b) => a + b, 0);
    const net = earned - totalSpending;
    return { month, name, ...catTotals, earned, net, hasData: monthTxns.length > 0 };
  });
}

export function sortByDateDesc(transactions) {
  return [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date));
}

export function transactionReason(transaction) {
  return getReason(transaction);
}

export function transactionType(transaction) {
  return getType(transaction);
}