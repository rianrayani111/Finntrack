import React, { useEffect, useMemo, useState } from 'react';
import { db } from '@/api/db';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';
import { formatCurrency } from '@/lib/finance';
import { HandCoins, Clock } from 'lucide-react';

const emptyForm = { description: '', amount: '' };

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
  return new Date(isoString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

export default function Requests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [showHistory, setShowHistory] = useState(false);

  const loadRequests = async () => {
    const docs = await db.entities.MoneyRequest.list();
    setRequests(docs || []);
  };

  useEffect(() => {
    loadRequests().finally(() => setLoading(false));
  }, []);

  const activeRequests = useMemo(
    () => requests.filter((request) => request.status === 'pending'),
    [requests]
  );

  const historyRequests = useMemo(() => {
    return requests
      .filter((request) => request.status !== 'pending')
      .sort((a, b) => new Date(b.resolvedAt || b.createdAt) - new Date(a.resolvedAt || a.createdAt));
  }, [requests]);

  const handleInputChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await db.entities.MoneyRequest.create({
        description: form.description.trim(),
        amount: Number(form.amount),
      });
      toast({ title: 'Request sent to your parent.' });
      setForm(emptyForm);
      await loadRequests();
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

  return (
    <div className="space-y-6">
      <div className="finn-card">
        <h1 className="text-2xl font-extrabold text-slate-800 flex items-center gap-2">
          <HandCoins className="w-6 h-6 text-sky-600" />
          Ask for Money
        </h1>
        <p className="text-sm text-muted-foreground font-semibold mt-1">
          Tell your parent what you need and how much it costs.
        </p>

        <form className="space-y-4 mt-6" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="request-description">What's it for?</Label>
            <Textarea
              id="request-description"
              value={form.description}
              onChange={(event) => handleInputChange('description', event.target.value)}
              placeholder="New soccer cleats for practice"
              rows={3}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="request-amount">Amount</Label>
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

          <Button type="submit" className="w-full" disabled={saving}>
            {saving ? 'Sending...' : 'Send Request'}
          </Button>
        </form>
      </div>

      <div className="space-y-3">
        <h2 className="text-xl font-extrabold text-slate-800">Active Requests</h2>
        {activeRequests.length === 0 ? (
          <div className="finn-card text-sm text-muted-foreground font-semibold text-center py-10">
            No active requests. Send one above.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeRequests.map((request) => (
              <div key={request.id} className="finn-card space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-2xl font-extrabold text-slate-800">
                    {formatCurrency(request.amount)}
                  </span>
                  <span
                    className={`text-xs font-bold px-2.5 py-1 rounded-full ${STATUS_STYLES.pending}`}
                  >
                    {STATUS_LABELS.pending}
                  </span>
                </div>
                <p className="text-sm text-slate-700 font-semibold">{request.description}</p>
                <p className="text-xs text-muted-foreground font-semibold flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  Sent {formatDateTime(request.createdAt)}
                </p>
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
                    <p className="text-sm font-bold text-slate-800 truncate">{request.description}</p>
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
