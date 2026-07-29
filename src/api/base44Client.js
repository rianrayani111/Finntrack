const storage = typeof window !== 'undefined' ? window.localStorage : null;
const TRANSACTIONS_KEY = 'finntrack_transactions';
const AUTH_KEY = 'finntrack_auth';

const createId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const createOtpCode = () => `${Math.floor(100000 + Math.random() * 900000)}`;

const readTransactions = () => {
  if (!storage) return [];
  try {
    const raw = storage.getItem(TRANSACTIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const writeTransactions = (transactions) => {
  if (!storage) return;
  storage.setItem(TRANSACTIONS_KEY, JSON.stringify(transactions));
};

const readAuth = () => {
  if (!storage) return null;
  try {
    const raw = storage.getItem(AUTH_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const writeAuth = (auth) => {
  if (!storage) return;
  storage.setItem(AUTH_KEY, JSON.stringify(auth));
};

const USERS_KEY = 'finntrack_registered_users';

const readRegisteredUsers = () => {
  if (!storage) return [];
  try {
    const raw = storage.getItem(USERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const writeRegisteredUsers = (users) => {
  if (!storage) return;
  storage.setItem(USERS_KEY, JSON.stringify(users));
};

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

const findUserByEmail = (users, email) => users.find((user) => user.email === email);

const createFallbackDb = () => {
  const entityStore = {
    Transaction: {
      list: async () => readTransactions(),
      get: async (id) => readTransactions().find((item) => item.id === id) || null,
      create: async (payload) => {
        const transactions = readTransactions();
        const record = { id: createId(), ...payload };
        transactions.push(record);
        writeTransactions(transactions);
        return record;
      },
      update: async (id, payload) => {
        const transactions = readTransactions();
        const index = transactions.findIndex((item) => item.id === id);
        if (index === -1) {
          throw new Error('Transaction not found');
        }
        transactions[index] = { ...transactions[index], ...payload, id };
        writeTransactions(transactions);
        return transactions[index];
      },
      delete: async (id) => {
        const transactions = readTransactions().filter((item) => item.id !== id);
        writeTransactions(transactions);
        return { success: true };
      }
    }
  };

  const auth = {
    isAuthenticated: async () => {
      const authState = readAuth();
      return Boolean(authState?.token) && !authState?.pendingOtp;
    },
    me: async () => {
      const authState = readAuth();
      if (!authState?.token || authState?.pendingOtp) {
        return null;
      }
      return authState?.user || null;
    },
    setToken: async (token) => {
      const existing = readAuth() || { user: null };
      existing.token = token;
      writeAuth(existing);
      return existing;
    },
    loginViaEmailPassword: async (email, password) => {
      const normalizedEmail = normalizeEmail(email);
      const users = readRegisteredUsers();
      const registeredUser = findUserByEmail(users, normalizedEmail);

      if (!registeredUser) {
        throw new Error('Incorrect email or password.');
      }

      if (String(password) !== String(registeredUser.password)) {
        throw new Error('Incorrect email or password.');
      }

      if (registeredUser.verified === false) {
        throw new Error('Please verify your email before logging in.');
      }

      const user = {
        id: registeredUser.id,
        email: normalizedEmail,
        username: registeredUser.username || normalizedEmail.split('@')[0],
        data: {}
      };
      const authState = { token: `local-${createId()}`, user };
      writeAuth(authState);
      return { access_token: authState.token, user };
    },
    register: async (payload) => {
      const normalizedEmail = normalizeEmail(payload?.email || '');
      const users = readRegisteredUsers();
      const alreadyExists = users.some((user) => user.email === normalizedEmail);

      if (!normalizedEmail || !String(payload?.password || '').trim()) {
        throw new Error('Email and password are required.');
      }

      if (alreadyExists) {
        throw new Error('An account with this email already exists.');
      }

      const userRecord = {
        id: createId(),
        email: normalizedEmail,
        username: normalizedEmail.split('@')[0] || 'user',
        password: String(payload?.password ?? ''),
        verified: false,
        createdAt: Date.now()
      };

      users.push(userRecord);
      writeRegisteredUsers(users);

      const user = {
        id: userRecord.id,
        email: normalizedEmail,
        username: userRecord.username,
        data: {}
      };
      const authState = { token: null, user, pendingOtp: createOtpCode(), pendingEmail: normalizedEmail };
      writeAuth(authState);
      return { user, otpCode: authState.pendingOtp };
    },
    verifyOtp: async (payload = {}) => {
      const authState = readAuth() || { user: null };
      const enteredCode = String(payload?.otpCode ?? payload?.code ?? '').trim();
      const expectedCode = authState.pendingOtp;
      const normalizedEmail = normalizeEmail(payload?.email || authState?.pendingEmail || authState?.user?.email || '');

      if (!expectedCode) {
        throw new Error('No verification code is pending. Please register or resend a code.');
      }

      if (!enteredCode) {
        throw new Error('Please enter the verification code.');
      }
      if (!/^\d{6}$/.test(enteredCode)) {
        throw new Error('Please enter the 6-digit verification code.');
      }
      if (enteredCode !== expectedCode) {
        throw new Error('Invalid verification code.');
      }

      const users = readRegisteredUsers();
      const userIndex = users.findIndex((user) => user.email === normalizedEmail);
      if (userIndex >= 0) {
        users[userIndex] = { ...users[userIndex], verified: true };
        writeRegisteredUsers(users);
      }

      authState.token = authState.token || `local-${createId()}`;
      delete authState.pendingOtp;
      delete authState.pendingEmail;
      writeAuth(authState);
      return { access_token: authState.token };
    },
    updateMe: async (profile) => {
      const authState = readAuth() || { user: null };
      authState.user = { ...(authState.user || {}), ...(profile || {}) };
      writeAuth(authState);
      return authState.user;
    },
    resendOtp: async (email) => {
      const authState = readAuth() || { user: null };
      const normalizedEmail = normalizeEmail(email || authState?.pendingEmail || authState?.user?.email || '');
      if (!normalizedEmail) {
        throw new Error('Email is required to resend verification code.');
      }

      authState.pendingEmail = normalizedEmail;
      authState.pendingOtp = createOtpCode();
      writeAuth(authState);
      return { success: true, otpCode: authState.pendingOtp };
    },
    resetPasswordRequest: async () => ({ success: true }),
    resetPassword: async () => ({ success: true }),
    logout: async () => {
      writeAuth(null);
      return { success: true };
    },
    redirectToLogin: async () => {
      if (typeof window !== 'undefined') {
        window.location.assign('/login');
      }
      return { success: true };
    }
  };

  return {
    auth,
    entities: entityStore,
    integrations: {
      Core: {
        UploadFile: async () => ({ file_url: '' })
      }
    }
  };
};

const baseDb = globalThis.__B44_DB__ || createFallbackDb();

const wrapAuth = (auth) => {
  if (!auth) {
    return auth;
  }

  return auth;
};

export const db = {
  ...baseDb,
  auth: wrapAuth(baseDb.auth),
  entities: baseDb.entities,
  integrations: baseDb.integrations
};
export const base44 = db;
export default db;