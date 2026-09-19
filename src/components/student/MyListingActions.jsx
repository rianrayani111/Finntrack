import React, { useState } from "react";
import { Loader2 } from "lucide-react";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/use-toast";
import { education } from "@/api/education";
import { formatEdu, parseAmount, SmallButton } from "@/components/student/StudentUI";

// "Update price" and "Cancel" for one of the student's own listings. Used on
// the dashboard and the marketplace. Auctions that already have bids can
// neither be repriced nor cancelled (the server enforces this too).
export default function MyListingActions({ listing, onChanged }) {
  const [priceOpen, setPriceOpen] = useState(false);
  const [priceText, setPriceText] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const locked = listing.saleType === "auction" && listing.bidCount > 0;

  const run = async (action, successTitle) => {
    setBusy(true);
    try {
      await action();
      toast({ title: successTitle });
      onChanged?.();
      return true;
    } catch (err) {
      toast({ title: "Something went wrong", description: err.message, variant: "destructive" });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const handleSavePrice = async (e) => {
    e.preventDefault();
    const price = parseAmount(priceText);
    if (!(price > 0)) return setError("Enter a price in dollars and cents, like 12.50.");
    setError("");
    const ok = await run(() => education.updateListingPrice(listing.id, price), "Price updated");
    if (ok) setPriceOpen(false);
  };

  if (locked) {
    return <span className="text-xs font-bold text-slate-500">Auction running</span>;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      <SmallButton
        disabled={busy}
        onClick={() => {
          setPriceText(listing.price.toFixed(2));
          setError("");
          setPriceOpen(true);
        }}
      >
        Update price
      </SmallButton>
      <SmallButton
        tone="danger"
        disabled={busy}
        onClick={() => run(() => education.cancelListing(listing.id), "Listing cancelled")}
      >
        Cancel
      </SmallButton>

      <Dialog open={priceOpen} onOpenChange={setPriceOpen}>
        <DialogContent className="max-w-sm rounded-3xl">
          <DialogHeader>
            <DialogTitle className="font-extrabold">Update price</DialogTitle>
            <DialogDescription>
              {listing.item?.name} · currently {formatEdu(listing.price)}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSavePrice} className="space-y-3">
            <Input
              inputMode="decimal"
              value={priceText}
              onChange={(e) => setPriceText(e.target.value)}
              className="h-11 rounded-2xl border-2"
              autoFocus
            />
            {error && <p className="text-sm font-bold text-rose-600">{error}</p>}
            <div className="flex justify-end gap-2">
              <SmallButton onClick={() => setPriceOpen(false)}>Cancel</SmallButton>
              <SmallButton tone="primary" type="submit" disabled={busy}>
                {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                Save
              </SmallButton>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
