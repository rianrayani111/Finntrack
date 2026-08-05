import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  { auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true } }
);

const CHILD_EMAIL_DOMAIN = 'child.finntrack.local';

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();
const normalizeUsername = (username) => String(username || '').trim().toLowerCase();
const toChildEmail = (username) => `${normalizeUsername(username)}@${CHILD_EMAIL_DOMAIN}`;

// Explicit field-by-field mappers between Postgres snake_case rows and the
// camelCase shape every page in the app already expects, so a schema/mapper
// mismatch fails loudly in review instead of silently dropping a field.
const rowToProfile = (row) => ({
  uid: row.id,
  role: row.role,
  displayName: row.display_name,
  email: row.email,
  username: row.username,
  parentId: row.parent_id,
  createdAt: row.created_at,
  streakCount: row.streak_count,
  lastLoginDate: row.last_login_date,
  xp: Number(row.xp) || 0,
  summaryViewsCount: Number(row.summary_views_count) || 0,
  historyViewsCount: Number(row.history_views_count) || 0,
  avatar: {
    skin: row.avatar_skin,
    hairStyle: row.avatar_hair_style,
    hairColor: row.avatar_hair_color,
    face: row.avatar_face,
  },
});

const rowToTransaction = (row) => ({
  id: row.id,
  childId: row.child_id,
  parentId: row.parent_id,
  type: row.type,
  amount: Number(row.amount),
  category: row.category,
  reason: row.reason,
  location: row.location,
  notes: row.notes || '',
  date: row.date,
  time: row.time,
  createdBy: row.created_by,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const rowToGoal = (row) => ({
  id: row.id,
  parentId: row.parent_id,
  childId: row.child_id,
  title: row.title,
  goalType: row.goal_type,
  targetAmount: Number(row.target_amount),
  startDate: row.start_date,
  endDate: row.end_date,
  reward: row.reward,
  baselineBalance: Number(row.baseline_balance),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const rowToAlert = (row) => ({
  id: row.id,
  parentId: row.parent_id,
  childId: row.child_id,
  childName: row.child_name,
  transactionId: row.transaction_id,
  amount: Number(row.amount),
  category: row.category,
  reason: row.reason,
  location: row.location,
  date: row.date,
  time: row.time,
  read: row.read,
  createdAt: row.created_at,
});

const requireCurrentUser = async () => {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Please log in first.');
  return user;
};

const requireCurrentProfile = async () => {
  const user = await requireCurrentUser();
  const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  if (error || !data) throw new Error('Your profile record is missing. Please contact support.');
  return rowToProfile(data);
};

// Reads the error body an Edge Function returned (via supabase.functions.invoke)
// so callers see the same clean message the function sent, not a generic HTTP error.
const readFunctionErrorMessage = async (error) => {
  try {
    const body = await error.context?.json();
    if (body?.error) return body.error;
  } catch {
    // fall through to the generic message below
  }
  return error.message || 'Something went wrong. Please try again.';
};

const auth = {
  childEmailFromUsername: (username) => toChildEmail(username),

  isAuthenticated: async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return Boolean(session);
  },

  me: async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: row } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    if (!row) return null;
    const profile = rowToProfile(row);

    return {
      id: profile.uid,
      email: user.email,
      role: profile.role,
      username: profile.username,
      displayName: profile.displayName,
      parentId: profile.parentId,
      data: {
        role: profile.role,
        username: profile.username,
        displayName: profile.displayName,
        parentId: profile.parentId,
        email: user.email,
      },
    };
  },

  loginViaEmailPassword: async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    return { access_token: data.session?.access_token, user: data.user };
  },

  registerParent: async ({ email, password, displayName }) => {
    const normalizedEmail = normalizeEmail(email);
    const normalizedPassword = String(password || '');
    if (!normalizedEmail) throw new Error('Parent email is required.');
    if (!normalizedPassword) throw new Error('Password is required.');

    const { error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password: normalizedPassword,
      options: {
        data: {
          role: 'parent',
          display_name: String(displayName || normalizedEmail.split('@')[0] || 'Parent').trim(),
        },
      },
    });
    if (error) throw new Error(error.message);
    return { pendingVerification: true, email: normalizedEmail };
  },

  register: async ({ email, password }) => auth.registerParent({ email, password, displayName: '' }),

  verifyOtp: async ({ email, otpCode }) => {
    const { data, error } = await supabase.auth.verifyOtp({
      email: normalizeEmail(email),
      token: String(otpCode || '').trim(),
      type: 'signup',
    });
    if (error) throw new Error(error.message);
    return { access_token: data.session?.access_token, user: data.user };
  },

  resendOtp: async (email) => {
    const normalizedEmail = normalizeEmail(email);
    const { error } = await supabase.auth.resend({ type: 'signup', email: normalizedEmail });
    if (error) throw new Error(error.message);
    return { pendingVerification: true, email: normalizedEmail };
  },

  createChildWithSecondaryApp: async ({ displayName, username, password }) => {
    const { data, error } = await supabase.functions.invoke('create-child-account', {
      body: { displayName, username, password },
    });
    if (error) {
      const message = await readFunctionErrorMessage(error);
      const err = new Error(message);
      // Lets callers distinguish "not paid yet, 402" (worth retrying while a
      // checkout's webhook is still landing) from a genuine failure like a
      // taken username, without string-matching the message.
      err.status = error.context?.status;
      throw err;
    }
    return data;
  },

  updateMe: async (profile = {}) => {
    const user = await requireCurrentUser();
    const nextDisplayName = String(profile.displayName || '').trim();
    const { data, error } = await supabase
      .from('profiles')
      .update(nextDisplayName ? { display_name: nextDisplayName } : {})
      .eq('id', user.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return rowToProfile(data);
  },

  resetPasswordRequest: async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/reset-password` : undefined,
    });
    if (error) throw new Error(error.message);
    return { success: true };
  },

  resetPassword: async ({ newPassword }) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw new Error(error.message);
    return { success: true };
  },

  // Same underlying call as resetPassword (supabase.auth.updateUser), but this
  // name is used from the logged-in Settings page rather than the post-recovery-
  // link flow, where "reset" reads oddly since there's already an active session.
  changePassword: async (newPassword) => auth.resetPassword({ newPassword }),

  deleteOwnAccount: async () => {
    const { data, error } = await supabase.functions.invoke('delete-own-account');
    if (error) throw new Error(await readFunctionErrorMessage(error));
    return data;
  },

  logout: async () => {
    await supabase.auth.signOut();
    return { success: true };
  },

  redirectToLogin: async () => {
    if (typeof window !== 'undefined') {
      window.location.assign('/login');
    }
    return { success: true };
  },
};

const users = {
  getMyProfile: async () => requireCurrentProfile(),

  getByUid: async (uid) => {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', uid).single();
    if (error || !data) return null;
    return rowToProfile(data);
  },

  listMyChildren: async () => {
    const user = await requireCurrentUser();
    const { data, error } = await supabase.from('profiles').select('*').eq('parent_id', user.id);
    if (error) throw new Error(error.message);
    return (data || []).map(rowToProfile);
  },

  checkUsernameAvailability: async (username) => {
    const normalized = normalizeUsername(username);
    if (!normalized) return { available: false };
    const { data, error } = await supabase.rpc('check_username_available', { p_username: normalized });
    if (error) throw new Error(error.message);
    return { available: Boolean(data) };
  },

  deleteChild: async (childUid) => {
    const { data, error } = await supabase.functions.invoke('delete-child-account', {
      body: { childUid },
    });
    if (error) throw new Error(await readFunctionErrorMessage(error));
    return data;
  },

  updateChildPassword: async (childUid, password) => {
    const { data, error } = await supabase.functions.invoke('update-child-password', {
      body: { childUid, password },
    });
    if (error) throw new Error(await readFunctionErrorMessage(error));
    return data;
  },

  // Called once per calendar day (idempotent server-side) so a child's
  // dashboard visit increments their login streak. p_today is the child's
  // local date, not the server's, so the streak matches what they see.
  bumpDailyStreak: async () => {
    const today = new Date();
    const localDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const { data, error } = await supabase.rpc('bump_daily_streak', { p_today: localDate });
    if (error) throw new Error(error.message);
    return Number(data) || 0;
  },

  updateAvatar: async ({ skin, hairStyle, hairColor, face }) => {
    const { error } = await supabase.rpc('update_avatar', {
      p_skin: skin || '',
      p_hair_style: hairStyle || '',
      p_hair_color: hairColor || '',
      p_face: face || '',
    });
    if (error) throw new Error(error.message);
    return { success: true };
  },

  // Persists any newly-qualified badges (computed client-side from
  // transaction history + profile state, see src/lib/gamification.js) and
  // awards their XP server-side exactly once. Returns the child's new total
  // XP and which of the submitted keys were actually newly earned.
  syncBadges: async (badgeKeys) => {
    const { data, error } = await supabase.rpc('sync_badges', { p_badge_keys: badgeKeys || [] });
    if (error) throw new Error(error.message);
    const row = (data || [])[0];
    return { totalXp: Number(row?.total_xp) || 0, newlyEarned: row?.newly_earned || [] };
  },

  listMyBadges: async () => {
    const user = await requireCurrentUser();
    const { data, error } = await supabase
      .from('user_badges')
      .select('badge_key, earned_at')
      .eq('child_id', user.id);
    if (error) throw new Error(error.message);
    return data || [];
  },

  listBadgesForChild: async (childId) => {
    const { data, error } = await supabase
      .from('user_badges')
      .select('badge_key, earned_at')
      .eq('child_id', childId);
    if (error) throw new Error(error.message);
    return data || [];
  },

  bumpSummaryViews: async () => {
    const { data, error } = await supabase.rpc('bump_summary_views');
    if (error) throw new Error(error.message);
    return Number(data) || 0;
  },

  bumpHistoryViews: async () => {
    const { data, error } = await supabase.rpc('bump_history_views');
    if (error) throw new Error(error.message);
    return Number(data) || 0;
  },
};

const transactionApi = {
  list: async () => {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .order('date', { ascending: false })
      .order('time', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map(rowToTransaction);
  },

  get: async (id) => {
    const { data, error } = await supabase.from('transactions').select('*').eq('id', id).single();
    if (error || !data) return null;
    return rowToTransaction(data);
  },

  create: async (payload = {}) => {
    const profile = await requireCurrentProfile();
    const amount = Number(payload.amount || 0);
    if (!(amount > 0)) throw new Error('Amount must be greater than zero.');

    let row;
    if (profile.role === 'parent') {
      if (payload.type !== 'deposit') throw new Error('Parents can only add money as a deposit.');
      const reason = String(payload.reason || '').trim();
      if (!reason) throw new Error('Please add a reason for this deposit.');

      row = {
        child_id: String(payload.childId || ''),
        parent_id: profile.uid,
        type: 'deposit',
        amount,
        category: null,
        reason,
        location: '',
        notes: String(payload.notes || '').trim(),
        date: String(payload.date || new Date().toISOString().slice(0, 10)),
        time: String(payload.time || new Date().toTimeString().slice(0, 5)),
        created_by: 'parent',
      };
    } else if (profile.role === 'child') {
      if (payload.type !== 'withdrawal') throw new Error('Children can only log withdrawals.');
      const category = String(payload.category || '').trim();
      const reason = String(payload.reason || '').trim();
      const location = String(payload.location || '').trim();
      if (!category) throw new Error('Please choose a category.');
      if (!reason) throw new Error('Please enter a reason.');
      if (!location) throw new Error('Please enter a location.');

      row = {
        child_id: profile.uid,
        parent_id: profile.parentId,
        type: 'withdrawal',
        amount,
        category,
        reason,
        location,
        notes: String(payload.notes || '').trim(),
        date: String(payload.date || new Date().toISOString().slice(0, 10)),
        time: String(payload.time || new Date().toTimeString().slice(0, 5)),
        created_by: 'child',
      };
    } else {
      throw new Error('Unknown role.');
    }

    const { data, error } = await supabase.from('transactions').insert(row).select().single();
    if (error) throw new Error(error.message);
    return rowToTransaction(data);
  },

  update: async (id, payload = {}) => {
    const type = String(payload.type || '').trim();
    if (!['deposit', 'withdrawal'].includes(type)) {
      throw new Error('Type must be either deposit or withdrawal.');
    }
    const amount = Number(payload.amount);
    if (!(amount > 0)) throw new Error('Amount must be greater than zero.');

    const date = String(payload.date || '').trim();
    const time = String(payload.time || '').trim();
    const reason = String(payload.reason || '').trim();
    if (!date) throw new Error('Date is required.');
    if (!time) throw new Error('Time is required.');
    if (!reason) throw new Error('Reason is required.');

    const location = String(payload.location || '').trim();
    const categoryRaw = payload.category;
    const category = categoryRaw === null || typeof categoryRaw === 'undefined' ? null : String(categoryRaw).trim();

    if (type === 'withdrawal') {
      if (!category) throw new Error('Category is required for withdrawals.');
      if (!location) throw new Error('Location is required for withdrawals.');
    }

    const row = {
      type,
      amount,
      date,
      time,
      reason,
      category: type === 'deposit' ? null : category,
      location: type === 'deposit' ? '' : location,
      notes: String(payload.notes || '').trim(),
      updated_at: new Date().toISOString(),
    };
    if (payload.childId) {
      row.child_id = String(payload.childId);
    }

    const { data, error } = await supabase.from('transactions').update(row).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    return rowToTransaction(data);
  },

  delete: async () => {
    throw new Error('Transactions cannot be deleted.');
  },
};

const goalApi = {
  list: async () => {
    const { data, error } = await supabase.from('goals').select('*').order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map(rowToGoal);
  },

  get: async (id) => {
    const { data, error } = await supabase.from('goals').select('*').eq('id', id).single();
    if (error || !data) return null;
    return rowToGoal(data);
  },

  create: async (payload = {}) => {
    const user = await requireCurrentUser();

    const childId = String(payload.childId || '').trim();
    const title = String(payload.title || '').trim();
    const goalType = String(payload.goalType || '').trim();
    const targetAmount = Number(payload.targetAmount || 0);
    const startDate = String(payload.startDate || '').trim();
    const endDate = String(payload.endDate || '').trim();
    const reward = String(payload.reward || '').trim();
    const baselineBalance = Number(payload.baselineBalance || 0);

    if (!childId) throw new Error('Child is required.');
    if (!title) throw new Error('Goal title is required.');
    if (!['earn', 'save'].includes(goalType)) throw new Error('Goal type must be either earn or save.');
    if (!(targetAmount > 0)) throw new Error('Target amount must be greater than zero.');
    if (!startDate || !endDate) throw new Error('Timeline start and end dates are required.');
    if (new Date(endDate).getTime() < new Date(startDate).getTime()) {
      throw new Error('Goal end date must be on or after the start date.');
    }

    const row = {
      parent_id: user.id,
      child_id: childId,
      title,
      goal_type: goalType,
      target_amount: targetAmount,
      start_date: startDate,
      end_date: endDate,
      reward,
      baseline_balance: Number.isFinite(baselineBalance) ? baselineBalance : 0,
    };

    const { data, error } = await supabase.from('goals').insert(row).select().single();
    if (error) throw new Error(error.message);
    return rowToGoal(data);
  },

  update: async (id, payload = {}) => {
    const childId = String(payload.childId || '').trim();
    const title = String(payload.title || '').trim();
    const goalType = String(payload.goalType || '').trim();
    const targetAmount = Number(payload.targetAmount || 0);
    const startDate = String(payload.startDate || '').trim();
    const endDate = String(payload.endDate || '').trim();
    const reward = String(payload.reward || '').trim();

    if (!childId) throw new Error('Child is required.');
    if (!title) throw new Error('Goal title is required.');
    if (!['earn', 'save'].includes(goalType)) throw new Error('Goal type must be either earn or save.');
    if (!(targetAmount > 0)) throw new Error('Target amount must be greater than zero.');
    if (!startDate || !endDate) throw new Error('Timeline start and end dates are required.');
    if (new Date(endDate).getTime() < new Date(startDate).getTime()) {
      throw new Error('Goal end date must be on or after the start date.');
    }

    const row = {
      child_id: childId,
      title,
      goal_type: goalType,
      target_amount: targetAmount,
      start_date: startDate,
      end_date: endDate,
      reward,
      updated_at: new Date().toISOString(),
    };
    if (typeof payload.baselineBalance !== 'undefined') {
      const baseline = Number(payload.baselineBalance);
      row.baseline_balance = Number.isFinite(baseline) ? baseline : 0;
    }

    const { data, error } = await supabase.from('goals').update(row).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    return rowToGoal(data);
  },

  delete: async (id) => {
    const { error } = await supabase.from('goals').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return { success: true };
  },
};

const billingApi = {
  getStatus: async () => {
    const { data, error } = await supabase.rpc('get_family_subscription_status');
    if (error) throw new Error(error.message);
    const row = (data || [])[0];
    return row
      ? { status: row.status, currentPeriodEnd: row.current_period_end, childCount: row.child_count ?? 0 }
      : { status: null, currentPeriodEnd: null, childCount: 0 };
  },

  createCheckoutSession: async (interval, returnTo) => {
    const { data, error } = await supabase.functions.invoke('create-checkout-session', {
      body: returnTo ? { interval, returnTo } : { interval },
    });
    if (error) throw new Error(await readFunctionErrorMessage(error));
    return data;
  },

  createPortalSession: async () => {
    const { data, error } = await supabase.functions.invoke('create-portal-session');
    if (error) throw new Error(await readFunctionErrorMessage(error));
    return data;
  },
};

const alertsApi = {
  list: async () => {
    const { data, error } = await supabase
      .from('alerts')
      .select('*')
      .order('date', { ascending: false })
      .order('time', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map(rowToAlert);
  },

  markRead: async (alertId) => {
    const { error } = await supabase.from('alerts').update({ read: true }).eq('id', alertId);
    if (error) return { success: false };
    return { success: true };
  },

  markAllRead: async () => {
    const user = await requireCurrentUser();
    const { error } = await supabase.from('alerts').update({ read: true }).eq('parent_id', user.id).eq('read', false);
    if (error) return { success: false };
    return { success: true };
  },
};

export const db = {
  auth,
  users,
  billing: billingApi,
  alerts: alertsApi,
  entities: {
    Transaction: transactionApi,
    Goal: goalApi,
  },
  integrations: {
    Core: {
      UploadFile: async () => ({ file_url: '' }),
    },
  },
};

export default db;
