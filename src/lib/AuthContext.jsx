import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';

import { db, supabase } from '@/api/db';

const AuthContext = createContext();

const clearAuthState = (setters) => {
  setters.setUser(null);
  setters.setProfile(null);
  setters.setRole(null);
  setters.setIsAuthenticated(false);
  setters.setBaseSubscriptionStatus(null);
  setters.setBaseSubscriptionPeriodEnd(null);
  setters.setAddonSubscriptionStatus(null);
  setters.setAddonSubscriptionPeriodEnd(null);
  setters.setChildCount(null);
  setters.setSubscriptionError(null);
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [role, setRole] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [appPublicSettings, setAppPublicSettings] = useState(null);
  const [baseSubscriptionStatus, setBaseSubscriptionStatus] = useState(null);
  const [baseSubscriptionPeriodEnd, setBaseSubscriptionPeriodEnd] = useState(null);
  const [addonSubscriptionStatus, setAddonSubscriptionStatus] = useState(null);
  const [addonSubscriptionPeriodEnd, setAddonSubscriptionPeriodEnd] = useState(null);
  const [childCount, setChildCount] = useState(null);
  const [subscriptionError, setSubscriptionError] = useState(null);

  const loadSubscriptionStatus = async () => {
    try {
      const { baseStatus, baseCurrentPeriodEnd, addonStatus, addonCurrentPeriodEnd, childCount: count } =
        await db.billing.getStatus();
      setBaseSubscriptionStatus(baseStatus);
      setBaseSubscriptionPeriodEnd(baseCurrentPeriodEnd);
      setAddonSubscriptionStatus(addonStatus);
      setAddonSubscriptionPeriodEnd(addonCurrentPeriodEnd);
      setChildCount(count);
      setSubscriptionError(null);
    } catch (error) {
      // Deliberately does NOT null the statuses. A transient failure (network
      // blip, RPC timeout) is "we don't know", not "you aren't subscribed" --
      // nulling here is what previously dropped a paying family onto the
      // Subscribe screen. Keep the last known values and record the error so
      // SubscriptionGate can offer a retry instead of asking them to pay again.
      setSubscriptionError(error?.message || 'Could not check your subscription status.');
    }
  };

  const checkUserAuth = useCallback(async () => {
    try {
      setIsLoadingAuth(true);
      setAuthError(null);
      const currentUser = await db.auth.me();

      if (!currentUser) {
        clearAuthState({ setUser, setProfile, setRole, setIsAuthenticated, setBaseSubscriptionStatus, setBaseSubscriptionPeriodEnd, setAddonSubscriptionStatus, setAddonSubscriptionPeriodEnd, setChildCount, setSubscriptionError });
        setAuthChecked(true);
        setIsLoadingAuth(false);
        return null;
      }

      const userProfile = await db.users.getMyProfile();
      setUser(currentUser);
      setProfile(userProfile);
      setRole(userProfile.role);
      setIsAuthenticated(true);
      // Subscription status must resolve BEFORE authChecked flips, or
      // SubscriptionGate (which gates on authChecked) renders the "Subscription
      // required" lockout against a still-null status for a frame or more --
      // on every single page load, for paying families included.
      await loadSubscriptionStatus();
      setAuthChecked(true);
      setIsLoadingAuth(false);
      return userProfile;
    } catch (error) {
      clearAuthState({ setUser, setProfile, setRole, setIsAuthenticated, setBaseSubscriptionStatus, setBaseSubscriptionPeriodEnd, setAddonSubscriptionStatus, setAddonSubscriptionPeriodEnd, setChildCount, setSubscriptionError });
      setAuthError({ type: 'auth_required', message: error.message || 'Authentication required.' });
      setAuthChecked(true);
      setIsLoadingAuth(false);
      return null;
    }
  }, []);

  useEffect(() => {
    checkUserAuth();
  }, [checkUserAuth]);

  // Passive cross-tab sync only: logging in/out in another tab (or a token
  // refresh) re-runs checkUserAuth here. Action functions below still set
  // state synchronously themselves so Login.jsx can navigate immediately
  // after they resolve, without waiting on this listener to fire.
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      checkUserAuth();
    });
    return () => subscription.unsubscribe();
  }, [checkUserAuth]);

  const login = async (email, password, expectedRole) => {
    try {
      setAuthError(null);

      await db.auth.loginViaEmailPassword(email, password);
      const userProfile = await db.users.getMyProfile();

      if (expectedRole && userProfile.role !== expectedRole) {
        await db.auth.logout();
        throw new Error(
          expectedRole === 'child'
            ? 'That account is a parent account. Please use Parent Login.'
            : 'That account is a child account. Please use Kid Login.'
        );
      }

      const currentUser = await db.auth.me();
      setUser(currentUser);
      setProfile(userProfile);
      setRole(userProfile.role);
      setIsAuthenticated(true);
      await loadSubscriptionStatus();
      setAuthChecked(true);

      return { success: true, role: userProfile.role };
    } catch (error) {
      clearAuthState({ setUser, setProfile, setRole, setIsAuthenticated, setBaseSubscriptionStatus, setBaseSubscriptionPeriodEnd, setAddonSubscriptionStatus, setAddonSubscriptionPeriodEnd, setChildCount, setSubscriptionError });
      setAuthChecked(true);
      throw error;
    }
  };

  const loginChild = async (username, password) => {
    const syntheticEmail = db.auth.childEmailFromUsername(username);
    return login(syntheticEmail, password, 'child');
  };

  const loginParent = async (email, password) => {
    return login(email, password, 'parent');
  };

  const signupParent = async (email, password, displayName = '') => {
    setAuthError(null);
    return db.auth.registerParent({ email, password, displayName });
  };

  const verifyParentSignup = async (email, otpCode) => {
    setAuthError(null);
    try {
      await db.auth.verifyOtp({ email, otpCode });
      const currentUser = await db.auth.me();
      const userProfile = await db.users.getMyProfile();
      setUser(currentUser);
      setProfile(userProfile);
      setRole(userProfile.role);
      setIsAuthenticated(true);
      await loadSubscriptionStatus();
      setAuthChecked(true);
      return { success: true };
    } catch (error) {
      clearAuthState({ setUser, setProfile, setRole, setIsAuthenticated, setBaseSubscriptionStatus, setBaseSubscriptionPeriodEnd, setAddonSubscriptionStatus, setAddonSubscriptionPeriodEnd, setChildCount, setSubscriptionError });
      setAuthChecked(true);
      throw error;
    }
  };

  const resendParentOtp = async (email) => {
    setAuthError(null);
    return db.auth.resendOtp(email);
  };

  const refreshProfile = async () => {
    if (!isAuthenticated) return null;
    const userProfile = await db.users.getMyProfile();
    setProfile(userProfile);
    setRole(userProfile.role);
    return userProfile;
  };

  const logout = async (shouldRedirect = true) => {
    await db.auth.logout();
    clearAuthState({ setUser, setProfile, setRole, setIsAuthenticated, setBaseSubscriptionStatus, setBaseSubscriptionPeriodEnd, setAddonSubscriptionStatus, setAddonSubscriptionPeriodEnd, setChildCount, setSubscriptionError });
    setAuthChecked(true);

    if (shouldRedirect && typeof window !== 'undefined') {
      window.location.assign('/login');
    }
  };

  const navigateToLogin = () => {
    if (typeof window !== 'undefined') {
      window.location.assign('/login');
    }
  };

  const checkAppState = async () => checkUserAuth();

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        role,
        isAuthenticated,
        isLoadingAuth,
        isLoadingPublicSettings,
        authError,
        appPublicSettings,
        setAppPublicSettings,
        authChecked,
        login,
        loginChild,
        loginParent,
        signupParent,
        verifyParentSignup,
        resendParentOtp,
        logout,
        navigateToLogin,
        checkUserAuth,
        checkAppState,
        refreshProfile,
        baseSubscriptionStatus,
        baseSubscriptionPeriodEnd,
        addonSubscriptionStatus,
        addonSubscriptionPeriodEnd,
        childCount,
        subscriptionError,
        // The base plan is always required to use the app at all. A family's
        // first child is included free; only a 2nd+ child additionally
        // requires an active addon subscription for the whole family to keep working.
        hasActiveAccess:
          baseSubscriptionStatus === 'active' &&
          ((childCount ?? 0) <= 1 || addonSubscriptionStatus === 'active'),
        refreshSubscription: loadSubscriptionStatus,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
