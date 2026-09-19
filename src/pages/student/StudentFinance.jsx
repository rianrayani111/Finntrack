import React, { useState } from "react";
import { Lock } from "lucide-react";

import usePageMeta from "@/hooks/usePageMeta";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/use-toast";
import { education } from "@/api/education";
import ListItemDialog from "@/components/student/ListItemDialog";
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
  StatusDot,
  formatDate,
  formatEdu,
  itemCategoryLabel,
  useLoad,
  useStudent,
} from "@/components/student/StudentUI";

const DAY_MS = 24 * 60 * 60 * 1000;

// Mirrors edu_holding_value (0031) for display only; net worth itself comes
// from the server.
const bondValueNow = (h) => {
  const start = new Date(h.acquiredAt).getTime();
  const end = new Date(h.maturesAt).getTime();
  const progress = Math.min(1, Math.max(0, (Date.now() - start) / (end - start || 1)));
  return Math.round(h.pricePaid * (1 + (h.item.bondRatePct / 100) * progress) * 100) / 100;
};

function HoldingCard({ holding, children }) {
  return (
    <div className="rounded-3xl border-2 border-slate-100 bg-white p-4 flex flex-col">
      <p className="font-extrabold text-slate-800">{holding.item.name}</p>
      <div className="mt-1 space-y-0.5 text-sm font-semibold text-slate-600 flex-1">{children}</div>
    </div>
  );
}

