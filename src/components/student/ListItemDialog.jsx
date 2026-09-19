import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { education, isInStoreNow } from "@/api/education";
import { formatDuration, formatEdu, parseAmount, SmallButton } from "@/components/student/StudentUI";

const DEFAULT_DURATION_HOURS = 24;
const MIN_DURATION_HOURS = 1;
const MAX_DURATION_HOURS = 168;

// Items a student can put on the marketplace right now: owned, held (not
// already listed or used), tradeable, and not a bond (locked until maturity).
export const listableHoldings = (holdings) =>
  holdings.filter((h) => h.status === "held" && h.mode === "tradeable" && h.item?.assetKind !== "bond");

/**
 * kind: "commodity" -- items the class store is selling right now (go live straight away)
 *       "new"       -- anything else the student owns (needs teacher approval)
 *       "any"       -- no filter (e.g. "Resell" on one specific item)
 */
export default function ListItemDialog({ open, onOpenChange, holdings, kind = "any", initialHoldingId, onListed }) {
  const candidates = listableHoldings(holdings).filter((h) =>
    kind === "any" ? true : kind === "commodity" ? isInStoreNow(h.item) : !isInStoreNow(h.item)
  );

  const [holdingId, setHoldingId] = useState("");
  const [saleType, setSaleType] = useState("fixed");
  const [priceText, setPriceText] = useState("");
  const [durationHours, setDurationHours] = useState(DEFAULT_DURATION_HOURS);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const first = initialHoldingId || candidates[0]?.id || "";
    setHoldingId(first);
    setSaleType("fixed");
    const holding = candidates.find((h) => h.id === first);
    setPriceText(holding ? holding.item.price.toFixed(2) : "");
    setDurationHours(DEFAULT_DURATION_HOURS);
    setError("");
    // Reset only when the dialog opens.
  }, [open]);

  const selected = candidates.find((h) => h.id === holdingId);
  const needsApproval = selected && !isInStoreNow(selected.item);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const price = parseAmount(priceText);
    if (!selected) return setError("Choose an item to sell.");
    if (!(price > 0)) return setError("Enter a price in dollars and cents, like 12.50.");
    setError("");
    setSaving(true);
    try {
      await education.createListing({
        holdingId: selected.id,
        saleType,
        price,
        durationHours: saleType === "auction" ? durationHours : DEFAULT_DURATION_HOURS,
      });
      onOpenChange(false);
      onListed?.(needsApproval);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const title = kind === "commodity" ? "List a commodity" : kind === "new" ? "List a new item" : "Sell this item";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-3xl">
        <DialogHeader>
          <DialogTitle className="font-extrabold">{title}</DialogTitle>
          <DialogDescription>
            {kind === "commodity"
              ? "Items the class store is selling right now. They go live straight away."
              : kind === "new"
                ? "Items the class store no longer sells. Your teacher approves these before classmates can see them."
                : "Put your item on the class marketplace."}
          </DialogDescription>
        </DialogHeader>

        {candidates.length === 0 ? (
          <p className="text-sm font-semibold text-slate-500 py-4">
            {kind === "commodity"
              ? "You don't own any tradeable items that the store is selling right now."
              : kind === "new"
                ? "You don't own any tradeable items that the store no longer sells."
                : "This item can't be listed right now."}
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="list-item" className="font-bold text-slate-700">Item</Label>
              <select
                id="list-item"
                value={holdingId}
                onChange={(e) => {
                  setHoldingId(e.target.value);
                  const holding = candidates.find((h) => h.id === e.target.value);
                  if (holding) setPriceText(holding.item.price.toFixed(2));
                }}
                className="w-full h-11 rounded-2xl border-2 border-input bg-white px-3 text-sm font-semibold"
              >
                {candidates.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.item.name} (paid {formatEdu(h.pricePaid)})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label className="font-bold text-slate-700">How do you want to sell it?</Label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  ["fixed", "Buy now", "Set one price"],
                  ["auction", "Auction", "Highest bid wins"],
                ].map(([value, label, hint]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setSaleType(value)}
                    className={`rounded-2xl border-2 p-3 text-left ${
                      saleType === value ? "border-sky-500 bg-sky-50" : "border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <span className="block text-sm font-extrabold text-slate-800">{label}</span>
                    <span className="block text-xs font-semibold text-slate-500">{hint}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="list-price" className="font-bold text-slate-700">
                {saleType === "auction" ? "Starting price" : "Price"} (EduBucks)
              </Label>
              <Input
                id="list-price"
                inputMode="decimal"
                value={priceText}
                onChange={(e) => setPriceText(e.target.value)}
                className="h-11 rounded-2xl border-2"
                placeholder="15.00"
              />
              {selected && (
                <p className="text-xs font-semibold text-slate-500">
                  Store price {formatEdu(selected.item.price)} · You paid {formatEdu(selected.pricePaid)}
                </p>
              )}
            </div>

            {saleType === "auction" && (
              <div className="space-y-2">
                <Label htmlFor="list-duration" className="font-bold text-slate-700">
                  Sells after <span className="text-sky-700">{formatDuration(durationHours)}</span> with no higher bid
                </Label>
                <input
                  id="list-duration"
                  type="range"
                  min={MIN_DURATION_HOURS}
                  max={MAX_DURATION_HOURS}
                  step={1}
                  value={durationHours}
                  onChange={(e) => setDurationHours(Number(e.target.value))}
                  className="w-full accent-sky-500"
                />
                <div className="flex justify-between text-xs font-semibold text-slate-400">
                  <span>1 hour</span>
                  <span>7 days</span>
                </div>
                <p className="text-xs font-semibold text-slate-500">
                  The timer starts at the first bid and restarts every time someone bids higher.
                </p>
              </div>
            )}

            {needsApproval && (
              <p className="rounded-2xl bg-amber-50 border-2 border-amber-100 p-3 text-xs font-bold text-amber-800">
                The class store doesn&apos;t sell this item right now, so your teacher has to approve the listing first.
              </p>
            )}
            {error && <p className="text-sm font-bold text-rose-600">{error}</p>}

            <div className="flex justify-end gap-2">
              <SmallButton onClick={() => onOpenChange(false)}>Cancel</SmallButton>
              <SmallButton tone="primary" type="submit" disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                List item
              </SmallButton>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
