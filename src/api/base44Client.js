const storage = typeof window !== 'undefined' ? window.localStorage : null;

const KEYS = {
  authState: 'finntrack_auth_state',
  authAccounts: 'finntrack_auth_accounts',
  users: 'finntrack_users',
  usernames: 'finntrack_usernames',
  transactions: 'finntrack_transactions',
  goals: 'finntrack_goals',
  alerts: 'finntrack_alerts',
};

const CHILD_EMAIL_DOMAIN = 'child.finntrack.local';

const createId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const nowIso = () => new Date().toISOString();

const readJson = (key, fallbackValue) => {
  if (!storage) return fallbackValue;
  try {
    const raw = storage.getItem(key);
    return raw ? JSON.parse(raw) : fallbackValue;
  } catch {
    return fallbackValue;
  }
};

const writeJson = (key, value) => {
  if (!storage) return;
  storage.setItem(key, JSON.stringify(value));
};

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();
const normalizeUsername = (username) => String(username || '').trim().toLowerCase();
const toChildEmail = (username) => `${normalizeUsername(username)}@${CHILD_EMAIL_DOMAIN}`;

const readAuthState = () => readJson(KEYS.authState, null);
const writeAuthState = (value) => writeJson(KEYS.authState, value);
const readAuthAccounts = () => readJson(KEYS.authAccounts, []);
const writeAuthAccounts = (value) => writeJson(KEYS.authAccounts, value);
const readUsers = () => readJson(KEYS.users, []);
const writeUsers = (value) => writeJson(KEYS.users, value);
const readUsernames = () => readJson(KEYS.usernames, {});
const writeUsernames = (value) => writeJson(KEYS.usernames, value);
const readTransactions = () => readJson(KEYS.transactions, []);
const writeTransactions = (value) => writeJson(KEYS.transactions, value);
const readGoals = () => readJson(KEYS.goals, []);
const writeGoals = (value) => writeJson(KEYS.goals, value);
const readAlerts = () => readJson(KEYS.alerts, []);
const writeAlerts = (value) => writeJson(KEYS.alerts, value);

const getCurrentUser = () => {
  const authState = readAuthState();
  if (!authState?.uid || !authState?.token) return null;
  const users = readUsers();
  return users.find((u) => u.uid === authState.uid) || null;
};

const toSdkUser = (user) => {
  if (!user) return null;
  return {
    id: user.uid,
    email: user.email,
    role: user.role,
    username: user.username,
    displayName: user.displayName,
    parentId: user.parentId,
    data: {
      role: user.role,
      username: user.username,
      displayName: user.displayName,
      parentId: user.parentId,
      email: user.email,
    },
  };
};

const requireSignedInUser = () => {
  const user = getCurrentUser();
  if (!user) {
    throw new Error('Please log in first.');
  }
  return user;
};

const ensureChildBelongsToParent = (childId, parentId) => {
  const users = readUsers();
  const child = users.find((u) => u.uid === childId && u.role === 'child');
  if (!child || child.parentId !== parentId) {
    throw new Error('That child account does not belong to your family.');
  }
  return child;
};

const sortByDateTimeDesc = (items) => {
  return [...items].sort((a, b) => {
    const aTs = new Date(`${a.date || ''}T${a.time || '00:00'}:00`).getTime();
    const bTs = new Date(`${b.date || ''}T${b.time || '00:00'}:00`).getTime();
    return bTs - aTs;
  });
};

