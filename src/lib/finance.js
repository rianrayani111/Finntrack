// Shared financial calculation helpers for FinnTrack

export const CATEGORIES = ["needs", "wants", "assets", "liabilities", "other"];
export const TRANSACTION_TYPES = ["spending", "earning"];

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export const CATEGORY_COLORS = {
  needs: "#f97316",
  wants: "#facc15",
  assets: "#0ea5e9",
  liabilities: "#ef4444",
  other: "#a78bfa",
};

export const CATEGORY_LABELS = {
  needs: "Needs",
  wants: "Wants",
  assets: "Assets",
  liabilities: "Liabilities",
  other: "Other",
};

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
    .filter((t) => t.transaction_type === "earning")
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);
}

export function totalSpending(transactions) {
  return transactions
    .filter((t) => t.transaction_type === "spending")
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);
}

export function currentBalance(transactions) {
  return totalEarnings(transactions) - totalSpending(transactions);
}

export function earningsForMonth(transactions, year, month) {
  return transactions
    .filter((t) => t.transaction_type === "earning" && isSameMonth(t.date, year, month))
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);
}

export function spendingForMonth(transactions, year, month) {
  return transactions
    .filter((t) => t.transaction_type === "spending" && isSameMonth(t.date, year, month))
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);
}

export function spendingByCategory(transactions, category) {
  return transactions
    .filter((t) => t.transaction_type === "spending" && t.category === category)
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);
}

export function needsVsWantsData(transactions) {
  return [
    { name: "Needs", value: spendingByCategory(transactions, "needs"), color: CATEGORY_COLORS.needs },
    { name: "Wants", value: spendingByCategory(transactions, "wants"), color: CATEGORY_COLORS.wants },
  ].filter((d) => d.value > 0);
}

export function assetsVsLiabilitiesData(transactions) {
  return [
    { name: "Assets", value: spendingByCategory(transactions, "assets"), color: CATEGORY_COLORS.assets },
    { name: "Liabilities", value: spendingByCategory(transactions, "liabilities"), color: CATEGORY_COLORS.liabilities },
  ].filter((d) => d.value > 0);
}

export function buildMonthlySummary(transactions, year, month) {
  const monthTxns = transactions.filter((t) => isSameMonth(t.date, year, month));
  const earned = monthTxns
    .filter((t) => t.transaction_type === "earning")
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);
  const catTotals = {};
  CATEGORIES.forEach((c) => {
    catTotals[c] = monthTxns
      .filter((t) => t.transaction_type === "spending" && t.category === c)
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
    .filter((t) => t.transaction_type === "earning")
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);
  const catTotals = {};
  CATEGORIES.forEach((c) => {
    catTotals[c] = monthTxns
      .filter((t) => t.transaction_type === "spending" && t.category === c)
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
      .filter((t) => t.transaction_type === "earning")
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);
    const catTotals = {};
    CATEGORIES.forEach((c) => {
      catTotals[c] = monthTxns
        .filter((t) => t.transaction_type === "spending" && t.category === c)
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