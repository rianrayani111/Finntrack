import React, { useState } from 'react';
import { db } from '@/api/db';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Save, X } from 'lucide-react';
import FinnLogo from '@/components/FinnLogo';
import { toast } from '@/components/ui/use-toast';

export default function AddTransaction() {
  const navigate = useNavigate();

  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState(new Date().toTimeString().slice(0, 5));
  const [reason, setReason] = useState('');
  const [location, setLocation] = useState('');
  const [category, setCategory] = useState('');
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const validate = () => {
    const nextErrors = {};
    if (!amount || Number(amount) <= 0) nextErrors.amount = 'Please enter an amount greater than zero.';
    if (!date) nextErrors.date = 'Please select a date.';
    if (!time) nextErrors.time = 'Please select a time.';
    if (!reason.trim()) nextErrors.reason = 'Please enter a reason.';
    if (!location.trim()) nextErrors.location = 'Please enter a location.';
    if (!category) nextErrors.category = 'Please choose a category.';
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;

    setSaving(true);
    try {
      await db.entities.Transaction.create({
        type: 'withdrawal',
        amount: Number(amount),
        date,
        time,
        reason: reason.trim(),
        location: location.trim(),
        category,
      });

      toast({ title: 'Withdrawal saved.' });
      navigate('/dashboard');
    } catch (error) {
      toast({
        title: 'Something went wrong',
        description: error.message || 'Could not save your withdrawal.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-1 text-sm font-bold text-slate-500 hover:text-sky-600 mb-4"
      >
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className="finn-card">
        <div className="flex items-center gap-3 mb-6">
          <FinnLogo className="w-14 h-14" />
          <div>
            <h1 className="text-2xl font-extrabold text-slate-800">Log a Withdrawal</h1>
            <p className="text-sm text-muted-foreground font-semibold">
              Record money you spent.
            </p>
          </div>
        </div>

        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-2">
              <Label htmlFor="amount" className="font-bold text-slate-700">
                Amount
              </Label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="pl-8 h-12 text-lg rounded-2xl border-2"
                />
              </div>
              {errors.amount && <p className="text-sm text-red-500 font-semibold">{errors.amount}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="date" className="font-bold text-slate-700">
                Date
              </Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-12 text-base rounded-2xl border-2"
              />
              {errors.date && <p className="text-sm text-red-500 font-semibold">{errors.date}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="time" className="font-bold text-slate-700">
              Time
            </Label>
            <Input
              id="time"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="h-12 text-base rounded-2xl border-2"
            />
            {errors.time && <p className="text-sm text-red-500 font-semibold">{errors.time}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason" className="font-bold text-slate-700">
              Reason
            </Label>
            <Input
              id="reason"
              placeholder="e.g. Snack after school"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="h-12 text-base rounded-2xl border-2"
            />
            {errors.reason && <p className="text-sm text-red-500 font-semibold">{errors.reason}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="location" className="font-bold text-slate-700">
              Location
            </Label>
            <Input
              id="location"
              placeholder="e.g. School canteen"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="h-12 text-base rounded-2xl border-2"
            />
            {errors.location && <p className="text-sm text-red-500 font-semibold">{errors.location}</p>}
          </div>

          <div className="space-y-2">
            <Label className="font-bold text-slate-700">Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="h-12 text-base rounded-2xl border-2">
                <SelectValue placeholder="Choose a category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="necessity">Necessity</SelectItem>
                <SelectItem value="want">Want</SelectItem>
                <SelectItem value="asset">Asset</SelectItem>
                <SelectItem value="liability">Liability</SelectItem>
              </SelectContent>
            </Select>
            {errors.category && <p className="text-sm text-red-500 font-semibold">{errors.category}</p>}
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 h-12 rounded-2xl bg-sky-500 hover:bg-sky-600 text-white font-bold text-base"
            >
              {saving ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Save className="w-5 h-5" />
                  Save Withdrawal
                </span>
              )}
            </Button>
            <Button
              onClick={() => navigate(-1)}
              variant="outline"
              className="h-12 px-6 rounded-2xl font-bold border-2"
            >
              <X className="w-4 h-4 mr-1" />
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