const createFallbackDb = () => {
  const auth = {
    childEmailFromUsername: (username) => toChildEmail(username),

    isAuthenticated: async () => Boolean(readAuthState()?.token),

    me: async () => {
      const currentUser = getCurrentUser();
      return toSdkUser(currentUser);
    },

    loginViaEmailPassword: async (email, password) => {
      const normalizedEmail = normalizeEmail(email);
      const accounts = readAuthAccounts();
      const account = accounts.find((item) => item.email === normalizedEmail);

      if (!account || String(account.password) !== String(password || '')) {
        throw new Error('Incorrect email/username or password.');
      }

      const users = readUsers();
      const user = users.find((u) => u.uid === account.uid);
      if (!user) {
        throw new Error('Your profile record is missing. Please contact support.');
      }

      const authState = { uid: user.uid, token: `local-${createId()}` };
      writeAuthState(authState);
      return { access_token: authState.token, user: toSdkUser(user) };
    },

    registerParent: async ({ email, password, displayName }) => {
      const normalizedEmail = normalizeEmail(email);
      const normalizedPassword = String(password || '');

      if (!normalizedEmail) throw new Error('Parent email is required.');
      if (!normalizedPassword) throw new Error('Password is required.');

      const accounts = readAuthAccounts();
      if (accounts.some((item) => item.email === normalizedEmail)) {
        throw new Error('An account with this email already exists.');
      }

      const uid = createId();
      const users = readUsers();
      const userDoc = {
        uid,
        role: 'parent',
        displayName: String(displayName || normalizedEmail.split('@')[0] || 'Parent').trim(),
        email: normalizedEmail,
        username: null,
        parentId: null,
        createdAt: nowIso(),
      };

      accounts.push({ uid, email: normalizedEmail, password: normalizedPassword });
      users.push(userDoc);
      writeAuthAccounts(accounts);
      writeUsers(users);

      const authState = { uid, token: `local-${createId()}` };
      writeAuthState(authState);
      return { access_token: authState.token, user: toSdkUser(userDoc) };
    },

    register: async ({ email, password }) => {
      return auth.registerParent({ email, password, displayName: '' });
    },

    createChildWithSecondaryApp: async ({ displayName, username, password }) => {
      const primaryAuthBefore = readAuthState();
      const parent = requireSignedInUser();
      if (parent.role !== 'parent') {
        throw new Error('Only a parent can create a child account.');
      }

      const normalizedUsername = normalizeUsername(username);
      const childPassword = String(password || '');
      const childDisplayName = String(displayName || '').trim();

      if (!normalizedUsername) throw new Error('Username is required.');
      if (!childDisplayName) throw new Error('Child display name is required.');
      if (!childPassword) throw new Error('Password is required.');

      const usernames = readUsernames();
      if (usernames[normalizedUsername]) {
        throw new Error('That username is already taken. Please choose another one.');
      }

      const syntheticEmail = toChildEmail(normalizedUsername);
      const accounts = readAuthAccounts();
      if (accounts.some((item) => item.email === syntheticEmail)) {
        throw new Error('That username is already taken. Please choose another one.');
      }

      const childUid = createId();
      const users = readUsers();
      const childUserDoc = {
        uid: childUid,
        role: 'child',
        displayName: childDisplayName,
        email: null,
        username: normalizedUsername,
        parentId: parent.uid,
        createdAt: nowIso(),
      };

      // Simulated secondary auth app: create child auth credentials without touching primary session.
      const secondaryAuth = {
        currentUid: null,
        signOut: () => {
          secondaryAuth.currentUid = null;
        },
      };

      accounts.push({ uid: childUid, email: syntheticEmail, password: childPassword });
      secondaryAuth.currentUid = childUid;
      users.push(childUserDoc);
      usernames[normalizedUsername] = { childUid, parentId: parent.uid };

      writeAuthAccounts(accounts);
      writeUsers(users);
      writeUsernames(usernames);

      secondaryAuth.signOut();

      const primaryAfter = readAuthState();
      const parentStayedLoggedIn =
        Boolean(primaryAuthBefore?.uid) &&
        primaryAuthBefore?.uid === primaryAfter?.uid &&
        primaryAuthBefore?.token === primaryAfter?.token;

      return {
        childUid,
        username: normalizedUsername,
        syntheticEmail,
        parentStayedLoggedIn,
      };
    },

    updateMe: async (profile = {}) => {
      const current = requireSignedInUser();
      const users = readUsers();
      const index = users.findIndex((u) => u.uid === current.uid);
      if (index < 0) throw new Error('User not found.');

      const nextDisplayName = String(profile.displayName || '').trim();
      users[index] = {
        ...users[index],
        displayName: nextDisplayName || users[index].displayName,
      };
      writeUsers(users);
      return toSdkUser(users[index]);
    },

    resetPasswordRequest: async () => ({ success: true }),
    resetPassword: async () => ({ success: true }),
    setToken: async () => ({ success: true }),

    logout: async () => {
      writeAuthState(null);
      return { success: true };
    },

    redirectToLogin: async () => {
      if (typeof window !== 'undefined') {
        window.location.assign('/login');
      }
      return { success: true };
    },
  };

  const usersApi = {
    getMyProfile: async () => {
      const user = requireSignedInUser();
      return user;
    },

    getByUid: async (uid) => {
      const current = requireSignedInUser();
      const users = readUsers();
      const target = users.find((u) => u.uid === uid) || null;
      if (!target) return null;

      if (current.uid === uid) return target;
      if (current.role === 'parent' && target.parentId === current.uid) return target;
      throw new Error('You are not allowed to view this profile.');
    },

    listMyChildren: async () => {
      const parent = requireSignedInUser();
      if (parent.role !== 'parent') {
        throw new Error('Only a parent can view children.');
      }
      const users = readUsers();
      return users.filter((u) => u.role === 'child' && u.parentId === parent.uid);
    },

    checkUsernameAvailability: async (username) => {
      const normalized = normalizeUsername(username);
      if (!normalized) return { available: false };
      const usernames = readUsernames();
      return { available: !Boolean(usernames[normalized]) };
    },

    deleteChild: async (childUid) => {
      const parent = requireSignedInUser();
      if (parent.role !== 'parent') {
        throw new Error('Only a parent can delete a child account.');
      }

      const child = ensureChildBelongsToParent(childUid, parent.uid);
      const users = readUsers().filter((u) => u.uid !== childUid);
      const accounts = readAuthAccounts().filter((acc) => acc.uid !== childUid);
      const usernames = readUsernames();
      delete usernames[String(child.username || '').toLowerCase()];
      const transactions = readTransactions().filter((t) => t.childId !== childUid);
      const goals = readGoals().filter((g) => g.childId !== childUid);
      const alerts = readAlerts().filter((a) => a.childId !== childUid);

      writeUsers(users);
      writeAuthAccounts(accounts);
      writeUsernames(usernames);
      writeTransactions(transactions);
      writeGoals(goals);
      writeAlerts(alerts);

      return { success: true };
    },
  };

  const transactionApi = {
    list: async () => {
      const user = requireSignedInUser();
      const transactions = readTransactions();
      const visible =
        user.role === 'parent'
          ? transactions.filter((t) => t.parentId === user.uid)
          : transactions.filter((t) => t.childId === user.uid);
      return sortByDateTimeDesc(visible);
    },

    get: async (id) => {
      const user = requireSignedInUser();
      const transaction = readTransactions().find((t) => t.id === id) || null;
      if (!transaction) return null;
      const canRead =
        (user.role === 'parent' && transaction.parentId === user.uid) ||
        (user.role === 'child' && transaction.childId === user.uid);
      if (!canRead) throw new Error('You are not allowed to view this transaction.');
      return transaction;
    },

    create: async (payload = {}) => {
      const user = requireSignedInUser();
      const amount = Number(payload.amount || 0);
      if (!(amount > 0)) {
        throw new Error('Amount must be greater than zero.');
      }

      const transactions = readTransactions();
      const alerts = readAlerts();

      if (user.role === 'parent') {
        if (payload.type !== 'deposit') {
          throw new Error('Parents can only add money as a deposit.');
        }

        const childId = String(payload.childId || '');
        ensureChildBelongsToParent(childId, user.uid);

        const record = {
          id: createId(),
          childId,
          parentId: user.uid,
          type: 'deposit',
          amount,
          category: null,
          reason: String(payload.reason || '').trim(),
          location: '',
          date: String(payload.date || new Date().toISOString().slice(0, 10)),
          time: String(payload.time || new Date().toTimeString().slice(0, 5)),
          createdBy: 'parent',
          createdAt: nowIso(),
        };

        if (!record.reason) {
          throw new Error('Please add a reason for this deposit.');
        }

        transactions.push(record);
        writeTransactions(transactions);
        return record;
      }

      if (user.role === 'child') {
        if (payload.type !== 'withdrawal') {
          throw new Error('Children can only log withdrawals.');
        }

        const record = {
          id: createId(),
          childId: user.uid,
          parentId: user.parentId,
          type: 'withdrawal',
          amount,
          category: String(payload.category || '').trim(),
          reason: String(payload.reason || '').trim(),
          location: String(payload.location || '').trim(),
          date: String(payload.date || new Date().toISOString().slice(0, 10)),
          time: String(payload.time || new Date().toTimeString().slice(0, 5)),
          createdBy: 'child',
          createdAt: nowIso(),
        };

        if (!record.category) throw new Error('Please choose a category.');
        if (!record.reason) throw new Error('Please enter a reason.');
        if (!record.location) throw new Error('Please enter a location.');

        const alertRecord = {
          id: createId(),
          parentId: user.parentId,
          childId: user.uid,
          childName: user.displayName,
          transactionId: record.id,
          amount: record.amount,
          category: record.category,
          reason: record.reason,
          location: record.location,
          date: record.date,
          time: record.time,
          read: false,
          createdAt: nowIso(),
        };

        // Batched write semantics in fallback mode: both writes are persisted together.
        transactions.push(record);
        alerts.push(alertRecord);
        writeTransactions(transactions);
        writeAlerts(alerts);

        return record;
      }

      throw new Error('Unknown role.');
    },

    update: async (id, payload = {}) => {
      const user = requireSignedInUser();
      if (user.role !== 'parent') {
        throw new Error('Only a parent can edit transactions.');
      }

      const transactions = readTransactions();
      const index = transactions.findIndex((t) => t.id === id && t.parentId === user.uid);

      if (index < 0) {
        throw new Error('Transaction not found.');
      }

      const current = transactions[index];
      const nextChildId = String(payload.childId ?? current.childId).trim();
      ensureChildBelongsToParent(nextChildId, user.uid);

      const nextType = String(payload.type ?? current.type).trim();
      const nextAmount = Number(payload.amount ?? current.amount);
      const nextDate = String(payload.date ?? current.date).trim();
      const nextTime = String(payload.time ?? current.time).trim();
      const nextReason = String(payload.reason ?? current.reason).trim();
      const nextLocation = String(payload.location ?? current.location).trim();
      const nextCategoryRaw = payload.category ?? current.category;
      const nextCategory =
        nextCategoryRaw === null || typeof nextCategoryRaw === 'undefined'
          ? null
          : String(nextCategoryRaw).trim();

      if (!['deposit', 'withdrawal'].includes(nextType)) {
        throw new Error('Type must be either deposit or withdrawal.');
      }
      if (!(nextAmount > 0)) {
        throw new Error('Amount must be greater than zero.');
      }
      if (!nextDate) throw new Error('Date is required.');
      if (!nextTime) throw new Error('Time is required.');
      if (!nextReason) throw new Error('Reason is required.');

      if (nextType === 'withdrawal') {
        if (!nextCategory) throw new Error('Category is required for withdrawals.');
        if (!nextLocation) throw new Error('Location is required for withdrawals.');
      }

      const normalizedRecord = {
        ...current,
        childId: nextChildId,
        parentId: user.uid,
        type: nextType,
        amount: nextAmount,
        date: nextDate,
        time: nextTime,
        reason: nextReason,
        category: nextType === 'deposit' ? null : nextCategory,
        location: nextType === 'deposit' ? '' : nextLocation,
        updatedAt: nowIso(),
      };

      transactions[index] = normalizedRecord;
      writeTransactions(transactions);

      const users = readUsers();
      const child = users.find((u) => u.uid === normalizedRecord.childId);
      const alerts = readAlerts().map((alert) => {
        if (alert.parentId !== user.uid || alert.transactionId !== normalizedRecord.id) {
          return alert;
        }

        return {
          ...alert,
          childId: normalizedRecord.childId,
          childName: child?.displayName || alert.childName,
          amount: normalizedRecord.amount,
          category: normalizedRecord.category,
          reason: normalizedRecord.reason,
          location: normalizedRecord.location,
          date: normalizedRecord.date,
          time: normalizedRecord.time,
        };
      });
      writeAlerts(alerts);

      return normalizedRecord;
    },

    delete: async () => {
      throw new Error('Transactions cannot be deleted.');
    },
  };

  const alertsApi = {
    list: async () => {
      const user = requireSignedInUser();
      if (user.role !== 'parent') {
        throw new Error('Children cannot access alerts.');
      }
      const alerts = readAlerts().filter((a) => a.parentId === user.uid);
      return sortByDateTimeDesc(alerts);
    },

    markRead: async (alertId) => {
      const user = requireSignedInUser();
      if (user.role !== 'parent') {
        throw new Error('Children cannot update alerts.');
      }
      const alerts = readAlerts();
      const index = alerts.findIndex((a) => a.id === alertId && a.parentId === user.uid);
      if (index < 0) return { success: false };
      alerts[index] = { ...alerts[index], read: true };
      writeAlerts(alerts);
      return { success: true };
    },

    markAllRead: async () => {
      const user = requireSignedInUser();
      if (user.role !== 'parent') {
        throw new Error('Children cannot update alerts.');
      }
      const alerts = readAlerts().map((a) => {
        if (a.parentId !== user.uid) return a;
        return { ...a, read: true };
      });
      writeAlerts(alerts);
      return { success: true };
    },
  };

  const goalApi = {
    list: async () => {
      const user = requireSignedInUser();
      const goals = readGoals();
      const visible =
        user.role === 'parent'
          ? goals.filter((g) => g.parentId === user.uid)
          : goals.filter((g) => g.childId === user.uid);

      return [...visible].sort((a, b) => {
        const aTs = new Date(a.createdAt || 0).getTime();
        const bTs = new Date(b.createdAt || 0).getTime();
        return bTs - aTs;
      });
    },

    get: async (id) => {
      const user = requireSignedInUser();
      const goal = readGoals().find((g) => g.id === id) || null;
      if (!goal) return null;

      const canRead =
        (user.role === 'parent' && goal.parentId === user.uid) ||
        (user.role === 'child' && goal.childId === user.uid);

      if (!canRead) {
        throw new Error('You are not allowed to view this goal.');
      }

      return goal;
    },

    create: async (payload = {}) => {
      const user = requireSignedInUser();
      if (user.role !== 'parent') {
        throw new Error('Only a parent can create goals.');
      }

      const childId = String(payload.childId || '').trim();
      if (!childId) throw new Error('Child is required.');
      ensureChildBelongsToParent(childId, user.uid);

      const title = String(payload.title || '').trim();
      const goalType = String(payload.goalType || '').trim();
      const targetAmount = Number(payload.targetAmount || 0);
      const startDate = String(payload.startDate || '').trim();
      const endDate = String(payload.endDate || '').trim();
      const reward = String(payload.reward || '').trim();
      const baselineBalance = Number(payload.baselineBalance || 0);

      if (!title) throw new Error('Goal title is required.');
      if (!['earn', 'save'].includes(goalType)) {
        throw new Error('Goal type must be either earn or save.');
      }
      if (!(targetAmount > 0)) {
        throw new Error('Target amount must be greater than zero.');
      }
      if (!startDate || !endDate) {
        throw new Error('Timeline start and end dates are required.');
      }
      if (new Date(endDate).getTime() < new Date(startDate).getTime()) {
        throw new Error('Goal end date must be on or after the start date.');
      }

      const goal = {
        id: createId(),
        parentId: user.uid,
        childId,
        title,
        goalType,
        targetAmount,
        startDate,
        endDate,
        reward,
        baselineBalance: Number.isFinite(baselineBalance) ? baselineBalance : 0,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };

      const goals = readGoals();
      goals.push(goal);
      writeGoals(goals);
      return goal;
    },

    update: async (id, payload = {}) => {
      const user = requireSignedInUser();
      if (user.role !== 'parent') {
        throw new Error('Only a parent can update goals.');
      }

      const goals = readGoals();
      const index = goals.findIndex((g) => g.id === id && g.parentId === user.uid);
      if (index < 0) {
        throw new Error('Goal not found.');
      }

      const currentGoal = goals[index];
      const nextChildId = String(payload.childId ?? currentGoal.childId).trim();
      ensureChildBelongsToParent(nextChildId, user.uid);

      const nextTitle = String(payload.title ?? currentGoal.title).trim();
      const nextGoalType = String(payload.goalType ?? currentGoal.goalType).trim();
      const nextTargetAmount = Number(payload.targetAmount ?? currentGoal.targetAmount);
      const nextStartDate = String(payload.startDate ?? currentGoal.startDate).trim();
      const nextEndDate = String(payload.endDate ?? currentGoal.endDate).trim();
      const nextReward = String(payload.reward ?? currentGoal.reward).trim();
      const nextBaseline = Number(payload.baselineBalance ?? currentGoal.baselineBalance ?? 0);

      if (!nextTitle) throw new Error('Goal title is required.');
      if (!['earn', 'save'].includes(nextGoalType)) {
        throw new Error('Goal type must be either earn or save.');
      }
      if (!(nextTargetAmount > 0)) {
        throw new Error('Target amount must be greater than zero.');
      }
      if (!nextStartDate || !nextEndDate) {
        throw new Error('Timeline start and end dates are required.');
      }
      if (new Date(nextEndDate).getTime() < new Date(nextStartDate).getTime()) {
        throw new Error('Goal end date must be on or after the start date.');
      }

      goals[index] = {
        ...currentGoal,
        childId: nextChildId,
        title: nextTitle,
        goalType: nextGoalType,
        targetAmount: nextTargetAmount,
        startDate: nextStartDate,
        endDate: nextEndDate,
        reward: nextReward,
        baselineBalance: Number.isFinite(nextBaseline) ? nextBaseline : 0,
        updatedAt: nowIso(),
      };

      writeGoals(goals);
      return goals[index];
    },

    delete: async (id) => {
      const user = requireSignedInUser();
      if (user.role !== 'parent') {
        throw new Error('Only a parent can delete goals.');
      }

      const goals = readGoals();
      const exists = goals.some((g) => g.id === id && g.parentId === user.uid);
      if (!exists) {
        throw new Error('Goal not found.');
      }

      writeGoals(goals.filter((g) => !(g.id === id && g.parentId === user.uid)));
      return { success: true };
    },
  };

  return {
    auth,
    users: usersApi,
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
};

const baseDb = globalThis.__B44_DB__ || createFallbackDb();

export const db = {
  ...baseDb,
  auth: baseDb.auth,
  users: baseDb.users,
  alerts: baseDb.alerts,
  entities: baseDb.entities,
  integrations: baseDb.integrations,
};

export const base44 = db;
export default db;