// FinnTrack achievements: XP, levels, and the 84-badge catalogue.
//
// Badges reward noticing, consistency, honesty, and restraint — never
// spending. Every check() below is derived from data the child already
// produces (transactions, login streak, summary/history views, account
// age) rather than anything that rewards spending faster or more.
import {
  Sparkles, UserCheck, Grid3x3, BookOpenCheck, CalendarCheck, StickyNote, MapPin,
  MessageSquareText, HandCoins, Search, CalendarDays, Flame, ShoppingBag, Tag,
  Landmark, Scale, NotebookPen, History, Coins, ListChecks, Umbrella, Sunrise,
  Sunset, CircleDollarSign, Banknote, RotateCcw, Layers, CalendarClock, CheckCircle2,
  Timer, ShieldCheck, PiggyBank, BookOpenText, Hash, Repeat, Compass, ShieldHalf,
  Anchor, Rocket, PieChart, Route, Waves, Milestone, TrendingUp, Grid2x2Check,
  BadgeCheck, CalendarRange, Building2, ListTree, Trophy, Award, Medal,
  Crown, Gem, Star, Target, Wallet, BarChart3, LineChart, Package,
  ClipboardCheck, ClipboardList, BookOpen, BookMarked, Library, GraduationCap,
  Mountain, Footprints, Hourglass, Gauge, Puzzle,
} from 'lucide-react';

// ============================================================
// Levels
// ============================================================

export const RANKS = [
  { name: 'Bronze', from: 1, to: 5 },
  { name: 'Silver', from: 6, to: 10 },
  { name: 'Gold', from: 11, to: 15 },
  { name: 'Platinum', from: 16, to: 20 },
  { name: 'Diamond', from: 21, to: 25 },
  { name: 'Master', from: 26, to: 30 },
  { name: 'Legend', from: 31, to: 35 },
];

export const LEVELS = [
  { level: 1, title: 'Beginner', xpForLevel: 0, totalXp: 0 },
  { level: 2, title: 'Tracker', xpForLevel: 100, totalXp: 100 },
  { level: 3, title: 'Noticer', xpForLevel: 150, totalXp: 250 },
  { level: 4, title: 'Sorter', xpForLevel: 250, totalXp: 500 },
  { level: 5, title: 'Saver', xpForLevel: 350, totalXp: 850 },
  { level: 6, title: 'Planner', xpForLevel: 450, totalXp: 1300 },
  { level: 7, title: 'Bookkeeper', xpForLevel: 600, totalXp: 1900 },
  { level: 8, title: 'Accountant', xpForLevel: 750, totalXp: 2650 },
  { level: 9, title: 'Analyst', xpForLevel: 900, totalXp: 3550 },
  { level: 10, title: 'Budgeter', xpForLevel: 1050, totalXp: 4600 },
  { level: 11, title: 'Strategist', xpForLevel: 1200, totalXp: 5800 },
  { level: 12, title: 'Auditor', xpForLevel: 1400, totalXp: 7200 },
  { level: 13, title: 'Controller', xpForLevel: 1600, totalXp: 8800 },
  { level: 14, title: 'Treasurer', xpForLevel: 1800, totalXp: 10600 },
  { level: 15, title: 'Investor', xpForLevel: 2000, totalXp: 12600 },
  { level: 16, title: 'Economist', xpForLevel: 2250, totalXp: 14850 },
  { level: 17, title: 'Financier', xpForLevel: 2500, totalXp: 17350 },
  { level: 18, title: 'Money Master', xpForLevel: 2750, totalXp: 20100 },
  { level: 19, title: 'Grandmaster', xpForLevel: 3000, totalXp: 23100 },
  { level: 20, title: 'Sage', xpForLevel: 3400, totalXp: 26500 },
  { level: 21, title: 'Steward', xpForLevel: 3700, totalXp: 30200 },
  { level: 22, title: 'Custodian', xpForLevel: 4000, totalXp: 34200 },
  { level: 23, title: 'Chancellor', xpForLevel: 4300, totalXp: 38500 },
  { level: 24, title: 'Comptroller', xpForLevel: 4600, totalXp: 43100 },
  { level: 25, title: 'Actuary', xpForLevel: 5000, totalXp: 48100 },
  { level: 26, title: 'Underwriter', xpForLevel: 5400, totalXp: 53500 },
  { level: 27, title: 'Broker', xpForLevel: 5800, totalXp: 59300 },
  { level: 28, title: 'Banker', xpForLevel: 6200, totalXp: 65500 },
  { level: 29, title: 'Magnate', xpForLevel: 6600, totalXp: 72100 },
  { level: 30, title: 'Tycoon', xpForLevel: 7000, totalXp: 79100 },
  { level: 31, title: 'Visionary', xpForLevel: 7500, totalXp: 86600 },
  { level: 32, title: 'Luminary', xpForLevel: 8000, totalXp: 94600 },
  { level: 33, title: 'Titan', xpForLevel: 8500, totalXp: 103100 },
  { level: 34, title: 'Oracle', xpForLevel: 9000, totalXp: 112100 },
  { level: 35, title: 'FinnTrack Legend', xpForLevel: 10000, totalXp: 122100 },
];

