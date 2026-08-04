import React from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import SubscriptionRequired from '@/pages/SubscriptionRequired';

const GateLoading = () => (
  <div className="fixed inset-0 flex items-center justify-center">
    <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
  </div>
);

// A parent's first child is free, so the whole-app SubscriptionGate lets a
// 1-child family through. Adding a 2nd+ child is where payment actually
// kicks in, so that specific action needs its own, narrower gate.
export default function AdditionalChildGate() {
  const { authChecked, childCount, subscriptionStatus } = useAuth();

  if (!authChecked) {
    return <GateLoading />;
  }

  const needsSubscription = (childCount ?? 0) >= 1 && subscriptionStatus !== 'active';
  if (needsSubscription) {
    return <SubscriptionRequired />;
  }

  return <Outlet />;
}
