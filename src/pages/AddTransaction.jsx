import React, { useState, useEffect } from "react";
import { db } from '@/api/base44Client';
import { useNavigate, useParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Save, X } from "lucide-react";
import DolphinMascot from "@/components/DolphinMascot";
import { toast } from "@/components/ui/use-toast";

export default function AddTransaction() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = Boolean(id);

  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [transactionType, setTransactionType] = useState("");
  const [category, setCategory] = useState("");
  const [otherCategory, setOtherCategory] = useState("");
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    db.entities.Transaction.get(id).then((t) => {
      setAmount(String(t.amount));
      setDate(t.date.slice(0, 10));
      setDescription(t.description);
      setLocation(t.location || "");
      setTransactionType(t.transaction_type);
      setCategory(t.category);
      setOtherCategory(t.other_category || "");
      setLoading(false);
    });
  }, [id]);

  const validate = () => {
    const e = {};
    if (!amount) e.amount = "Please enter an amount.";
    if (!date) e.date = "Please select a date.";
    if (!description) e.description = "Please enter a description.";
    if (!transactionType) e.transactionType = "Please choose a type.";
    if (transactionType === "spending") {
      if (!category) e.category = "Please choose a category.";
      if (category === "other" && !otherCategory.trim())
        e.otherCategory = "Please specify the other category.";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    const payload = {
      amount: Number(amount),
      date,
      description: description.trim(),
      location: location.trim(),
      transaction_type: transactionType,
      category,
      other_category: category === "other" ? otherCategory.trim() : "",
    };
    try {
      if (isEditing) {
        await db.entities.Transaction.update(id, payload);
        toast({ title: "Changes saved successfully." });
      } else {
        await db.entities.Transaction.create(payload);
        toast({ title: "Great! Your transaction has been saved." });
      }
      navigate("/");
    } catch (err) {
      toast({
        title: "Something went wrong",
        description: err.message || "Could not save the transaction.",
        variant: "destructive",
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
    <div className="max-w-2xl mx-auto">
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-1 text-sm font-bold text-slate-500 hover:text-sky-600 mb-4"
      >
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className="finn-card">
        <div className="flex items-center gap-3 mb-6">
          <DolphinMascot className="w-14 h-14" />
          <div>
            <h1 className="text-2xl font-extrabold text-slate-800">
              {isEditing ? "Edit Transaction" : "Add a Transaction"}
            </h1>
            <p className="text-sm text-muted-foreground font-semibold">
              {isEditing ? "Update the details below." : "Record money you earned or spent."}
            </p>
          </div>
        </div>

        <div className="space-y-5">
          {/* Transaction Type */}
          <div className="space-y-2">
            <Label className="font-bold text-slate-700">Transaction Type</Label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { value: "spending", label: "💸 Spending", color: "rose" },
                { value: "earning", label: "💰 Earning", color: "emerald" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setTransactionType(opt.value)}
                  className={`py-4 rounded-2xl font-bold border-2 transition-all ${
                    transactionType === opt.value
                      ? opt.color === "rose"
                        ? "border-rose-400 bg-rose-50 text-rose-600"
                        : "border-emerald-400 bg-emerald-50 text-emerald-600"
                      : "border-border bg-white text-slate-500 hover:border-sky-200"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {errors.transactionType && (
              <p className="text-sm text-red-500 font-semibold">{errors.transactionType}</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Amount */}
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

            {/* Date */}
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

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="desc" className="font-bold text-slate-700">
              Description
            </Label>
            <Input
              id="desc"
              placeholder="e.g. Allowance, Bike repair, Snacks"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="h-12 text-base rounded-2xl border-2"
            />
            {errors.description && (
              <p className="text-sm text-red-500 font-semibold">{errors.description}</p>
            )}
          </div>

          {/* Location */}
          <div className="space-y-2">
            <Label htmlFor="loc" className="font-bold text-slate-700">
              Location
            </Label>
            <Input
              id="loc"
              placeholder="e.g. School canteen, Home, Corner shop"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="h-12 text-base rounded-2xl border-2"
            />
          </div>

          {/* Category */}
          {transactionType === "spending" && (
            <>
              <div className="space-y-2">
                <Label className="font-bold text-slate-700">Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="h-12 text-base rounded-2xl border-2">
                    <SelectValue placeholder="Choose a category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="needs">Needs</SelectItem>
                    <SelectItem value="wants">Wants</SelectItem>
                    <SelectItem value="assets">Assets</SelectItem>
                    <SelectItem value="liabilities">Liabilities</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
                {errors.category && <p className="text-sm text-red-500 font-semibold">{errors.category}</p>}
              </div>

              {/* Other category */}
              {category === "other" && (
                <div className="space-y-2">
                  <Label htmlFor="other" className="font-bold text-slate-700">
                    Please Specify
                  </Label>
                  <Input
                    id="other"
                    placeholder="Type your custom category"
                    value={otherCategory}
                    onChange={(e) => setOtherCategory(e.target.value)}
                    className="h-12 text-base rounded-2xl border-2"
                  />
                  {errors.otherCategory && (
                    <p className="text-sm text-red-500 font-semibold">{errors.otherCategory}</p>
                  )}
                </div>
              )}
            </>
          )}

          {/* Buttons */}
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
                  {isEditing ? "Update Transaction" : "Save Transaction"}
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

      {isEditing && (
        <div className="flex justify-center mt-6">
          <DolphinMascot className="w-24 h-24" message="Changes saved successfully." />
        </div>
      )}
    </div>
  );
}