import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, ShoppingCart } from "lucide-react";

import usePageMeta from "@/hooks/usePageMeta";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/use-toast";
import { education } from "@/api/education";
import {
  Chip,
  ChipRow,
  Empty,
  ErrorBanner,
  PageTitle,
  Pill,
  Section,
  SmallButton,
  Spinner,
  formatEdu,
  itemCategoryLabel,
  useLoad,
  useStudent,
} from "@/components/student/StudentUI";

const stockText = (item) => {
  if (item.stock === null) return "Available in store";
  if (item.stock === 0) return "Sold out";
  return `${item.stock} left${item.perStudentLimit ? ` (limit ${item.perStudentLimit} per student)` : ""}`;
};

function ItemFacts({ item }) {
  return (
    <div className="space-y-1 text-sm font-semibold text-slate-700">
      <p>Category: {itemCategoryLabel(item)}</p>
      <p>
        Price: <span className="font-extrabold text-slate-900">{formatEdu(item.price)} EduBucks</span>
      </p>
      <p>Stock: {stockText(item)}</p>
      {item.assetKind === "bond" && (
        <p>
          Locked for {item.bondTermDays} days, then pays back {formatEdu(item.price * (1 + item.bondRatePct / 100))} (
          {item.bondRatePct}% return)
        </p>
      )}
      {item.assetKind === "venture" && <p>Risky: your teacher reveals whether it crashes, grows or IPOs.</p>}
      {item.weeklyIncome > 0 && <p>Earns {formatEdu(item.weeklyIncome)} every payday while you own it</p>}
    </div>
  );
}

function PurchasePanel({ item, owned, summary, onCancel, onBought }) {
  const limitLeft = item.perStudentLimit ? Math.max(item.perStudentLimit - owned, 0) : null;
  const quantityLocked = item.perStudentLimit === 1;
  const maxQuantity = Math.min(item.stock ?? 50, limitLeft ?? 50, 50);
  const [quantity, setQuantity] = useState(1);
  const [mode, setMode] = useState("tradeable");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const isFinancial = item.category === "financial";
  const total = item.price * quantity;

  const handleBuy = async () => {
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > maxQuantity) {
      return setError(`Choose a quantity between 1 and ${maxQuantity}.`);
    }
    setError("");
    setBusy(true);
    try {
      await education.buyStoreItem(item.id, quantity, isFinancial ? "tradeable" : mode);
      toast({ title: `You bought ${quantity > 1 ? `${quantity} × ` : ""}${item.name}` });
      onBought();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="finn-card border-2 border-sky-200">
      <p className="font-extrabold text-slate-800 border-b border-slate-100 pb-2 mb-3">
        Selected item: <span className="text-sky-700">{item.name}</span>
      </p>
      <div className="space-y-3 text-sm font-semibold text-slate-700">
        <p>Category: {itemCategoryLabel(item)}</p>
        <p>Base store price: {formatEdu(item.price)} EduBucks</p>

        <div className="flex flex-wrap items-center gap-2">
          <span>Quantity:</span>
          {quantityLocked ? (
            <span className="font-bold">1 per student <Pill tone="slate">Locked</Pill></span>
          ) : (
            <Input
              type="number"
              min={1}
              max={maxQuantity}
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              className="w-24 h-9 rounded-xl border-2"
            />
          )}
          {limitLeft !== null && !quantityLocked && (
            <span className="text-xs text-slate-500">You can own {limitLeft} more</span>
          )}
        </div>

        {!isFinancial && (
          <fieldset className="space-y-1.5">
            <legend className="mb-1">After you buy it:</legend>
            {[
              ["tradeable", "Tradeable", "You can resell it on the marketplace (switch to personal use later to redeem it)."],
              ["personal", "Personal use", "Keep it for yourself and redeem it (switch to tradeable later to sell it)."],
            ].map(([value, label, hint]) => (
              <label key={value} className="flex items-start gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="resale-mode"
                  value={value}
                  checked={mode === value}
                  onChange={() => setMode(value)}
                  className="mt-1 accent-sky-500"
                />
                <span>
                  <span className="font-bold">{label}</span> <span className="text-slate-500">{hint}</span>
                </span>
              </label>
            ))}
          </fieldset>
        )}

        <p className="text-base font-extrabold text-slate-900">Total: {formatEdu(total)}</p>
        <p className="text-xs text-slate-500">Your spending cash: {formatEdu(summary.cash)}</p>
        {limitLeft === 0 && (
          <p className="font-bold text-amber-700">You already own the most you can hold of this item.</p>
        )}
        {error && <p className="font-bold text-rose-600">{error}</p>}
      </div>
      <div className="flex justify-center gap-2 mt-4">
        <SmallButton tone="primary" className="px-5 py-2" disabled={busy || limitLeft === 0} onClick={handleBuy}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingCart className="w-4 h-4" />}
          Purchase
        </SmallButton>
        <SmallButton className="px-5 py-2" onClick={onCancel}>
          Cancel
        </SmallButton>
      </div>
    </div>
  );
}

