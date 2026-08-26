import React from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import SubscriptionRequired from '@/pages/SubscriptionRequired';
import { Button } from '@/components/ui/button';

const GateLoading = () => (
  <div className="fixed inset-0 flex items-center justify-center">
    <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
  </div>
);

const SubscriptionUnavailable = ({ message, onRetry }) => {
  const [retrying, setRetrying] = React.useState(false);

  const handleRetry = async () => {
    setRetrying(true);
    try {
      await onRetry?.();
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center p-6">
      <div className="finn-card max-w-md text-center space-y-3">
        <h1 className="text-xl font-extrabold text-slate-800">Couldn&apos;t check your subscription</h1>
        <p className="text-sm text-muted-foreground font-semibold">
          This is usually a temporary connection problem. Your subscription has not been changed.
        </p>
        {message && <p className="text-xs text-slate-500 font-semibold">{message}</p>}
        <Button className="w-full" onClick={handleRetry} disabled={retrying}>
          {retrying ? 'Checking...' : 'Try again'}
        </Button>
      </div>
    </div>
  );
};

// Locks the entire app (parent AND every child) behind a subscription
// screen whenever the parent's subscription isn't active — whether they've
// never subscribed yet, or a past subscription lapsed (past_due/canceled).
export default function SubscriptionGate() {
  const { authChecked, hasActiveAccess, subscriptionError, refreshSubscription } = useAuth();

  // authChecked is a one-way latch; isLoadingAuth alone can flip true again for
  // background re-checks (tab refocus, token refresh) and would otherwise
  // unmount the Subscribe screen (and its selected plan) every time that happens.
  if (!authChecked) {
    return <GateLoading />;
  }

  // If the status check itself failed we don't know whether they're subscribed,
  // so offer a retry. Showing SubscriptionRequired here would ask a paying
  // family to pay a second time over what may be a momentary network blip.
  if (subscriptionError && !hasActiveAccess) {
    return <SubscriptionUnavailable message={subscriptionError} onRetry={refreshSubscription} />;
  }

  if (!hasActiveAccess) {
    return <SubscriptionRequired />;
  }

  return <Outlet />;
}