export default function StudentFinance() {
  usePageMeta("Finance", "Your items, investments and net worth.", "/student/finance");
  const { summary, refreshSummary } = useStudent();
  const [busyId, setBusyId] = useState(null);
  const [resellId, setResellId] = useState(null);
  const [detailsHolding, setDetailsHolding] = useState(null);

  const { data: holdings, loading, error, reload } = useLoad(() => education.holdings(), []);

  if (loading) return <Spinner />;
  if (!holdings) return <ErrorBanner message={error} />;

  const everyday = holdings.filter((h) => h.item.category !== "financial");
  const tradeable = everyday.filter((h) => h.mode === "tradeable");
  const personal = everyday.filter((h) => h.mode === "personal");
  const bonds = holdings.filter((h) => h.item.assetKind === "bond");
  const ventures = holdings.filter((h) => h.item.assetKind === "venture");
  const properties = holdings.filter((h) => h.item.assetKind === "property");

  const act = async (holding, action, title) => {
    setBusyId(holding.id);
    try {
      await action();
      toast({ title });
      await reload();
      await refreshSummary();
    } catch (err) {
      toast({ title: "Something went wrong", description: err.message, variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const listedNote = (h) => h.status === "listed" && <StatusDot tone="amber">On the marketplace</StatusDot>;

  return (
    <div>
      <PageTitle>Finance &amp; Asset Management</PageTitle>
      <ChipRow>
        <Chip label="Liquid cash" value={`${formatEdu(summary.cash)} EduBucks`} tone="green" />
        <Chip label="Net worth" value={`${formatEdu(summary.netWorth)} EduBucks`} />
      </ChipRow>
      <ErrorBanner message={error} />

      <Section title="Tradeable Assets" subtitle="Items here can be flipped, traded or sold to other students on the marketplace.">
        <div className="finn-card">
          {tradeable.length === 0 ? (
            <Empty>No tradeable items. Buy something in the class store to get started.</Empty>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {tradeable.map((h) => (
                <HoldingCard key={h.id} holding={h}>
                  <p>Category: {itemCategoryLabel(h.item)}</p>
                  <p>Price paid: {formatEdu(h.pricePaid)}</p>
                  <p>Status: {listedNote(h) || <StatusDot tone="green">Tradeable</StatusDot>}</p>
                  <div className="pt-2 flex flex-wrap gap-1.5">
                    {h.status === "held" && (
                      <>
                        <SmallButton tone="primary" onClick={() => setResellId(h.id)}>
                          Resell
                        </SmallButton>
                        <SmallButton
                          disabled={busyId === h.id}
                          onClick={() =>
                            act(h, () => education.setHoldingMode(h.id, "personal"), `${h.item.name} moved to personal use`)
                          }
                        >
                          Keep for personal use
                        </SmallButton>
                      </>
                    )}
                    <SmallButton onClick={() => setDetailsHolding(h)}>View details</SmallButton>
                  </div>
                </HoldingCard>
              ))}
            </div>
          )}
        </div>
      </Section>

      <Section
        title="Consumed / Personal Use Assets"
        subtitle="Items for personal use are yours to redeem and can't be sold unless you switch them back to tradeable."
      >
        <div className="finn-card">
          {personal.length === 0 ? (
            <Empty>No personal-use items.</Empty>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {personal.map((h) => (
                <HoldingCard key={h.id} holding={h}>
                  <p>Category: {itemCategoryLabel(h.item)}</p>
                  <p>Price paid: {formatEdu(h.pricePaid)}</p>
                  <p>
                    Status: <StatusDot tone="green">Not redeemed yet</StatusDot>
                  </p>
                  <div className="pt-2 flex flex-wrap gap-1.5">
                    <SmallButton
                      tone="green"
                      disabled={busyId === h.id}
                      onClick={() => act(h, () => education.redeemHolding(h.id), `${h.item.name} redeemed`)}
                    >
                      Redeem
                    </SmallButton>
                    <SmallButton
                      disabled={busyId === h.id}
                      onClick={() =>
                        act(h, () => education.setHoldingMode(h.id, "tradeable"), `${h.item.name} is tradeable again`)
                      }
                    >
                      Make tradeable
                    </SmallButton>
                    <SmallButton onClick={() => setDetailsHolding(h)}>View details</SmallButton>
                  </div>
                </HoldingCard>
              ))}
            </div>
          )}
        </div>
      </Section>

      <Section title="Financial Assets: Specific Investments View">
        {bonds.length + ventures.length + properties.length === 0 ? (
          <div className="finn-card">
            <Empty>You don&apos;t own any bonds, startup shares or property yet. Find them in the class store.</Empty>
          </div>
        ) : (
          <div className="grid lg:grid-cols-2 gap-3">
            {bonds.map((h) => {
              const atMaturity = Math.round(h.pricePaid * (1 + h.item.bondRatePct / 100) * 100) / 100;
              const daysLeft = Math.max(0, Math.ceil((new Date(h.maturesAt).getTime() - Date.now()) / DAY_MS));
              return (
                <div key={h.id} className="finn-card">
                  <p className="font-extrabold text-slate-800 border-b border-slate-100 pb-2 mb-2">
                    {h.item.name} <span className="text-slate-500 font-bold">(fixed income asset)</span>
                  </p>
                  <div className="space-y-1 text-sm font-semibold text-slate-700">
                    <p>Category: Financial Assets &amp; Investments → Bond</p>
                    <p>Purchase price: {formatEdu(h.pricePaid)} EduBucks</p>
                    <p>
                      Term length: {h.item.bondTermDays} days (maturity date: {formatDate(h.maturesAt)})
                    </p>
                    <p>Interest rate: {h.item.bondRatePct}% guaranteed return</p>
                    <p>
                      Value at maturity: {formatEdu(atMaturity)} EduBucks (+{formatEdu(atMaturity - h.pricePaid)} profit)
                    </p>
                    <p>Value today: {formatEdu(bondValueNow(h))}</p>
                    <p>Usage mode: Hold to maturity</p>
                    <p className="flex items-center gap-1.5">
                      Status: <Lock className="w-4 h-4" /> Vault locked (unlocks in {daysLeft} day{daysLeft === 1 ? "" : "s"})
                    </p>
                  </div>
                </div>
              );
            })}

            {ventures.map((h) => {
              const value = Math.round(h.item.price * h.item.ventureMultiplier * 100) / 100;
              const revealed = h.item.ventureMultiplier !== 1;
              return (
                <div key={h.id} className="finn-card">
                  <p className="font-extrabold text-slate-800 border-b border-slate-100 pb-2 mb-2">{h.item.name}</p>
                  <div className="space-y-1 text-sm font-semibold text-slate-700">
                    <p>Category: Financial Assets &amp; Investments → Startup</p>
                    <p>Initial buy-in: {formatEdu(h.pricePaid)}</p>
                    <p>Outcome: your teacher decides whether it crashes, grows, or has a successful IPO</p>
                    <p>Current value: {formatEdu(value)}</p>
                    <p>
                      Status:{" "}
                      {revealed ? (
                        <Pill tone={h.item.ventureMultiplier < 1 ? "red" : "green"}>{h.item.ventureMultiplier}× outcome</Pill>
                      ) : (
                        <Pill tone="amber">Bought, waiting for the outcome</Pill>
                      )}{" "}
                      {listedNote(h)}
                    </p>
                    {h.status === "held" && (
                      <div className="pt-1">
                        <SmallButton tone="primary" onClick={() => setResellId(h.id)}>
                          Sell shares
                        </SmallButton>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {properties.map((h) => (
              <div key={h.id} className="finn-card">
                <p className="font-extrabold text-slate-800 border-b border-slate-100 pb-2 mb-2">{h.item.name}</p>
                <div className="space-y-1 text-sm font-semibold text-slate-700">
                  <p>Category: Financial Assets &amp; Investments → Real Estate</p>
                  <p>Purchase price: {formatEdu(h.pricePaid)}</p>
                  <p>Current value: {formatEdu(h.item.price)}</p>
                  <p>Rent income: +{formatEdu(h.item.weeklyIncome)} every payday</p>
                  <p>Status: {listedNote(h) || <StatusDot tone="green">Earning rent</StatusDot>}</p>
                  {h.status === "held" && (
                    <div className="pt-1">
                      <SmallButton tone="primary" onClick={() => setResellId(h.id)}>
                        Sell property
                      </SmallButton>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Financial Concepts Comparison">
        <div className="finn-card space-y-1.5 text-sm font-semibold text-slate-700">
          <p>
            <span className="font-extrabold">Bonds (low risk):</span> guaranteed returns, but your money is locked until
            maturity.
          </p>
          <p>
            <span className="font-extrabold">Startup equity (higher risk):</span> big growth potential, but you could also
            lose money.
          </p>
          <p>
            <span className="font-extrabold">Real estate:</span> earns steady rent every payday, and can be sold to a
            classmate.
          </p>
        </div>
      </Section>

      <ListItemDialog
        open={Boolean(resellId)}
        onOpenChange={(open) => !open && setResellId(null)}
        holdings={holdings}
        kind="any"
        initialHoldingId={resellId}
        onListed={async (needsApproval) => {
          toast({ title: needsApproval ? "Sent to your teacher for approval" : "Your item is live on the marketplace" });
          await reload();
        }}
      />

      <Dialog open={Boolean(detailsHolding)} onOpenChange={(open) => !open && setDetailsHolding(null)}>
        <DialogContent className="max-w-md rounded-3xl">
          {detailsHolding && (
            <>
              <DialogHeader>
                <DialogTitle className="font-extrabold">{detailsHolding.item.name}</DialogTitle>
                {detailsHolding.item.description && (
                  <DialogDescription>{detailsHolding.item.description}</DialogDescription>
                )}
              </DialogHeader>
              <div className="space-y-1 text-sm font-semibold text-slate-700">
                <p>Category: {itemCategoryLabel(detailsHolding.item)}</p>
                <p>Price paid: {formatEdu(detailsHolding.pricePaid)}</p>
                <p>Store price today: {formatEdu(detailsHolding.item.price)}</p>
                <p>Owned since: {formatDate(detailsHolding.acquiredAt)}</p>
                <p>Mode: {detailsHolding.mode === "personal" ? "Personal use" : "Tradeable"}</p>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