export default function StudentStore() {
  usePageMeta("Class Store", "Spend your EduBucks in the class store.", "/student/store");
  const { summary, refreshSummary } = useStudent();
  const [selectedId, setSelectedId] = useState(null);
  const [detailsItem, setDetailsItem] = useState(null);
  const panelRef = useRef(null);

  const { data, loading, error, reload } = useLoad(async () => {
    const [items, holdings] = await Promise.all([education.storeItems(), education.holdings()]);
    return { items: items.filter((i) => i.isActive), holdings };
  }, []);

  useEffect(() => {
    if (selectedId) panelRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [selectedId]);

  if (loading) return <Spinner />;
  if (!data) return <ErrorBanner message={error} />;

  const selected = data.items.find((i) => i.id === selectedId);
  const ownedCount = (itemId) => data.holdings.filter((h) => h.itemId === itemId).length;

  return (
    <div>
      <PageTitle>Class Store &amp; Inventory Management</PageTitle>
      <ChipRow>
        <Chip label="Available cash" value={`${formatEdu(summary.cash)} EduBucks`} tone="green" />
        <Chip label="Inventory" value={`${data.holdings.length} item${data.holdings.length === 1 ? "" : "s"} owned`} />
      </ChipRow>
      <ErrorBanner message={error} />

      <Section title="Available Classroom Store Items & Privileges">
        {data.items.length === 0 ? (
          <div className="finn-card">
            <Empty>Your teacher hasn&apos;t added anything to the store yet.</Empty>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {data.items.map((item) => {
              const soldOut = item.stock === 0;
              return (
                <div
                  key={item.id}
                  className={`finn-card flex flex-col ${selectedId === item.id ? "ring-2 ring-sky-400" : ""}`}
                >
                  <p className="text-lg font-extrabold text-slate-800 mb-2">{item.name}</p>
                  <ItemFacts item={item} />
                  <div className="mt-auto pt-3 flex justify-end gap-1.5">
                    <SmallButton onClick={() => setDetailsItem(item)}>View details</SmallButton>
                    {item.saleMode === "auction" ? (
                      <Link
                        to="/student/marketplace"
                        className="inline-flex items-center rounded-xl bg-sky-500 px-3 py-1.5 text-sm font-bold text-white hover:bg-sky-600"
                      >
                        Bid in marketplace
                      </Link>
                    ) : (
                      <SmallButton tone="primary" disabled={soldOut} onClick={() => setSelectedId(item.id)}>
                        {soldOut ? "Sold out" : "Select"}
                      </SmallButton>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {selected && (
        <Section title="Item Details & Purchase">
          <div ref={panelRef}>
            <PurchasePanel
              key={selected.id}
              item={selected}
              owned={ownedCount(selected.id)}
              summary={summary}
              onCancel={() => setSelectedId(null)}
              onBought={async () => {
                setSelectedId(null);
                await reload();
                await refreshSummary();
              }}
            />
          </div>
        </Section>
      )}

      <Dialog open={Boolean(detailsItem)} onOpenChange={(open) => !open && setDetailsItem(null)}>
        <DialogContent className="max-w-md rounded-3xl">
          {detailsItem && (
            <>
              <DialogHeader>
                <DialogTitle className="font-extrabold">{detailsItem.name}</DialogTitle>
                {detailsItem.description && <DialogDescription>{detailsItem.description}</DialogDescription>}
              </DialogHeader>
              <ItemFacts item={detailsItem} />
              <p className="text-xs font-semibold text-slate-500">You own {ownedCount(detailsItem.id)} of these.</p>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
