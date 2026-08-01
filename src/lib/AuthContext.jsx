import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';

import { db, supabase } from '@/api/db';

const AuthContext = createContext();

const clearAuthState = (setters) => {
  setters.setUser(null);
  setters.setProfile(null);
  setters.setRole(null);
  setters.setIsAuthenticated(false);
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

  const checkUserAuth = useCallback(async () => {
    try {
      setIsLoadingAuth(true);
      setAuthError(null);
      const currentUser = await db.auth.me();

      if (!currentUser) {
        clearAuthState({ setUser, setProfile, setRole, setIsAuthenticated });
        setAuthChecked(true);
        setIsLoadingAuth(false);
        return null;
      }

      const userProfile = await db.users.getMyProfile();
      setUser(currentUser);
      setProfile(userProfile);
      setRole(userProfile.role);
      setIsAuthenticated(true);
      setAuthChecked(true);
      setIsLoadingAuth(false);
      return userProfile;
    } catch (error) {
      clearAuthState({ setUser, setProfile, setRole, setIsAuthenticated });
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
      setIsLoadingAuth(true);
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
      setAuthChecked(true);
      setIsLoadingAuth(false);

      return { success: true, role: userProfile.role };
    } catch (error) {
      clearAuthState({ setUser, setProfile, setRole, setIsAuthenticated });
      setAuthChecked(true);
      setIsLoadingAuth(false);
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
    setIsLoadingAuth(true);
    setAuthError(null);
    try {
      await db.auth.verifyOtp({ email, otpCode });
      const currentUser = await db.auth.me();
      const userProfile = await db.users.getMyProfile();
      setUser(currentUser);
      setProfile(userProfile);
      setRole(userProfile.role);
      setIsAuthenticated(true);
      setAuthChecked(true);
      setIsLoadingAuth(false);
      return { success: true };
    } catch (error) {
      clearAuthState({ setUser, setProfile, setRole, setIsAuthenticated });
      setAuthChecked(true);
      setIsLoadingAuth(false);
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
    clearAuthState({ setUser, setProfile, setRole, setIsAuthenticated });
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