export function rankForLevel(level) {
  return RANKS.find((r) => level >= r.from && level <= r.to)?.name || 'Bronze';
}

// Deliberately does not expose "levels remaining" — only the current level
// and the XP needed to reach the next one, per product spec.
export function getLevelInfo(xp) {
  const totalXp = Math.max(0, Number(xp) || 0);
  let current = LEVELS[0];
  for (const lvl of LEVELS) {
    if (totalXp >= lvl.totalXp) current = lvl;
    else break;
  }
  const isMax = current.level >= LEVELS.length;
  const next = isMax ? null : LEVELS[current.level];
  const xpIntoLevel = totalXp - current.totalXp;
  const xpForNext = next ? next.totalXp - current.totalXp : 0;
  const xpRemaining = next ? next.totalXp - totalXp : 0;
  const progressPct = isMax ? 100 : Math.min(100, Math.round((xpIntoLevel / xpForNext) * 100));

  return {
    level: current.level,
    title: current.title,
    rank: rankForLevel(current.level),
    totalXp,
    isMax,
    xpIntoLevel,
    xpForNext,
    xpRemaining,
    progressPct,
  };
}

// ============================================================
// Tiers
// ============================================================

export const TIERS = {
  starter: {
    key: 'starter', label: 'Starter', xp: 100,
    gradient: 'from-sky-300 to-sky-500', solid: 'bg-sky-500',
    chip: 'bg-sky-100 text-sky-700', ring: 'ring-sky-200',
  },
  common: {
    key: 'common', label: 'Common', xp: 200,
    gradient: 'from-emerald-300 to-emerald-500', solid: 'bg-emerald-500',
    chip: 'bg-emerald-100 text-emerald-700', ring: 'ring-emerald-200',
  },
  regular: {
    key: 'regular', label: 'Regular', xp: 350,
    gradient: 'from-indigo-300 to-indigo-500', solid: 'bg-indigo-500',
    chip: 'bg-indigo-100 text-indigo-700', ring: 'ring-indigo-200',
  },
  uncommon: {
    key: 'uncommon', label: 'Uncommon', xp: 600,
    gradient: 'from-violet-400 to-fuchsia-500', solid: 'bg-fuchsia-500',
    chip: 'bg-fuchsia-100 text-fuchsia-700', ring: 'ring-fuchsia-200',
  },
  rare: {
    key: 'rare', label: 'Rare', xp: 1000,
    gradient: 'from-amber-400 to-orange-500', solid: 'bg-amber-500',
    chip: 'bg-amber-100 text-amber-700', ring: 'ring-amber-200',
  },
  epic: {
    key: 'epic', label: 'Epic', xp: 1500,
    gradient: 'from-rose-400 to-pink-600', solid: 'bg-rose-500',
    chip: 'bg-rose-100 text-rose-700', ring: 'ring-rose-200',
  },
  legendary: {
    key: 'legendary', label: 'Legendary', xp: 2000,
    gradient: 'from-yellow-300 via-amber-400 to-orange-500', solid: 'bg-amber-500',
    chip: 'bg-gradient-to-r from-yellow-100 to-amber-100 text-amber-800', ring: 'ring-amber-300',
  },
};

// ============================================================
// Context: aggregate a child's transactions + profile once, so every
// badge check() below can stay a short, readable predicate.
// ============================================================

const CATEGORY_LIST = ['necessity', 'want', 'asset', 'liability'];

const toDateOnly = (str) => new Date(`${String(str).slice(0, 10)}T00:00:00`);

