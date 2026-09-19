import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Gavel, Loader2, PlusCircle, ShoppingBag } from "lucide-react";

import usePageMeta from "@/hooks/usePageMeta";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";
import { education } from "@/api/education";
import ListItemDialog from "@/components/student/ListItemDialog";
import MyListingActions from "@/components/student/MyListingActions";
import {
  CATEGORY_LABELS,
  Empty,
  ErrorBanner,
  PageTitle,
  Pill,
  Section,
  SmallButton,
  Spinner,
  formatDuration,
  formatEdu,
  formatTimeLeft,
  itemCategoryLabel,
  parseAmount,
  useLoad,
  useStudent,
} from "@/components/student/StudentUI";

// Auction prices and timers change while the page is open.
const POLL_MS = 30000;

const EVENT_TEXT = {
  new_bid: (e) => `Someone bid ${formatEdu(e.amount)} on your ${e.itemName}.`,
  outbid: (e) => `You were outbid on ${e.itemName} (new bid ${formatEdu(e.amount)}). Your money is back in your cash.`,
  auction_won: (e) => `You won the auction for ${e.itemName} at ${formatEdu(e.amount)}!`,
  item_sold: (e) => `Your ${e.itemName} sold for ${formatEdu(e.amount)}.`,
  listing_approved: (e) => `Your teacher approved your listing for ${e.itemName}.`,
  listing_rejected: (e) => `Your teacher did not approve your listing for ${e.itemName}.`,
};

const currentPrice = (l) => (l.saleType === "auction" && l.highBid ? l.highBid : l.price);
const minimumBid = (l) => (l.highBid ? Math.round((l.highBid + 0.01) * 100) / 100 : l.price);

