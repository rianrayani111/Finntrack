import React, { useEffect, useState } from 'react';
import { db } from '@/api/db';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';
import { todayLocalDateString } from '@/lib/finance';

export default function ParentAddMoney() {
  const navigate = useNavigate();
  const [children, setChildren] = useState([]);
  const [childId, setChildId] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [date, setDate] = useState(todayLocalDateString());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    db.users
      .listMyChildren()
      .then((items) => {
        const next = items || [];
        setChildren(next);
        if (next.length > 0) {
          setChildId(next[0].uid);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await db.entities.Transaction.create({
        childId,
        type: 'deposit',
        amount: Number(amount),
        reason: reason.trim(),
        date,
      });
      toast({ title: 'Money added successfully.' });
      navigate('/parent');
    } catch (error) {
      toast({
        title: 'Could not add money',
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

  if (children.length === 0) {
    return (
      <div className="finn-card text-center py-10">
        <p className="text-slate-700 font-bold">No child accounts available.</p>
        <p className="text-sm text-muted-foreground font-semibold mt-1">
          Add a child first, then you can deposit money.
        </p>
        <Button className="mt-4" onClick={() => navigate('/parent/add-child')}>
          Add a Child
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <div className="finn-card">
        <h1 className="text-2xl font-extrabold text-slate-800">Add Money</h1>
        <p className="text-sm text-muted-foreground font-semibold mt-1">
          Parents can only add deposits. Withdrawals are child-only.
        </p>

        <form className="space-y-4 mt-6" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label>Child</Label>
            <Select value={childId} onValueChange={setChildId}>
              <SelectTrigger>
                <SelectValue placeholder="Select child" />
              </SelectTrigger>
              <SelectContent>
                {children.map((child) => (
                  <SelectItem key={child.uid} value={child.uid}>
                    {child.displayName} (@{child.username})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Amount</Label>
            <Input
              id="amount"
              type="number"
              min="0"
              step="0.01"
              required
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="0.00"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Reason</Label>
            <Input
              id="reason"
              required
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Weekly allowance"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="date">Date</Label>
            <Input
              id="date"
              type="date"
              required
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </div>

          <Button className="w-full" type="submit" disabled={saving}>
            {saving ? 'Saving...' : 'Add Money'}
          </Button>
        </form>
      </div>
    </div>
  );
}
