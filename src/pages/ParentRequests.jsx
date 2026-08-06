import React, { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { db } from '@/api/db';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { formatCurrency } from '@/lib/finance';
import { Check, Clock, X } from 'lucide-react';

const STATUS_STYLES = {
  accepted: 'bg-emerald-100 text-emerald-700',
  declined: 'bg-rose-100 text-rose-700',
};

const STATUS_LABELS = {
  accepted: 'Accepted',
  declined: 'Declined',
};

const formatDateTime = (isoString) => {
  if (!isoString) return '';
  return new Date(isoString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

export default function ParentRequests() {
  const { refreshPendingRequestCount } = useOutletContext() || {};
  const [children, setChildren] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [resolvingId, setResolvingId] = useState(null);
  const [showHistory, setShowHistory] = useState(false);

  const loadRequests = async () => {
    const docs = await db.entities.MoneyRequest.list();
    setRequests(docs || []);
  };

  useEffect(() => {
    Promise.all([db.users.listMyChildren(), db.entities.MoneyRequest.list()])
      .then(([childDocs, requestDocs]) => {
        setChildren(childDocs || []);
        setRequests(requestDocs || []);
      })
      .finally(() => setLoading(false));
  }, []);

  const childMap = useMemo(() => new Map(children.map((child) => [child.uid, child])), [children]);

  const activeRequests = useMemo(
    () => requests.filter((request) => request.status === 'pending'),
    [requests]
  );

  const historyRequests = useMemo(() => {
    return requests
      .filter((request) => request.status !== 'pending')
      .sort((a, b) => new Date(b.resolvedAt || b.createdAt) - new Date(a.resolvedAt || a.createdAt));
  }, [requests]);

  const childName = (childId) => childMap.get(childId)?.displayName || 'Your child';

  const handleResolve = async (requestId, decision) => {
    setResolvingId(requestId);
    try {
      await db.entities.MoneyRequest.resolve(requestId, decision);
      toast({ title: decision === 'accept' ? 'Request accepted.' : 'Request declined.' });
      await loadRequests();
      await refreshPendingRequestCount?.();
    } catch (error) {
      toast({
        title: 'Could not resolve request',
        description: error.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setResolvingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-4 border-sky-200 border-t-sky-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="finn-card">
        <h1 className="text-3xl font-extrabold text-slate-800">Requests</h1>
        <p className="text-sm text-muted-foreground font-semibold mt-1">
          Review money requests from your kids and accept or decline them.
        </p>
      </div>

      <div className="space-y-3">
        <h2 className="text-xl font-extrabold text-slate-800">Active Requests</h2>
        {activeRequests.length === 0 ? (
          <div className="finn-card text-sm text-muted-foreground font-semibold text-center py-10">
            No pending requests right now.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeRequests.map((request) => (
              <div key={request.id} className="finn-card space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-extrabold text-slate-800">{childName(request.childId)}</p>
                  <span className="text-2xl font-extrabold text-slate-800">
                    {formatCurrency(request.amount)}
                  </span>
                </div>
                <p className="text-sm text-slate-700 font-semibold">{request.description}</p>
                <p className="text-xs text-muted-foreground font-semibold flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  Sent {formatDateTime(request.createdAt)}
                </p>
                <div className="flex gap-2 pt-1">
                  <Button
                    type="button"
                    className="flex-1 gap-1 bg-emerald-600 text-white hover:bg-emerald-700"
                    disabled={resolvingId === request.id}
                    onClick={() => handleResolve(request.id, 'accept')}
                  >
                    <Check className="w-4 h-4" />
                    Accept
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    className="flex-1 gap-1"
                    disabled={resolvingId === request.id}
                    onClick={() => handleResolve(request.id, 'decline')}
                  >
                    <X className="w-4 h-4" />
                    Decline
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {historyRequests.length > 0 && (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setShowHistory((prev) => !prev)}
            className="text-sm font-bold text-sky-700 hover:text-sky-800 underline underline-offset-2"
          >
            {showHistory ? 'Hide past requests' : 'See all requests'}
          </button>

          {showHistory && (
            <div className="finn-card divide-y divide-slate-100">
              {historyRequests.map((request) => (
                <div
                  key={request.id}
                  className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-800 truncate">
                      {childName(request.childId)} &mdash; {request.description}
                    </p>
                    <p className="text-xs text-muted-foreground font-semibold">
                      {formatDateTime(request.resolvedAt || request.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm font-extrabold text-slate-800">
                      {formatCurrency(request.amount)}
                    </span>
                    <span
                      className={`text-xs font-bold px-2.5 py-1 rounded-full ${STATUS_STYLES[request.status]}`}
                    >
                      {STATUS_LABELS[request.status]}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
