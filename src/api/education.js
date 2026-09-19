// Data layer for the schools & institutions side of the app (student and
// educator accounts). Kept apart from db.js, which is the family product's
// data layer: the two share the Supabase client and nothing else.
//
// Every write goes through a SECURITY DEFINER function (supabase/migrations
// 0031); tables are read-only to the client under RLS.
import { supabase } from '@/api/db';

const STUDENT_EMAIL_DOMAIN = 'student.finntrack.local';

// Keep in sync with handle_new_user (0030) and create-student-account.
export const studentEmail = (classId, username) =>
  `${String(username || '').trim().toLowerCase()}.${String(classId).replaceAll('-', '')}@${STUDENT_EMAIL_DOMAIN}`;

const num = (value) => (value === null || value === undefined ? null : Number(value));

const rpc = async (fn, args) => {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data;
};

const rows = async (query) => {
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data || [];
};

const rowToItem = (row) => ({
  id: row.id,
  name: row.name,
  description: row.description,
  category: row.category,
  assetKind: row.asset_kind,
  price: num(row.price),
  stock: row.stock,
  perStudentLimit: row.per_student_limit,
  saleMode: row.sale_mode,
  isActive: row.is_active,
  bondTermDays: row.bond_term_days,
  bondRatePct: num(row.bond_rate_pct),
  ventureMultiplier: num(row.venture_multiplier),
  weeklyIncome: num(row.weekly_income),
  createdAt: row.created_at,
});

// "In the store right now": what makes a listing a commodity (goes live
// straight away) rather than a new item (needs teacher approval). Mirrors
// edu_create_listing, which is what actually decides.
export const isInStoreNow = (item) =>
  Boolean(item?.isActive && item.saleMode === 'buy' && (item.stock === null || item.stock > 0));

const rowToHolding = (row) => ({
  id: row.id,
  studentId: row.student_id,
  itemId: row.item_id,
  item: row.item ? rowToItem(row.item) : null,
  mode: row.mode,
  status: row.status,
  pricePaid: num(row.price_paid),
  acquiredAt: row.acquired_at,
  maturesAt: row.matures_at,
  redeemedAt: row.redeemed_at,
  closedAt: row.closed_at,
  payout: num(row.payout),
});

const rowToListing = (row) => ({
  id: row.id,
  sellerId: row.seller_id,
  holdingId: row.holding_id,
  itemId: row.item_id,
  item: row.item ? rowToItem(row.item) : null,
  originalPrice: row.holding ? num(row.holding.price_paid) : null,
  saleType: row.sale_type,
  price: num(row.price),
  durationSeconds: row.duration_seconds,
  status: row.status,
  endsAt: row.ends_at,
  highBid: num(row.high_bid),
  highBidderId: row.high_bidder_id,
  bidCount: row.bid_count,
  buyerId: row.buyer_id,
  soldPrice: num(row.sold_price),
  createdAt: row.created_at,
  soldAt: row.sold_at,
});

const rowToLedger = (row) => ({
  id: row.id,
  account: row.account,
  amount: num(row.amount),
  kind: row.kind,
  description: row.description,
  createdAt: row.created_at,
});

const LISTING_SELECT = '*, item:edu_store_items(*), holding:edu_holdings(price_paid)';

