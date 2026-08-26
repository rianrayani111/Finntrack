import React, { useEffect, useMemo, useState } from 'react';
import { db } from '@/api/db';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/finance';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { toast } from '@/components/ui/use-toast';

export default function ParentAlerts() {
  const navigate = useNavigate();
  const { refreshUnreadAlertCount } = useOutletContext() || {};
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadAlerts = async () => {
    const docs = await db.alerts.list();
    setAlerts(docs || []);
  };

  useEffect(() => {
    loadAlerts().finally(() => setLoading(false));
  }, []);

  const unreadCount = useMemo(() => alerts.filter((alert) => !alert.read).length, [alerts]);

  const markRead = async (alertId) => {
    try {
      await db.alerts.markRead(alertId);
      await loadAlerts();
      await refreshUnreadAlertCount?.();
    } catch (error) {
      toast({ title: 'Could not mark as read', description: error.message, variant: 'destructive' });
    }
  };

  const markAllRead = async () => {
    try {
      await db.alerts.markAllRead();
      await loadAlerts();
      await refreshUnreadAlertCount?.();
    } catch (error) {
      toast({ title: 'Could not mark all as read', description: error.message, variant: 'destructive' });
    }
  };

  const handleEditFromAlert = async (alert) => {
    if (!alert.read) {
      try {
        await db.alerts.markRead(alert.id);
        await loadAlerts();
        await refreshUnreadAlertCount?.();
      } catch (error) {
        toast({ title: 'Could not mark as read', description: error.message, variant: 'destructive' });
      }
    }
    navigate(`/parent/transactions/${alert.transactionId}/edit`);
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
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-800">Alerts</h1>
          <p className="text-muted-foreground font-semibold">Unread: {unreadCount}</p>
        </div>
        <Button variant="outline" onClick={markAllRead} disabled={alerts.length === 0}>
          Mark all as read
        </Button>
      </div>

      {alerts.length === 0 ? (
        <div className="finn-card py-10 text-center">
          <p className="text-slate-700 font-bold">No alerts yet.</p>
          <p className="text-sm text-muted-foreground font-semibold mt-1">
            When a child logs a withdrawal, it will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={`w-full text-left rounded-2xl border-2 p-4 transition ${
                alert.read
                  ? 'border-slate-200 bg-white'
                  : 'border-sky-300 bg-sky-50'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-extrabold text-slate-800">{alert.childName} logged a withdrawal</p>
                  <p className="text-sm text-muted-foreground font-semibold">
                    {alert.date} at {alert.time}
                  </p>
                </div>
                {!alert.read && (
                  <span className="text-xs font-extrabold text-sky-700 bg-sky-100 px-2 py-1 rounded-full">
                    Unread
                  </span>
                )}
              </div>

              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-sm">
                <p><span className="font-bold">Amount:</span> {formatCurrency(alert.amount)}</p>
                <p><span className="font-bold">Category:</span> {alert.category}</p>
                <p><span className="font-bold">Location:</span> {alert.location}</p>
                <p><span className="font-bold">Reason:</span> {alert.reason}</p>
                <p><span className="font-bold">Child:</span> {alert.childName}</p>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {!alert.read && (
                  <Button variant="outline" onClick={() => markRead(alert.id)}>
                    Mark as read
                  </Button>
                )}
                <Button onClick={() => handleEditFromAlert(alert)}>
                  Edit transaction
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
