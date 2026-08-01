import React from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import SubscriptionRequired from '@/pages/SubscriptionRequired';

const GateLoading = () => (
  <div className="fixed inset-0 flex items-center justify-center">
    <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
  </div>
);

// Locks the entire app (parent AND every child) behind a subscription
// screen whenever the parent's subscription isn't active — whether they've
// never subscribed yet, or a past subscription lapsed (past_due/canceled).
export default function SubscriptionGate() {
  const { authChecked, hasActiveAccess } = useAuth();

  // authChecked is a one-way latch; isLoadingAuth alone can flip true again for
  // background re-checks (tab refocus, token refresh) and would otherwise
  // unmount the Subscribe screen (and its selected plan) every time that happens.
  if (!authChecked) {
    return <GateLoading />;
  }

  if (!hasActiveAccess) {
    return <SubscriptionRequired />;
  }

  return <Outlet />;
}
