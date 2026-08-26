import React, { useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { db } from '@/api/db';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { formatCurrency, parseDateValue } from '@/lib/finance';
import { ArrowRight, Check, Clock, HandCoins, ListChecks, Receipt, X } from 'lucide-react';

const TYPE_ICONS = {
  money: HandCoins,
  chore_promise: ListChecks,
  refund: Receipt,
};

const TYPE_LABELS = {
  money: 'Ask for Money',
  chore_promise: 'Promise Chore',
  refund: 'Request Refund',
};

const STATUS_STYLES = {
  accepted: 'bg-emerald-100 text-emerald-700',
  declined: 'bg-rose-100 text-rose-700',
};

const STATUS_LABELS = {
  accepted: 'Accepted',
  declined: 'Declined',
};

const RECENT_WINDOW_DAYS = 7;

const formatDateTime = (isoString) => {
  if (!isoString) return '';
  return parseDateValue(isoString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const isRecent = (resolvedAt) => {
  if (!resolvedAt) return false;
  const days = (Date.now() - new Date(resolvedAt).getTime()) / (1000 * 60 * 60 * 24);
  return days <= RECENT_WINDOW_DAYS;
};

// requests.task_id is ON DELETE SET NULL, so a chore promise whose task was
// later deleted has nothing to link to. Fall back to the status pill rather
// than rendering nothing at all beside the amount.
function RequestOutcome({ request }) {
  if (request.type === 'chore_promise' && request.status === 'accepted' && request.taskId) {
    return (
      <Link
        to={`/parent/tasks?taskId=${request.taskId}`}
        className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-sky-100 text-sky-700 hover:bg-sky-200"
      >
        View in Tasks
        <ArrowRight className="w-3 h-3" />
      </Link>
    );
  }
  return (
    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${STATUS_STYLES[request.status] || 'bg-slate-100 text-slate-700'}`}>
      {STATUS_LABELS[request.status] || request.status}
    </span>
  );
}

export default function ParentRequests() {
  const { refreshPendingRequestCount } = useOutletContext() || {};
  const [children, setChildren] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [resolvingId, setResolvingId] = useState(null);
  const [showHistory, setShowHistory] = useState(false);

  const loadRequests = async () => {
    const docs = await db.entities.Request.list();
    setRequests(docs || []);
  };

  useEffect(() => {
    Promise.all([db.users.listMyChildren(), db.entities.Request.list()])
      .then(([childDocs, requestDocs]) => {
        setChildren(childDocs || []);
        setRequests(requestDocs || []);
      })
      .catch((error) => {
        setLoadError(error.message || 'Could not load requests. Please refresh and try again.');
      })
      .finally(() => setLoading(false));
  }, []);

  const childMap = useMemo(() => new Map(children.map((child) => [child.uid, child])), [children]);

  const activeRequests = useMemo(
    () => requests.filter((request) => request.status === 'pending'),
    [requests]
  );

  const recentlyClosed = useMemo(() => {
    return requests
      .filter((request) => request.status !== 'pending' && isRecent(request.resolvedAt))
      .sort((a, b) => new Date(b.resolvedAt) - new Date(a.resolvedAt));
  }, [requests]);

  const fullHistory = useMemo(() => {
    return requests
      .filter((request) => request.status !== 'pending')
      .sort((a, b) => new Date(b.resolvedAt || b.createdAt) - new Date(a.resolvedAt || a.createdAt));
  }, [requests]);

  const childName = (childId) => childMap.get(childId)?.displayName || 'Your child';

  const handleResolve = async (request, decision) => {
    setResolvingId(request.id);
    try {
      await db.entities.Request.resolve(request.id, decision);
      if (decision === 'accept' && request.type === 'chore_promise') {
        toast({ title: `Accepted — added to ${childName(request.childId)}'s task list.` });
      } else {
        toast({ title: decision === 'accept' ? 'Request accepted.' : 'Request declined.' });
      }
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

  if (loadError) {
    return (
      <div className="finn-card text-center py-10">
        <p className="text-slate-700 font-bold">Could not load requests</p>
        <p className="text-sm text-muted-foreground font-semibold mt-1">{loadError}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="finn-card">
        <h1 className="text-3xl font-extrabold text-slate-800">Requests</h1>
        <p className="text-sm text-muted-foreground font-semibold mt-1">
          Review requests from your kids and accept or decline them.
        </p>
      </div>

      <div className="space-y-3">
        <h2 className="text-xl font-extrabold text-slate-800">Active Requests ({activeRequests.length})</h2>
        {activeRequests.length === 0 ? (
          <div className="finn-card text-sm text-muted-foreground font-semibold text-center py-10">
            No pending requests right now.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeRequests.map((request) => {
              const Icon = TYPE_ICONS[request.type] || HandCoins;
              return (
                <div key={request.id} className="finn-card space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-extrabold text-slate-800">{childName(request.childId)}</p>
                    <span className="text-2xl font-extrabold text-slate-800">
                      {formatCurrency(request.amount)}
                    </span>
                  </div>
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500">
                    <Icon className="w-3.5 h-3.5" />
                    {TYPE_LABELS[request.type] || TYPE_LABELS.money}
                  </span>
                  <p className="text-sm text-slate-700 font-semibold">{request.description}</p>
                  {(request.proofText || request.proofPhotoUrl) && (
                    <div className="rounded-2xl bg-slate-50 p-3 space-y-2">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">Receipt</p>
                      {request.proofText && <p className="text-sm text-slate-700 font-semibold">{request.proofText}</p>}
                      {request.proofPhotoUrl && (
                        <img
                          src={request.proofPhotoUrl}
                          alt="Receipt"
                          className="max-h-40 rounded-xl border border-slate-200"
                        />
                      )}
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground font-semibold">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      Sent {formatDateTime(request.createdAt)}
                    </span>
                    {request.dueDate && <span>Needed by {formatDateTime(request.dueDate)}</span>}
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button
                      type="button"
                      className="flex-1 gap-1 bg-emerald-600 text-white hover:bg-emerald-700"
                      disabled={resolvingId === request.id}
                      onClick={() => handleResolve(request, 'accept')}
                    >
                      <Check className="w-4 h-4" />
                      Accept
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      className="flex-1 gap-1"
                      disabled={resolvingId === request.id}
                      onClick={() => handleResolve(request, 'decline')}
                    >
                      <X className="w-4 h-4" />
                      Decline
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {recentlyClosed.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xl font-extrabold text-slate-800">Past / Closed Requests ({recentlyClosed.length})</h2>
          <div className="finn-card divide-y divide-slate-100">
            {recentlyClosed.map((request) => (
              <div key={request.id} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-800 truncate">
                    {childName(request.childId)} &mdash; {request.description}
                  </p>
                  <p className="text-xs text-muted-foreground font-semibold">
                    {TYPE_LABELS[request.type] || TYPE_LABELS.money} &middot; {formatDateTime(request.resolvedAt)}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-sm font-extrabold text-slate-800">{formatCurrency(request.amount)}</span>
                  <RequestOutcome request={request} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {fullHistory.length > 0 && (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setShowHistory((prev) => !prev)}
            className="text-sm font-bold text-sky-700 hover:text-sky-800 underline underline-offset-2"
          >
            {showHistory ? 'Hide all requests' : 'See all requests'}
          </button>

          {showHistory && (
            <div className="finn-card divide-y divide-slate-100">
              {fullHistory.map((request) => (
                <div
                  key={request.id}
                  className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-800 truncate">
                      {childName(request.childId)} &mdash; {request.description}
                    </p>
                    <p className="text-xs text-muted-foreground font-semibold">
                      {TYPE_LABELS[request.type] || TYPE_LABELS.money} &middot;{' '}
                      {formatDateTime(request.resolvedAt || request.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm font-extrabold text-slate-800">
                      {formatCurrency(request.amount)}
                    </span>
                    <RequestOutcome request={request} />
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