const timeAgo = (value) => {
  const minutes = Math.round((Date.now() - new Date(value).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
};

function ListingDialog({ listing, mode, sellerName, summary, onClose, onDone }) {
  const [bidText, setBidText] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState(mode);

  useEffect(() => {
    setView(mode);
    setError("");
    if (listing) setBidText(minimumBid(listing).toFixed(2));
  }, [listing, mode]);

  if (!listing) return null;
  const isAuction = listing.saleType === "auction";
  const leading = listing.highBidderId === summary.studentId;

  const act = async (action, title) => {
    setBusy(true);
    setError("");
    try {
      await action();
      toast({ title });
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleBid = (e) => {
    e.preventDefault();
    const amount = parseAmount(bidText);
    if (!(amount > 0)) return setError("Enter a bid in dollars and cents, like 12.50.");
    act(() => education.placeBid(listing.id, amount), `You bid ${formatEdu(amount)} on ${listing.item.name}`);
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md rounded-3xl">
        <DialogHeader>
          <DialogTitle className="font-extrabold">{listing.item.name}</DialogTitle>
          <DialogDescription>
            {itemCategoryLabel(listing.item)} · Sold by {sellerName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5 text-sm font-semibold text-slate-700">
          {listing.item.description && <p className="text-slate-600">{listing.item.description}</p>}
          <p>Class store price: {formatEdu(listing.item.price)}</p>
          {isAuction ? (
            <>
              <p>Starting price: {formatEdu(listing.price)}</p>
              <p>
                Current bid:{" "}
                {listing.highBid ? (
                  <span className="font-extrabold">
                    {formatEdu(listing.highBid)} ({listing.bidCount} bid{listing.bidCount === 1 ? "" : "s"})
                  </span>
                ) : (
                  "No bids yet"
                )}
                {leading && <Pill tone="green">You&apos;re winning</Pill>}
              </p>
              <p>
                {listing.endsAt
                  ? `Sells ${formatTimeLeft(listing.endsAt).replace(" left", "")} from now unless someone bids higher.`
                  : `Sells ${formatDuration(listing.durationSeconds / 3600)} after the first bid, unless someone bids higher.`}
              </p>
              <p className="text-xs text-slate-500">
                Each new bid restarts the timer. Your bid is held from your cash, and returned if someone outbids you.
              </p>
            </>
          ) : (
            <p className="text-base font-extrabold text-slate-900">Price: {formatEdu(listing.price)}</p>
          )}
          <p className="text-xs text-slate-500">Your spending cash: {formatEdu(summary.cash)}</p>
        </div>

        {view === "bid" && isAuction && (
          <form onSubmit={handleBid} className="space-y-2 mt-2">
            <Label htmlFor="bid-amount" className="font-bold text-slate-700">
              Your bid (at least {formatEdu(minimumBid(listing))})
            </Label>
            <Input
              id="bid-amount"
              inputMode="decimal"
              value={bidText}
              onChange={(e) => setBidText(e.target.value)}
              className="h-11 rounded-2xl border-2"
              autoFocus
            />
            {error && <p className="text-sm font-bold text-rose-600">{error}</p>}
            <div className="flex justify-end gap-2">
              <SmallButton onClick={onClose}>Cancel</SmallButton>
              <SmallButton tone="primary" type="submit" disabled={busy}>
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gavel className="w-4 h-4" />}
                Place bid
              </SmallButton>
            </div>
          </form>
        )}

        {view === "buy" && !isAuction && (
          <div className="space-y-2 mt-2">
            {error && <p className="text-sm font-bold text-rose-600">{error}</p>}
            <p className="text-sm font-bold text-slate-700">Buy this for {formatEdu(listing.price)}?</p>
            <div className="flex justify-end gap-2">
              <SmallButton onClick={onClose}>Cancel</SmallButton>
              <SmallButton
                tone="primary"
                disabled={busy}
                onClick={() => act(() => education.buyListing(listing.id), `You bought ${listing.item.name}`)}
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingBag className="w-4 h-4" />}
                Confirm purchase
              </SmallButton>
            </div>
          </div>
        )}

        {view === "info" && (
          <div className="flex justify-end gap-2 mt-2">
            <SmallButton onClick={onClose}>Close</SmallButton>
            <SmallButton tone="primary" onClick={() => setView(isAuction ? "bid" : "buy")}>
              {isAuction ? "Place a bid" : "Buy"}
            </SmallButton>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function StudentMarketplace() {
  usePageMeta("Marketplace", "Buy and sell with your classmates.", "/student/marketplace");
  const { summary, refreshSummary } = useStudent();
  const me = summary.studentId;

  const [, setTick] = useState(0);
  const [listDialog, setListDialog] = useState(null);
  const [openListing, setOpenListing] = useState(null);
  const [filters, setFilters] = useState({ category: "all", seller: "all", type: "all", sort: "newest" });
  // Events that were unread when they reached this page stay highlighted
  // for as long as it's open, even though they're marked read right away.
  const seenAsNew = useRef(new Set());

  const { data, loading, error, reload } = useLoad(async () => {
    await education.refresh();
    const [listings, holdings, events, bids, classmates] = await Promise.all([
      education.listings(),
      education.holdings(),
      education.marketEvents(),
      education.myBids(),
      education.classmates(),
    ]);
    return { listings, holdings, events, bids, classmates };
  }, []);

  // Everything visible on this page has now been seen: clear the nav count,
  // but keep highlighting what was new when the page opened.
  useEffect(() => {
    if (!data) return;
    data.events.filter((e) => !e.read).forEach((e) => seenAsNew.current.add(e.id));
    if (data.events.some((e) => !e.read)) {
      education.markMarketEventsRead().then(() => refreshSummary()).catch(() => {});
    }
  }, [data, refreshSummary]);

  useEffect(() => {
    const timer = setInterval(() => {
      setTick((t) => t + 1);
      reload();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [reload]);

  const afterChange = async () => {
    setOpenListing(null);
    await reload();
    await refreshSummary();
  };

  const names = useMemo(
    () => new Map((data?.classmates || []).map((c) => [c.studentId, c.displayName])),
    [data]
  );
  const sellerName = (l) => (l.sellerId ? names.get(l.sellerId) || "Classmate" : "Class Store (Teacher)");

  const myListings = (data?.listings || []).filter((l) => l.sellerId === me);
  const market = useMemo(() => {
    let items = (data?.listings || []).filter((l) => l.sellerId !== me && l.status === "live");
    if (filters.category !== "all") items = items.filter((l) => l.item?.category === filters.category);
    if (filters.seller !== "all") {
      items = items.filter((l) => (filters.seller === "store" ? !l.sellerId : l.sellerId === filters.seller));
    }
    if (filters.type !== "all") items = items.filter((l) => l.saleType === filters.type);
    if (filters.sort === "low") items = [...items].sort((a, b) => currentPrice(a) - currentPrice(b));
    if (filters.sort === "high") items = [...items].sort((a, b) => currentPrice(b) - currentPrice(a));
    return items;
  }, [data, filters, me]);

  const activeBids = (data?.bids || []).filter((b) => b.listingStatus === "live" && b.status === "leading");
  const sellers = (data?.classmates || []).filter((c) => c.studentId !== me);

  const select = (key, options) => (
    <select
      value={filters[key]}
      onChange={(e) => setFilters((f) => ({ ...f, [key]: e.target.value }))}
      className="h-9 rounded-xl border-2 border-slate-200 bg-white px-2 text-sm font-bold text-slate-700"
    >
      {options.map(([value, label]) => (
        <option key={value} value={value}>
          {label}
        </option>
      ))}
    </select>
  );

  if (loading && !data) return <Spinner />;

  return (
    <div>
      <PageTitle>Marketplace</PageTitle>
      <ErrorBanner message={error} />

      {data && (
        <>
          <Section
            title="Selling"
            subtitle="Your items on the marketplace"
            action={
              <div className="flex flex-wrap gap-2">
                <SmallButton tone="primary" onClick={() => setListDialog("commodity")}>
                  <PlusCircle className="w-4 h-4" /> List commodity
                </SmallButton>
                <SmallButton onClick={() => setListDialog("new")}>
                  <PlusCircle className="w-4 h-4" /> List new item
                </SmallButton>
                <Link
                  to="/student/finance"
                  className="inline-flex items-center rounded-xl border-2 border-slate-200 px-3 py-1.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
                >
                  View inventory
                </Link>
              </div>
            }
          >
            {myListings.length === 0 ? (
              <div className="finn-card">
                <Empty>You aren&apos;t selling anything yet. List an item you own to get started.</Empty>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-3">
                {myListings.map((l) => (
                  <div key={l.id} className="finn-card space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-extrabold text-slate-800">{l.item?.name}</p>
                        <p className="text-sm font-bold text-slate-600">
                          {l.saleType === "auction"
                            ? l.highBid
                              ? `Top bid ${formatEdu(l.highBid)} · ${l.bidCount} bid${l.bidCount === 1 ? "" : "s"}`
                              : `Auction from ${formatEdu(l.price)} · no bids yet`
                            : formatEdu(l.price)}
                        </p>
                        {l.endsAt && <p className="text-xs font-bold text-slate-500">{formatTimeLeft(l.endsAt)}</p>}
                      </div>
                      {l.status === "pending_approval" ? (
                        <Pill tone="amber">Waiting for teacher</Pill>
                      ) : (
                        <Pill tone="green">Live</Pill>
                      )}
                    </div>
                    <MyListingActions listing={l} onChanged={afterChange} />
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section title="Bids" subtitle="Updates on bids for your items and items you bid on">
            <div className="grid lg:grid-cols-2 gap-3">
              <div className="finn-card">
                <h4 className="font-extrabold text-slate-700 mb-2">Updates</h4>
                {data.events.length === 0 ? (
                  <Empty>No bid updates yet.</Empty>
                ) : (
                  <ul className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {data.events.map((e) => {
                      const isNew = seenAsNew.current.has(e.id);
                      return (
                        <li
                          key={e.id}
                          className={`rounded-2xl p-2.5 text-sm font-semibold ${
                            isNew ? "bg-sky-50 border-2 border-sky-200 text-slate-800" : "bg-slate-50 text-slate-600"
                          }`}
                        >
                          {isNew && <Pill tone="red">New</Pill>} {EVENT_TEXT[e.kind]?.(e)}
                          <span className="block text-xs text-slate-400 mt-0.5">{timeAgo(e.createdAt)}</span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
              <div className="finn-card">
                <h4 className="font-extrabold text-slate-700 mb-2">My winning bids</h4>
                {activeBids.length === 0 ? (
                  <Empty>You aren&apos;t winning any auctions right now.</Empty>
                ) : (
                  <ul className="space-y-2">
                    {activeBids.map((b) => (
                      <li key={b.id} className="flex items-center justify-between rounded-2xl bg-emerald-50 p-2.5 text-sm font-bold">
                        <span className="text-slate-800">{b.itemName}</span>
                        <span className="text-emerald-700">
                          {formatEdu(b.amount)}
                          {b.endsAt && <span className="block text-xs text-slate-500">{formatTimeLeft(b.endsAt)}</span>}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {summary.held > 0 && (
                  <p className="mt-2 text-xs font-bold text-slate-500">
                    {formatEdu(summary.held)} of your cash is held for these bids.
                  </p>
                )}
              </div>
            </div>
          </Section>

          <Section title="Explore All Listings" subtitle={`Showing ${market.length} active listing${market.length === 1 ? "" : "s"}`}>
            <div className="flex flex-wrap gap-2 mb-3">
              {select("category", [["all", "All categories"], ...Object.entries(CATEGORY_LABELS)])}
              {select("sort", [
                ["newest", "Newest"],
                ["low", "Price: low to high"],
                ["high", "Price: high to low"],
              ])}
              {select("seller", [
                ["all", "All sellers"],
                ["store", "Class Store (Teacher)"],
                ...sellers.map((c) => [c.studentId, c.displayName]),
              ])}
              {select("type", [
                ["all", "Buy now & auctions"],
                ["fixed", "Buy now"],
                ["auction", "Auctions"],
              ])}
            </div>
            {market.length === 0 ? (
              <div className="finn-card">
                <Empty>Nothing on the market matches these filters.</Empty>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {market.map((l) => (
                  <div key={l.id} className="finn-card flex flex-col">
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 shrink-0 rounded-2xl bg-sky-50 flex items-center justify-center">
                        {l.saleType === "auction" ? (
                          <Gavel className="w-6 h-6 text-sky-500" />
                        ) : (
                          <ShoppingBag className="w-6 h-6 text-sky-500" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-extrabold text-slate-800 leading-tight">{l.item?.name}</p>
                        <p className="text-xs font-bold text-slate-500">{sellerName(l)}</p>
                      </div>
                    </div>
                    <p className="mt-3 text-lg font-extrabold text-slate-900">
                      {formatEdu(currentPrice(l))} <span className="text-xs font-bold text-slate-500">EduBucks</span>
                    </p>
                    {l.saleType === "auction" && (
                      <p className="text-xs font-bold text-slate-500">
                        {l.highBid ? `${l.bidCount} bid${l.bidCount === 1 ? "" : "s"}` : "Starting price"}
                        {l.endsAt && ` · ${formatTimeLeft(l.endsAt)}`}
                        {l.highBidderId === me && " · you're winning"}
                      </p>
                    )}
                    <div className="mt-auto pt-3 flex justify-end gap-1.5">
                      <SmallButton onClick={() => setOpenListing({ listing: l, mode: "info" })}>View info</SmallButton>
                      {l.saleType === "auction" ? (
                        <SmallButton tone="primary" onClick={() => setOpenListing({ listing: l, mode: "bid" })}>
                          Bid only
                        </SmallButton>
                      ) : (
                        <SmallButton tone="primary" onClick={() => setOpenListing({ listing: l, mode: "buy" })}>
                          Buy
                        </SmallButton>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>

          <ListItemDialog
            open={Boolean(listDialog)}
            onOpenChange={(open) => !open && setListDialog(null)}
            kind={listDialog || "commodity"}
            holdings={data.holdings}
            onListed={(needsApproval) => {
              toast({
                title: needsApproval ? "Sent to your teacher for approval" : "Your item is live on the marketplace",
              });
              afterChange();
            }}
          />
          <ListingDialog
            listing={openListing?.listing}
            mode={openListing?.mode}
            sellerName={openListing ? sellerName(openListing.listing) : ""}
            summary={summary}
            onClose={() => setOpenListing(null)}
            onDone={afterChange}
          />
        </>
      )}
    </div>
  );
}