// Postgres `time` columns come back from PostgREST as "HH:MM:SS", while the
// entry forms submit "HH:MM". Normalize both to a full local datetime --
// blindly appending ":00" turned a stored "20:15:00" into the unparseable
// "…T20:15:00:00", which made every comparison against it silently false.
const toLocalDateTime = (dateStr, timeStr) => {
  const parts = String(timeStr || '').trim().split(':');
  if (parts.length < 2) return null;
  const [hh, mm, ss = '00'] = parts;
  const pad = (n) => String(n).padStart(2, '0');
  const parsed = new Date(`${String(dateStr).slice(0, 10)}T${pad(hh)}:${pad(mm)}:${pad(ss)}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};
const dayDiff = (a, b) => Math.round((toDateOnly(b) - toDateOnly(a)) / 86400000);
// Local-time YYYY-MM-DD (never Date#toISOString, which converts to UTC and
// can shift the calendar day depending on the reader's timezone offset).
const formatDateOnly = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function mondayOf(dateStr) {
  const d = toDateOnly(dateStr);
  const dayNr = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - dayNr);
  return formatDateOnly(d);
}

function longestConsecutiveRun(sortedUniqueDates, stepDays = 1) {
  if (sortedUniqueDates.length === 0) return 0;
  let longest = 1;
  let current = 1;
  for (let i = 1; i < sortedUniqueDates.length; i++) {
    const diff = dayDiff(sortedUniqueDates[i - 1], sortedUniqueDates[i]);
    current = diff === stepDays ? current + 1 : 1;
    longest = Math.max(longest, current);
  }
  return longest;
}

function maxGap(sortedUniqueDates) {
  let max = 0;
  for (let i = 1; i < sortedUniqueDates.length; i++) {
    max = Math.max(max, dayDiff(sortedUniqueDates[i - 1], sortedUniqueDates[i]));
  }
  return max;
}

function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

export function buildAchievementContext({ transactions = [], profile = {} } = {}) {
  const withdrawals = transactions.filter((t) => t.type === 'withdrawal');
  const deposits = transactions.filter((t) => t.type === 'deposit');
  const entries = withdrawals; // every entry a child logs is a withdrawal

  const entryCount = entries.length;
  const byCategory = {};
  CATEGORY_LIST.forEach((c) => {
    byCategory[c] = entries.filter((e) => e.category === c);
  });

  const totalTracked = entries.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const notesEntries = entries.filter((e) => String(e.notes || '').trim().length > 0);

  const sortedDates = [...new Set(entries.map((e) => e.date))].sort();
  const dateSet = new Set(sortedDates);
  const longestStreak = longestConsecutiveRun(sortedDates, 1);
  const gapDays = maxGap(sortedDates);

  const weekStartSet = new Set(entries.map((e) => mondayOf(e.date)));
  const sortedWeekStarts = [...weekStartSet].sort();
  const longestWeeklyStreak = longestConsecutiveRun(sortedWeekStarts, 7);

  const entriesByWeek = new Map();
  entries.forEach((e) => {
    const wk = mondayOf(e.date);
    if (!entriesByWeek.has(wk)) entriesByWeek.set(wk, []);
    entriesByWeek.get(wk).push(e);
  });
  const anyWeekAllFourCategories = [...entriesByWeek.values()].some(
    (weekEntries) => new Set(weekEntries.map((e) => e.category)).size === 4
  );

  let sameDayCount = 0;
  let quickLogCount = 0;
  let morningCount = 0;
  let eveningCount = 0;
  entries.forEach((e) => {
    if (e.createdAt) {
      const createdDate = new Date(e.createdAt);
      if (formatDateOnly(createdDate) === e.date) sameDayCount += 1;

      const loggedAt = toLocalDateTime(e.date, e.time);
      if (loggedAt && Math.abs(createdDate - loggedAt) <= 60 * 60 * 1000) quickLogCount += 1;
    }
    const timeStr = String(e.time || '').trim();
    // Number('') is 0, not NaN, so an entry with no time at all would
    // otherwise be silently counted as hour 0 (i.e. "morning").
    if (timeStr) {
      const hour = Number(timeStr.split(':')[0]);
      if (Number.isFinite(hour)) {
        if (hour < 12) morningCount += 1;
        if (hour >= 18) eveningCount += 1;
      }
    }
  });

  const smallSpendCount = entries.filter((e) => Number(e.amount) < 1).length;
  const wholeDollarCount = entries.filter((e) => Number(e.amount) % 1 === 0).length;
  const hasWeekendPair = sortedDates.some((d) => toDateOnly(d).getDay() === 6)
    && sortedDates.some((d) => toDateOnly(d).getDay() === 0);
  const categoriesUsed = new Set(entries.map((e) => e.category));

  // Weeks (Monday starts) with zero entries, strictly between the child's
  // first-ever logged week and the current (still-open) week.
  let hasEmptyWeek = false;
  if (sortedWeekStarts.length > 1) {
    const cursor = toDateOnly(sortedWeekStarts[0]);
    cursor.setDate(cursor.getDate() + 7); // start checking the week AFTER the first logged week
    const currentWeekStart = toDateOnly(mondayOf(formatDateOnly(new Date())));
    while (cursor < currentWeekStart) {
      const key = formatDateOnly(cursor);
      if (!weekStartSet.has(key)) {
        hasEmptyWeek = true;
        break;
      }
      cursor.setDate(cursor.getDate() + 7);
    }
  }

  // Completed calendar months with at least one entry.
  const now = new Date();
  const monthMap = new Map();
  entries.forEach((e) => {
    const d = toDateOnly(e.date);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    if (!monthMap.has(key)) {
      monthMap.set(key, {
        key, year: d.getFullYear(), month: d.getMonth(),
        necessity: 0, want: 0, asset: 0, liability: 0, earned: 0,
        entryCount: 0, days: new Set(), wantCount: 0,
      });
    }
    const m = monthMap.get(key);
    m.entryCount += 1;
    m.days.add(e.date);
    if (CATEGORY_LIST.includes(e.category)) m[e.category] += Number(e.amount || 0);
    if (e.category === 'want') m.wantCount += 1;
  });
  deposits.forEach((d0) => {
    const d = toDateOnly(d0.date);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    if (!monthMap.has(key)) {
      monthMap.set(key, {
        key, year: d.getFullYear(), month: d.getMonth(),
        necessity: 0, want: 0, asset: 0, liability: 0, earned: 0,
        entryCount: 0, days: new Set(), wantCount: 0,
      });
    }
    monthMap.get(key).earned += Number(d0.amount || 0);
  });

  const completedMonths = [...monthMap.values()]
    .filter((m) => m.year < now.getFullYear() || (m.year === now.getFullYear() && m.month < now.getMonth()))
    .map((m) => ({
      ...m,
      spent: m.necessity + m.want + m.asset + m.liability,
      net: m.earned - (m.necessity + m.want + m.asset + m.liability),
      distinctDays: m.days.size,
      daysInMonth: daysInMonth(m.year, m.month),
      mondaysLogged: [...m.days].filter((d) => toDateOnly(d).getDay() === 1).length,
      mondaysInMonth: Array.from({ length: daysInMonth(m.year, m.month) })
        .filter((_, i) => new Date(m.year, m.month, i + 1).getDay() === 1).length,
    }))
    .sort((a, b) => (a.year - b.year) || (a.month - b.month));

  const longestConsecutivePositiveMonths = (() => {
    let longest = 0, current = 0;
    completedMonths.forEach((m) => {
      if (m.net > 0) { current += 1; longest = Math.max(longest, current); }
      else current = 0;
    });
    return longest;
  })();

  const longestConsecutiveHalfSavedMonths = (() => {
    let longest = 0, current = 0;
    completedMonths.forEach((m) => {
      if (m.earned > 0 && m.net >= m.earned / 2) { current += 1; longest = Math.max(longest, current); }
      else current = 0;
    });
    return longest;
  })();

  const monthsFullyAccounted = completedMonths.filter((m) => m.distinctDays >= m.daysInMonth).length;
  const monthsNeedsFirst = completedMonths.filter((m) => m.necessity > m.want).length;
  const monthsFullDetail = completedMonths.filter(
    (m) => m.entryCount > 0 && entries.filter((e) => toDateOnly(e.date).getFullYear() === m.year
      && toDateOnly(e.date).getMonth() === m.month).every((e) => String(e.notes || '').trim())
  ).length;
  const monthsEveryMonday = completedMonths.filter((m) => m.mondaysInMonth > 0 && m.mondaysLogged >= m.mondaysInMonth).length;
  let quietMonthFound = false;
  for (let i = 1; i < completedMonths.length; i++) {
    if (completedMonths[i].wantCount < completedMonths[i - 1].wantCount) { quietMonthFound = true; break; }
  }

  const distinctActiveMonths = new Set(entries.map((e) => e.date.slice(0, 7))).size;

  const createdAt = profile.createdAt ? new Date(profile.createdAt) : null;
  const accountAgeDays = createdAt ? Math.floor((now - createdAt) / 86400000) : 0;

  return {
    profile,
    entries,
    deposits,
    entryCount,
    byCategory,
    categoryCounts: Object.fromEntries(CATEGORY_LIST.map((c) => [c, byCategory[c].length])),
    totalTracked,
    notesCount: notesEntries.length,
    distinctDatesLogged: sortedDates.length,
    longestStreak,
    gapDays,
    longestWeeklyStreak,
    anyWeekAllFourCategories,
    sameDayCount,
    quickLogCount,
    morningCount,
    eveningCount,
    smallSpendCount,
    wholeDollarCount,
    hasWeekendPair,
    categoriesUsedCount: categoriesUsed.size,
    hasEmptyWeek,
    completedMonths,
    longestConsecutivePositiveMonths,
    longestConsecutiveHalfSavedMonths,
    monthsFullyAccounted,
    monthsNeedsFirst,
    monthsFullDetail,
    monthsEveryMonday,
    quietMonthFound,
    distinctActiveMonths,
    accountAgeDays,
    summaryViewsCount: Number(profile.summaryViewsCount) || 0,
    historyViewsCount: Number(profile.historyViewsCount) || 0,
    streakCount: Number(profile.streakCount) || 0,
    // "Patient": at least one pair of 'want' entries spaced 7+ days apart.
    hasPatientWant: (() => {
      const wantDates = [...new Set(byCategory.want.map((e) => e.date))].sort();
      for (let i = 1; i < wantDates.length; i++) {
        if (dayDiff(wantDates[i - 1], wantDates[i]) >= 7) return true;
      }
      return false;
    })(),
    // "Honest Ledger": a small, easy-to-skip amount logged with real detail.
    hasHonestEntry: entries.some((e) => Number(e.amount) < 2 && String(e.notes || '').trim()),
  };
}

// ============================================================
// Badge catalogue
// ============================================================

// key format: "{tier}__{slug}" — the tier prefix is how the server-side
// sync_badges() RPC derives (and authorizes) the XP award, so it must match
// one of the TIERS keys above exactly.
export const BADGES = [
  // STARTER — 100 XP
  { key: 'starter__first_entry', tier: 'starter', title: 'First Entry', description: 'Logging your very first entry', icon: Sparkles, check: (c) => c.entryCount >= 1 },
  { key: 'starter__ledger_opened', tier: 'starter', title: 'Ledger Opened', description: 'Completing your profile setup', icon: BookOpenCheck, check: (c) => c.streakCount >= 1 },
  { key: 'starter__four_corners', tier: 'starter', title: 'Four Corners', description: 'Using all four categories at least once', icon: Grid3x3, check: (c) => c.categoriesUsedCount >= 4 },
  { key: 'starter__summary_reader', tier: 'starter', title: 'Summary Reader', description: 'Opening your monthly summary for the first time', icon: CalendarRange, check: (c) => c.summaryViewsCount >= 1 },
  { key: 'starter__same_day', tier: 'starter', title: 'Same Day', description: 'Logging something the day it happened', icon: CalendarCheck, check: (c) => c.sameDayCount >= 1 },
  { key: 'starter__note_taker', tier: 'starter', title: 'Note Taker', description: 'Adding a note to an entry', icon: StickyNote, check: (c) => c.notesCount >= 1 },
  { key: 'starter__where_i_was', tier: 'starter', title: 'Where I Was', description: 'Filling in a location on an entry', icon: MapPin, check: (c) => c.entries.some((e) => String(e.location || '').trim()) },
  { key: 'starter__reason_given', tier: 'starter', title: 'Reason Given', description: 'Filling in a reason on an entry', icon: MessageSquareText, check: (c) => c.entries.some((e) => String(e.reason || '').trim()) },
  { key: 'starter__first_deposit_seen', tier: 'starter', title: 'First Deposit Seen', description: 'Receiving your first money from a parent', icon: HandCoins, check: (c) => c.deposits.length >= 1 },
  { key: 'starter__curious', tier: 'starter', title: 'Curious', description: 'Opening your history page', icon: Search, check: (c) => c.historyViewsCount >= 1 },
  { key: 'starter__two_days', tier: 'starter', title: 'Two Days', description: 'Logging on two different days', icon: CalendarDays, check: (c) => c.distinctDatesLogged >= 2 },
  { key: 'starter__named_it', tier: 'starter', title: 'Named It', description: 'Choosing your display name', icon: UserCheck, check: (c) => Boolean(String(c.profile.displayName || '').trim()) },

  // COMMON — 200 XP
  { key: 'common__three_in_a_row', tier: 'common', title: 'Three in a Row', description: 'Logging three days running', icon: Flame, check: (c) => c.longestStreak >= 3 },
  { key: 'common__necessity_knower', tier: 'common', title: 'Necessity Knower', description: 'Categorising 5 entries as necessity', icon: ShoppingBag, check: (c) => c.categoryCounts.necessity >= 5 },
  { key: 'common__want_spotter', tier: 'common', title: 'Want Spotter', description: 'Categorising 5 entries as want', icon: Tag, check: (c) => c.categoryCounts.want >= 5 },
  { key: 'common__asset_builder', tier: 'common', title: 'Asset Builder', description: 'Categorising 5 entries as asset', icon: Landmark, check: (c) => c.categoryCounts.asset >= 5 },
  { key: 'common__liability_learner', tier: 'common', title: 'Liability Learner', description: 'Categorising 5 entries as liability', icon: Scale, check: (c) => c.categoryCounts.liability >= 5 },
  { key: 'common__detailed', tier: 'common', title: 'Detailed', description: 'Adding notes to 10 entries', icon: NotebookPen, check: (c) => c.notesCount >= 10 },
  { key: 'common__looked_back', tier: 'common', title: 'Looked Back', description: 'Viewing your history 10 times', icon: History, check: (c) => c.historyViewsCount >= 10 },
  { key: 'common__first_ten_tracked', tier: 'common', title: 'First Ten Tracked', description: 'Tracking $10 in total spending', icon: Coins, check: (c) => c.totalTracked >= 10 },
  { key: 'common__ten_entries', tier: 'common', title: 'Ten Entries', description: 'Logging 10 entries', icon: ListChecks, check: (c) => c.entryCount >= 10 },
  { key: 'common__weekend_logger', tier: 'common', title: 'Weekend Logger', description: 'Logging on a Saturday and a Sunday', icon: Umbrella, check: (c) => c.hasWeekendPair },
  { key: 'common__morning_person', tier: 'common', title: 'Morning Person', description: 'Logging before noon, 5 times', icon: Sunrise, check: (c) => c.morningCount >= 5 },
  { key: 'common__evening_review', tier: 'common', title: 'Evening Review', description: 'Logging after 6pm, 5 times', icon: Sunset, check: (c) => c.eveningCount >= 5 },
  { key: 'common__small_spender', tier: 'common', title: 'Small Spender', description: 'Logging 5 entries under $1', icon: CircleDollarSign, check: (c) => c.smallSpendCount >= 5 },
  { key: 'common__rounded_up', tier: 'common', title: 'Rounded Up', description: 'Logging an entry with an exact whole-dollar amount', icon: Banknote, check: (c) => c.wholeDollarCount >= 1 },
  { key: 'common__back_again', tier: 'common', title: 'Back Again', description: 'Logging on 5 separate days', icon: RotateCcw, check: (c) => c.distinctDatesLogged >= 5 },
  { key: 'common__categories_complete', tier: 'common', title: 'Categories Complete', description: 'Using all four categories in a single week', icon: Layers, check: (c) => c.anyWeekAllFourCategories },

  // REGULAR — 350 XP
  { key: 'regular__week_watcher', tier: 'regular', title: 'Week Watcher', description: 'Logging every day for a week', icon: CalendarClock, check: (c) => c.longestStreak >= 7 },
  { key: 'regular__full_month', tier: 'regular', title: 'Full Month', description: 'Completing your first full month', icon: CalendarRange, check: (c) => c.accountAgeDays >= 30 },
  { key: 'regular__sorted', tier: 'regular', title: 'Sorted', description: 'Categorising 25 entries', icon: ClipboardList, check: (c) => c.entryCount >= 25 },
  { key: 'regular__quick_logger', tier: 'regular', title: 'Quick Logger', description: 'Logging within an hour of spending, 10 times', icon: Timer, check: (c) => c.quickLogCount >= 10 },
  { key: 'regular__nothing_spent', tier: 'regular', title: 'Nothing Spent', description: 'A full week with no withdrawals', icon: ShieldCheck, check: (c) => c.hasEmptyWeek },
  { key: 'regular__kept_it', tier: 'regular', title: 'Kept It', description: 'Ending a month with money left over', icon: PiggyBank, check: (c) => c.completedMonths.some((m) => m.net > 0) },
  { key: 'regular__balanced_books', tier: 'regular', title: 'Balanced Books', description: 'Logging every day for 7 days straight', icon: CheckCircle2, check: (c) => c.longestStreak >= 7 },
  { key: 'regular__fifty_tracked', tier: 'regular', title: 'Fifty Tracked', description: 'Tracking $50 in total spending', icon: Coins, check: (c) => c.totalTracked >= 50 },
  { key: 'regular__balance_sheet_basics', tier: 'regular', title: 'Balance Sheet Basics', description: 'Learning what all four categories mean', icon: BookOpenText, check: (c) => c.categoriesUsedCount >= 4 },
  { key: 'regular__twenty_five', tier: 'regular', title: 'Twenty Five', description: 'Logging 25 entries', icon: Hash, check: (c) => c.entryCount >= 25 },
  { key: 'regular__two_weeks_running', tier: 'regular', title: 'Two Weeks Running', description: 'A 14-day logging streak', icon: Repeat, check: (c) => c.longestStreak >= 14 },
  { key: 'regular__location_logger', tier: 'regular', title: 'Location Logger', description: 'Filling in location on 15 entries', icon: Compass, check: (c) => c.entries.filter((e) => String(e.location || '').trim()).length >= 15 },
  { key: 'regular__honest_ledger', tier: 'regular', title: 'Honest Ledger', description: 'Logging an entry you could have skipped', icon: ShieldHalf, check: (c) => c.hasHonestEntry },
  { key: 'regular__month_complete', tier: 'regular', title: 'Month Complete', description: 'Every day of a calendar month accounted for', icon: CalendarCheck, check: (c) => c.monthsFullyAccounted >= 1 },
  { key: 'regular__needs_first', tier: 'regular', title: 'Needs First', description: 'A month where necessity spending exceeded wants', icon: ShoppingBag, check: (c) => c.monthsNeedsFirst >= 1 },
  { key: 'regular__savers_start', tier: 'regular', title: "Saver's Start", description: 'Ending two months in a row with money left', icon: PiggyBank, check: (c) => c.longestConsecutivePositiveMonths >= 2 },

  // UNCOMMON — 600 XP
  { key: 'uncommon__fortnight', tier: 'uncommon', title: 'Fortnight', description: 'A 14-day streak', icon: Anchor, check: (c) => c.longestStreak >= 14 },
  { key: 'uncommon__comeback', tier: 'uncommon', title: 'Comeback', description: 'Returning and logging after a break of 7+ days', icon: Rocket, check: (c) => c.gapDays >= 8 },
  { key: 'uncommon__patient', tier: 'uncommon', title: 'Patient', description: 'Waiting a week before making a want purchase', icon: Hourglass, check: (c) => c.hasPatientWant },
  { key: 'uncommon__precise', tier: 'uncommon', title: 'Precise', description: 'Logging location and reason together, 25 times', icon: Target, check: (c) => c.entries.filter((e) => String(e.location || '').trim() && String(e.reason || '').trim()).length >= 25 },
  { key: 'uncommon__pattern_finder', tier: 'uncommon', title: 'Pattern Finder', description: 'Viewing three monthly summaries', icon: PieChart, check: (c) => c.summaryViewsCount >= 3 },
  { key: 'uncommon__half_kept', tier: 'uncommon', title: 'Half Kept', description: 'Saving half of what came in during a month', icon: Gem, check: (c) => c.longestConsecutiveHalfSavedMonths >= 1 },
  { key: 'uncommon__hundred_tracked', tier: 'uncommon', title: 'Hundred Tracked', description: 'Tracking $100 in total spending', icon: Coins, check: (c) => c.totalTracked >= 100 },
  { key: 'uncommon__knows_the_difference', tier: 'uncommon', title: 'Knows the Difference', description: 'Correctly sorting needs vs wants, 20 times', icon: Grid2x2Check, check: (c) => c.categoryCounts.necessity + c.categoryCounts.want >= 20 },
  { key: 'uncommon__fifty_entries', tier: 'uncommon', title: 'Fifty Entries', description: 'Logging 50 entries', icon: ListChecks, check: (c) => c.entryCount >= 50 },
  { key: 'uncommon__three_months', tier: 'uncommon', title: 'Three Months', description: 'Using FinnTrack for three months', icon: Milestone, check: (c) => c.accountAgeDays >= 90 },
  { key: 'uncommon__steady_hand', tier: 'uncommon', title: 'Steady Hand', description: 'Logging at least once a week for 8 weeks', icon: Route, check: (c) => c.longestWeeklyStreak >= 8 },
  { key: 'uncommon__asset_minded', tier: 'uncommon', title: 'Asset Minded', description: '10 entries categorised as asset', icon: Building2, check: (c) => c.categoryCounts.asset >= 10 },
  { key: 'uncommon__debt_aware', tier: 'uncommon', title: 'Debt Aware', description: '10 entries categorised as liability', icon: ListTree, check: (c) => c.categoryCounts.liability >= 10 },
  { key: 'uncommon__quiet_month', tier: 'uncommon', title: 'Quiet Month', description: 'A month with fewer wants than the month before', icon: Waves, check: (c) => c.quietMonthFound },

  // RARE — 1000 XP
  { key: 'rare__month_of_mondays', tier: 'rare', title: 'Month of Mondays', description: 'Logging every Monday for a month', icon: BadgeCheck, check: (c) => c.monthsEveryMonday >= 1 },
  { key: 'rare__never_missed', tier: 'rare', title: 'Never Missed', description: 'A 30-day streak', icon: TrendingUp, check: (c) => c.longestStreak >= 30 },
  { key: 'rare__master_sorter', tier: 'rare', title: 'Master Sorter', description: 'Categorising 100 entries', icon: ClipboardCheck, check: (c) => c.entryCount >= 100 },
  { key: 'rare__growing', tier: 'rare', title: 'Growing', description: 'Three months in a row ending positive', icon: TrendingUp, check: (c) => c.longestConsecutivePositiveMonths >= 3 },
  { key: 'rare__five_hundred_tracked', tier: 'rare', title: 'Five Hundred Tracked', description: 'Tracking $500 in total spending', icon: Wallet, check: (c) => c.totalTracked >= 500 },
  { key: 'rare__hundred_entries', tier: 'rare', title: 'Hundred Entries', description: 'Logging 100 entries', icon: BarChart3, check: (c) => c.entryCount >= 100 },
  { key: 'rare__six_months', tier: 'rare', title: 'Six Months', description: 'Using FinnTrack for six months', icon: Milestone, check: (c) => c.accountAgeDays >= 180 },
  { key: 'rare__full_picture', tier: 'rare', title: 'Full Picture', description: 'Every entry for a month fully detailed', icon: BookMarked, check: (c) => c.monthsFullDetail >= 1 },
  { key: 'rare__saver', tier: 'rare', title: 'Saver', description: 'Saving half your income for three months running', icon: PiggyBank, check: (c) => c.longestConsecutiveHalfSavedMonths >= 3 },
  { key: 'rare__two_month_streak', tier: 'rare', title: 'Two Month Streak', description: 'A 60-day streak', icon: LineChart, check: (c) => c.longestStreak >= 60 },
  { key: 'rare__category_master', tier: 'rare', title: 'Category Master', description: '25 entries in each of the four categories', icon: Grid3x3, check: (c) => CATEGORY_LIST.every((cat) => c.categoryCounts[cat] >= 25) },
  { key: 'rare__reflective', tier: 'rare', title: 'Reflective', description: 'Viewing six monthly summaries', icon: PieChart, check: (c) => c.summaryViewsCount >= 6 },

  // EPIC — 1500 XP
  { key: 'epic__century', tier: 'epic', title: 'Century', description: 'Logging 100 entries with full detail', icon: Trophy, check: (c) => c.notesCount >= 100 },
  { key: 'epic__year_in_review', tier: 'epic', title: 'Year in Review', description: 'Twelve months of history', icon: Library, check: (c) => c.accountAgeDays >= 365 && c.distinctActiveMonths >= 12 },
  { key: 'epic__graduate', tier: 'epic', title: 'Graduate', description: 'Using FinnTrack for a full year', icon: GraduationCap, check: (c) => c.accountAgeDays >= 365 },
  { key: 'epic__hundred_days', tier: 'epic', title: 'Hundred Days', description: 'A 100-day streak', icon: Mountain, check: (c) => c.longestStreak >= 100 },
  { key: 'epic__thousand_tracked', tier: 'epic', title: 'Thousand Tracked', description: 'Tracking $1,000 in total spending', icon: Package, check: (c) => c.totalTracked >= 1000 },
  { key: 'epic__consistent', tier: 'epic', title: 'Consistent', description: 'Logging at least once a week for six months', icon: Footprints, check: (c) => c.longestWeeklyStreak >= 26 },
  { key: 'epic__half_year_saver', tier: 'epic', title: 'Half Year Saver', description: 'Six months in a row ending positive', icon: Gem, check: (c) => c.longestConsecutivePositiveMonths >= 6 },
  { key: 'epic__complete_ledger', tier: 'epic', title: 'Complete Ledger', description: '250 entries logged', icon: BookOpen, check: (c) => c.entryCount >= 250 },
  { key: 'epic__the_long_view', tier: 'epic', title: 'The Long View', description: 'Viewing twelve monthly summaries', icon: Gauge, check: (c) => c.summaryViewsCount >= 12 },
  {
    key: 'epic__money_mind', tier: 'epic', title: 'Money Mind', description: 'Earning every badge in the Uncommon tier', icon: Puzzle,
    check: (c, earnedKeys) => BADGES_BY_TIER.uncommon.every((b) => earnedKeys.has(b.key)),
  },

  // LEGENDARY — 2000 XP
  { key: 'legendary__perfect_year', tier: 'legendary', title: 'Perfect Year', description: 'A full year with no missed weeks', icon: Crown, check: (c) => c.longestWeeklyStreak >= 52 },
  {
    key: 'legendary__collector', tier: 'legendary', title: 'Collector', description: 'Earning 50 badges', icon: Medal,
    check: (c, earnedKeys) => earnedKeys.size >= 50,
  },
  {
    key: 'legendary__grandmaster', tier: 'legendary', title: 'Grandmaster', description: 'Earning every Rare badge', icon: Award,
    check: (c, earnedKeys) => BADGES_BY_TIER.rare.every((b) => earnedKeys.has(b.key)),
  },
  {
    key: 'legendary__finntrack_legend', tier: 'legendary', title: 'FinnTrack Legend', description: 'Reaching Level 35', icon: Star,
    check: (c) => c.projectedLevel >= 35,
  },
];

// Grouped by tier once, in catalogue order — used both for rendering and by
// the meta-badges above (Money Mind, Grandmaster) that check "every badge in
// tier X".
export const BADGES_BY_TIER = BADGES.reduce((acc, badge) => {
  (acc[badge.tier] ||= []).push(badge);
  return acc;
}, {});

export const TIER_ORDER = ['starter', 'common', 'regular', 'uncommon', 'rare', 'epic', 'legendary'];

export function totalBadgeXp() {
  return BADGES.reduce((sum, b) => sum + TIERS[b.tier].xp, 0);
}

// Evaluates every badge against the given context and the set of already-
// persisted badge keys, returning the full set of keys that SHOULD be
// earned (a superset of alreadyEarnedKeys — earning is monotonic, since we
// always scan complete history). Legendary/meta badges are evaluated in a
// second pass against the projected XP/badge set from pass one, so e.g.
// "FinnTrack Legend" can fire in the same sync as the badges that push a
// child over Level 35.
export function evaluateBadges(ctx, alreadyEarnedKeys = new Set()) {
  const earned = new Set(alreadyEarnedKeys);

  BADGES.forEach((b) => {
    if (b.tier === 'legendary') return;
    if (earned.has(b.key)) return;
    if (b.check(ctx, earned)) earned.add(b.key);
  });

  const projectedXp = ctx.profile.xp
    + [...earned].filter((k) => !alreadyEarnedKeys.has(k))
      .reduce((sum, k) => sum + TIERS[k.split('__')[0]].xp, 0);
  const projectedCtx = { ...ctx, projectedLevel: getLevelInfo(projectedXp).level };

  BADGES.filter((b) => b.tier === 'legendary').forEach((b) => {
    if (earned.has(b.key)) return;
    if (b.check(projectedCtx, earned)) earned.add(b.key);
  });

  return earned;
}
