import React, { useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { db } from '@/api/db';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';
import { formatCurrency, parseDateValue } from '@/lib/finance';
import { compressImageFile, MAX_PHOTO_DATA_URL_LENGTH } from '@/lib/image';
import { HandCoins, ListChecks, Receipt, Clock, Camera, X, ArrowRight } from 'lucide-react';

const REQUEST_TYPES = [
  {
    value: 'money',
    label: 'Ask for Money',
    hint: '(Direct request)',
    icon: HandCoins,
    descriptionLabel: "What's it for?",
    descriptionPlaceholder: 'New soccer cleats for practice',
    hasDueDate: true,
    hasProof: false,
  },
  {
    value: 'chore_promise',
    label: 'Promise Chore',
    hint: '(Do a service/task)',
    icon: ListChecks,
    descriptionLabel: 'What will you do?',
    descriptionPlaceholder: 'Clean the garage this weekend',
    hasDueDate: true,
    hasProof: false,
  },
  {
    value: 'refund',
    label: 'Request Refund',
    hint: '(Get paid back)',
    icon: Receipt,
    descriptionLabel: 'What did you buy?',
    descriptionPlaceholder: 'Movie tickets for the class trip',
    hasDueDate: false,
    hasProof: true,
  },
];

const RECENT_WINDOW_DAYS = 7;

const emptyForm = { type: 'money', description: '', amount: '', dueDate: '', proofText: '', proofPhotoUrl: '' };

const STATUS_STYLES = {
  pending: 'bg-sky-100 text-sky-700',
  accepted: 'bg-emerald-100 text-emerald-700',
  declined: 'bg-rose-100 text-rose-700',
};

const STATUS_LABELS = {
  pending: 'Waiting for your parent',
  accepted: 'Accepted',
  declined: 'Declined',
};

const formatDateTime = (isoString) => {
  if (!isoString) return '';
  return parseDateValue(isoString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const typeConfig = (type) => REQUEST_TYPES.find((option) => option.value === type) || REQUEST_TYPES[0];

const isRecent = (resolvedAt) => {
  if (!resolvedAt) return false;
  const days = (Date.now() - new Date(resolvedAt).getTime()) / (1000 * 60 * 60 * 24);
  return days <= RECENT_WINDOW_DAYS;
};

// requests.task_id is ON DELETE SET NULL, so a chore promise whose task the
// parent later deleted has no task to link to. Falling back to the status pill
// keeps the row readable — returning null left an accepted request showing an
// amount and nothing else, with no indication it had been accepted at all.
function RequestOutcome({ request }) {
  if (request.type === 'chore_promise' && request.status === 'accepted' && request.taskId) {
    return (
      <Link
        to={`/tasks?taskId=${request.taskId}`}
        className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-sky-100 text-sky-700 hover:bg-sky-200"
      >
        View in Tasks
        <ArrowRight className="w-3 h-3" />
      </Link>
    );
  }
  return (
    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${STATUS_STYLES[request.status] || STATUS_STYLES.pending}`}>
      {STATUS_LABELS[request.status] || request.status}
    </span>
  );
}

export default function Requests() {
  const { profile } = useAuth();
  const { refreshPendingRequestCount } = useOutletContext() || {};
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [showHistory, setShowHistory] = useState(false);

  const loadRequests = async () => {
    const docs = await db.entities.Request.list();
    setRequests(docs || []);
  };

  useEffect(() => {
    loadRequests()
      .catch((error) => {
        setLoadError(error.message || 'Could not load your requests. Please refresh and try again.');
      })
      .finally(() => setLoading(false));
  }, []);

  const activeType = typeConfig(form.type);
  const receiptRequired = activeType.value === 'refund' && Boolean(profile?.requireRefundReceipt);

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

  const handleInputChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSelectType = (type) => {
    setForm((prev) => ({ ...emptyForm, type }));
  };

  const handlePhotoChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Please choose an image file.', variant: 'destructive' });
      return;
    }
    try {
      const dataUrl = await compressImageFile(file);
      if (dataUrl.length > MAX_PHOTO_DATA_URL_LENGTH) {
        toast({ title: 'That photo is too large. Try a smaller one.', variant: 'destructive' });
        return;
      }
      handleInputChange('proofPhotoUrl', dataUrl);
    } catch (error) {
      toast({ title: 'Could not add that photo', description: error.message, variant: 'destructive' });
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (saving) return;
    if (receiptRequired && !form.proofPhotoUrl) {
      toast({
        title: 'Photo required',
        description: 'Your parent requires a receipt photo for refund requests.',
        variant: 'destructive',
      });
      return;
    }
    setSaving(true);
    try {
      await db.entities.Request.create({
        type: form.type,
        description: form.description.trim(),
        amount: Number(form.amount),
        dueDate: activeType.hasDueDate && form.dueDate ? form.dueDate : null,
        proofText: form.proofText.trim(),
        proofPhotoUrl: form.proofPhotoUrl,
      });
      toast({ title: 'Request sent to your parent.' });
      setForm((prev) => ({ ...emptyForm, type: prev.type }));
      await loadRequests();
      await refreshPendingRequestCount?.();
    } catch (error) {
      toast({
        title: 'Could not send request',
        description: error.message || 'Please check your entries and try again.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
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
        <p className="text-slate-700 font-bold">Could not load your requests</p>
        <p className="text-sm text-muted-foreground font-semibold mt-1">{loadError}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="finn-card">
        <h1 className="text-2xl font-extrabold text-slate-800">New Request</h1>
        <p className="text-sm text-muted-foreground font-semibold mt-1">
          Choose a request type and tell your parent the details.
        </p>

        <div className="mt-6 space-y-2">
          <Label>Select Request Type</Label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {REQUEST_TYPES.map((option) => {
              const Icon = option.icon;
              const selected = form.type === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleSelectType(option.value)}
                  className={`rounded-2xl border-2 px-4 py-3 text-left transition-colors ${
                    selected
                      ? 'border-sky-500 bg-sky-50'
                      : 'border-slate-200 bg-white hover:border-sky-200'
                  }`}
                >
                  <Icon className={`w-5 h-5 mb-1 ${selected ? 'text-sky-600' : 'text-slate-400'}`} />
                  <p className="font-extrabold text-sm text-slate-800">{option.label}</p>
                  <p className="text-xs text-muted-foreground font-semibold">{option.hint}</p>
                </button>
              );
            })}
          </div>
        </div>

        <form className="space-y-4 mt-6 pt-4 border-t border-slate-100" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="request-description">{activeType.descriptionLabel}</Label>
            <Textarea
              id="request-description"
              value={form.description}
              onChange={(event) => handleInputChange('description', event.target.value)}
              placeholder={activeType.descriptionPlaceholder}
              rows={3}
              required
            />
          </div>

          <div className={`grid gap-4 ${activeType.hasDueDate ? 'grid-cols-2' : 'grid-cols-1'}`}>
            <div className="space-y-2">
              <Label htmlFor="request-amount">Amount ($)</Label>
              <Input
                id="request-amount"
                type="number"
                min="0.01"
                step="0.01"
                value={form.amount}
                onChange={(event) => handleInputChange('amount', event.target.value)}
                placeholder="20"
                required
              />
            </div>

            {activeType.hasDueDate && (
              <div className="space-y-2">
                <Label htmlFor="request-due-date">Needed by</Label>
                <Input
                  id="request-due-date"
                  type="date"
                  value={form.dueDate}
                  onChange={(event) => handleInputChange('dueDate', event.target.value)}
                />
              </div>
            )}
          </div>

          {activeType.hasProof && (
            <div className="space-y-3 rounded-2xl bg-slate-50 p-3">
              <div className="space-y-2">
                <Label htmlFor="request-proof-text">Notes (optional)</Label>
                <Textarea
                  id="request-proof-text"
                  value={form.proofText}
                  onChange={(event) => handleInputChange('proofText', event.target.value)}
                  placeholder="Any extra details about the purchase..."
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label>
                  Receipt photo {receiptRequired ? '(required)' : '(optional)'}
                </Label>
                {form.proofPhotoUrl ? (
                  <div className="relative inline-block">
                    <img
                      src={form.proofPhotoUrl}
                      alt="Receipt preview"
                      className="h-24 rounded-xl border border-slate-200"
                    />
                    <button
                      type="button"
                      onClick={() => handleInputChange('proofPhotoUrl', '')}
                      className="absolute -top-2 -right-2 bg-slate-800 text-white rounded-full p-1"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <label className="flex items-center gap-2 text-sm font-semibold text-sky-700 cursor-pointer">
                    <Camera className="w-4 h-4" />
                    Add a photo
                    <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                  </label>
                )}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button type="submit" className="flex-1" disabled={saving}>
              {saving ? 'Sending...' : 'Send Request to Parent'}
            </Button>
            <Button type="button" variant="outline" onClick={() => setForm(emptyForm)}>
              Cancel
            </Button>
          </div>
        </form>
      </div>

      <div className="space-y-3">
        <h2 className="text-xl font-extrabold text-slate-800">Active Requests ({activeRequests.length})</h2>
        {activeRequests.length === 0 ? (
          <div className="finn-card text-sm text-muted-foreground font-semibold text-center py-10">
            No active requests. Send one above.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeRequests.map((request) => {
              const Icon = typeConfig(request.type).icon;
              return (
                <div key={request.id} className="finn-card space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500">
                      <Icon className="w-3.5 h-3.5" />
                      {typeConfig(request.type).label}
                    </span>
                    <span className="text-2xl font-extrabold text-slate-800">
                      {formatCurrency(request.amount)}
                    </span>
                  </div>
                  <p className="text-sm text-slate-700 font-semibold">{request.description}</p>
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${STATUS_STYLES.pending}`}>
                      {STATUS_LABELS.pending}
                    </span>
                    {request.dueDate && (
                      <span className="text-xs text-muted-foreground font-semibold">
                        Needed by {formatDateTime(request.dueDate)}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground font-semibold flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    Sent {formatDateTime(request.createdAt)}
                  </p>
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
                  <p className="text-sm font-bold text-slate-800 truncate">{request.description}</p>
                  <p className="text-xs text-muted-foreground font-semibold">
                    {typeConfig(request.type).label} &middot; {formatDateTime(request.resolvedAt)}
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
                    <p className="text-sm font-bold text-slate-800 truncate">{request.description}</p>
                    <p className="text-xs text-muted-foreground font-semibold">
                      {typeConfig(request.type).label} &middot;{' '}
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