export const education = {
  // ---- Login ----

  findClass: async (schoolName, classCode) => {
    const data = await rpc('edu_find_class', { p_school_name: schoolName, p_class_code: classCode });
    const row = data?.[0];
    if (!row) return null;
    return {
      classId: row.class_id,
      className: row.class_name,
      schoolName: row.school_name,
      allowStudentPasswordReset: row.allow_student_password_reset,
    };
  },

  // ---- Portal ----

  // Brings the class up to date (paydays, auctions, bonds) and counts today's
  // login toward the streak. Call before reading anything time-dependent.
  refresh: () => rpc('edu_refresh'),

  summary: async () => {
    const s = await rpc('edu_my_summary');
    return {
      ...s,
      cash: num(s.cash),
      savings: num(s.savings),
      held: num(s.held),
      totalInterest: num(s.totalInterest),
      netWorth: num(s.netWorth),
      savingsRatePct: num(s.savingsRatePct),
      savingsGoalAmount: num(s.savingsGoalAmount),
    };
  },

  ledger: async ({ kinds, limit = 50 } = {}) => {
    let query = supabase.from('edu_ledger').select('*').order('created_at', { ascending: false }).limit(limit);
    if (kinds?.length) query = query.in('kind', kinds);
    return (await rows(query)).map(rowToLedger);
  },

  transfer: (direction, amount) => rpc('edu_transfer', { p_direction: direction, p_amount: amount }),

  // ---- Store and items ----

  storeItems: async () =>
    (await rows(supabase.from('edu_store_items').select('*').order('created_at'))).map(rowToItem),

  buyStoreItem: (itemId, quantity, mode) =>
    rpc('edu_buy_store_item', { p_item_id: itemId, p_quantity: quantity, p_mode: mode }),

  holdings: async ({ includeUsed = false } = {}) => {
    let query = supabase
      .from('edu_holdings')
      .select('*, item:edu_store_items(*)')
      .order('acquired_at', { ascending: false });
    if (!includeUsed) query = query.in('status', ['held', 'listed']);
    return (await rows(query)).map(rowToHolding);
  },

  setHoldingMode: (holdingId, mode) => rpc('edu_set_holding_mode', { p_holding_id: holdingId, p_mode: mode }),

  redeemHolding: (holdingId) => rpc('edu_redeem_holding', { p_holding_id: holdingId }),

  // ---- Marketplace ----

  // Live listings in the class plus the caller's own (pending included);
  // RLS decides which rows come back.
  listings: async () =>
    (
      await rows(
        supabase
          .from('edu_listings')
          .select(LISTING_SELECT)
          .in('status', ['live', 'pending_approval'])
          .order('created_at', { ascending: false })
      )
    ).map(rowToListing),

  createListing: ({ holdingId, saleType, price, durationHours }) =>
    rpc('edu_create_listing', {
      p_holding_id: holdingId,
      p_sale_type: saleType,
      p_price: price,
      p_duration_hours: durationHours,
    }),

  updateListingPrice: (listingId, price) =>
    rpc('edu_update_listing_price', { p_listing_id: listingId, p_price: price }),

  cancelListing: (listingId) => rpc('edu_cancel_listing', { p_listing_id: listingId }),

  buyListing: (listingId) => rpc('edu_buy_listing', { p_listing_id: listingId }),

  placeBid: (listingId, amount) => rpc('edu_place_bid', { p_listing_id: listingId, p_amount: amount }),

  myBids: async () =>
    (
      await rows(
        supabase
          .from('edu_bids')
          .select('*, listing:edu_listings(id, status, ends_at, high_bid, item:edu_store_items(name))')
          .order('created_at', { ascending: false })
          .limit(30)
      )
    ).map((row) => ({
      id: row.id,
      listingId: row.listing_id,
      bidderId: row.bidder_id,
      amount: num(row.amount),
      status: row.status,
      createdAt: row.created_at,
      itemName: row.listing?.item?.name || 'Item',
      listingStatus: row.listing?.status,
      endsAt: row.listing?.ends_at,
      highBid: num(row.listing?.high_bid),
    })),

  marketEvents: async (limit = 30) =>
    (
      await rows(
        supabase.from('edu_market_events').select('*').order('created_at', { ascending: false }).limit(limit)
      )
    ).map((row) => ({
      id: row.id,
      listingId: row.listing_id,
      kind: row.kind,
      itemName: row.item_name,
      amount: num(row.amount),
      read: Boolean(row.read_at),
      createdAt: row.created_at,
    })),

  markMarketEventsRead: () => rpc('edu_mark_market_events_read'),

  classmates: async () =>
    (await rpc('edu_classmates')).map((row) => ({
      studentId: row.student_id,
      displayName: row.display_name,
      avatarEmoji: row.avatar_emoji,
    })),

  // ---- Jobs ----

  jobs: async () => {
    const [jobs, assignments, applications] = await Promise.all([
      rows(supabase.from('edu_jobs').select('*').eq('is_active', true).order('weekly_salary', { ascending: false })),
      rows(supabase.from('edu_job_assignments').select('*').is('ended_at', null)),
      rows(supabase.from('edu_job_applications').select('*').order('created_at', { ascending: false })),
    ]);
    const now = Date.now();
    const activeAssignments = assignments.filter((a) => new Date(a.ends_at).getTime() > now);
    return {
      jobs: jobs.map((row) => ({
        id: row.id,
        title: row.title,
        icon: row.icon,
        description: row.description,
        responsibilities: row.responsibilities,
        qualifications: row.qualifications,
        nextTask: row.next_task,
        weeklySalary: num(row.weekly_salary),
        filled: activeAssignments.some((a) => a.job_id === row.id),
      })),
      assignments: activeAssignments.map((row) => ({
        id: row.id,
        jobId: row.job_id,
        studentId: row.student_id,
        startsAt: row.starts_at,
        endsAt: row.ends_at,
      })),
      applications: applications.map((row) => ({
        id: row.id,
        jobId: row.job_id,
        status: row.status,
        createdAt: row.created_at,
      })),
    };
  },

  applyForJob: (jobId) => rpc('edu_apply_for_job', { p_job_id: jobId }),

  withdrawJobApplication: (applicationId) =>
    rpc('edu_withdraw_job_application', { p_application_id: applicationId }),

  // ---- Class ----

  leaderboard: async () =>
    (await rpc('edu_class_leaderboard')).map((row) => ({
      studentId: row.student_id,
      rank: Number(row.rank),
      displayName: row.display_name,
      avatarEmoji: row.avatar_emoji,
      quote: row.quote,
      jobTitle: row.job_title,
      netWorth: num(row.net_worth),
      holdingsSummary: row.holdings_summary,
      isMe: row.is_me,
    })),

  portfolio: async (studentId) => rpc('edu_student_portfolio', { p_student_id: studentId }),

  // ---- Badges and profile ----

  badges: async () => {
    const [defs, earned] = await Promise.all([
      rows(supabase.from('edu_badge_defs').select('*').order('sort_order')),
      rows(supabase.from('edu_student_badges').select('*')),
    ]);
    const earnedAt = new Map(earned.map((row) => [row.badge_key, row.earned_at]));
    return defs.map((row) => ({
      key: row.key,
      name: row.name,
      description: row.description,
      reward: num(row.reward),
      earnedAt: earnedAt.get(row.key) || null,
    }));
  },

  updateProfile: ({
    displayName,
    avatarEmoji,
    quote,
    savingsGoalName,
    savingsGoalAmount,
    showHoldings,
    pinnedBadges,
  }) =>
    rpc('edu_update_my_profile', {
      p_display_name: displayName,
      p_avatar_emoji: avatarEmoji,
      p_quote: quote,
      p_savings_goal_name: savingsGoalName,
      p_savings_goal_amount: savingsGoalAmount,
      p_show_holdings: showHoldings,
      p_pinned_badges: pinnedBadges,
    }),
};
