import React, { useEffect, useState } from "react";
import { db } from "@/api/db";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import FinnLogo from "@/components/FinnLogo";
import { toast } from "@/components/ui/use-toast";
import { Lock } from "lucide-react";

const BASE_INTERVALS = [
  { value: "month", label: "Monthly", price: "$6.99", priceSuffix: "billed monthly" },
  { value: "year", label: "Annual", price: "$49.99", priceSuffix: "billed annually", badge: "Save over 40%" },
];

const ADDON_INTERVALS = [
  { value: "month", label: "Monthly", price: "$3.99", priceSuffix: "billed monthly" },
  { value: "year", label: "Annual", price: "$19.99", priceSuffix: "billed annually", badge: "Save over 55%" },
];

export default function SubscriptionRequired() {
  const { role, baseSubscriptionStatus, addonSubscriptionStatus, refreshSubscription, logout } = useAuth();
  const [interval, setInterval] = useState("month");
  const [redirecting, setRedirecting] = useState(false);
  // A parent may land here right after a checkout redirect, before the Stripe
  // webhook has finished updating our DB. Until the poll below either lifts
  // the gate (subscription goes active) or exhausts its attempts, show a
  // neutral "confirming" state instead of the lapsed-subscription screen —
  // otherwise someone who just paid briefly sees "update your billing
  // details" for a subscription that hasn't finished syncing yet.
  const [checkoutProcessing, setCheckoutProcessing] = useState(
    () => new URLSearchParams(window.location.search).get("checkout") === "success"
  );

  const needsBase = baseSubscriptionStatus !== "active";

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") !== "success") return;

    let cancelled = false;
    let attempts = 0;
    const poll = async () => {
      if (cancelled) return;
      attempts += 1;
      await refreshSubscription();
      if (cancelled) return;
      if (attempts >= 10) {
        setCheckoutProcessing(false);
        return;
      }
      setTimeout(poll, 1500);
    };
    poll();
    return () => {
      cancelled = true;
    };
  }, []);

  const relevantStatus = needsBase ? baseSubscriptionStatus : addonSubscriptionStatus;
  const hasLapsedSubscription = relevantStatus != null && !checkoutProcessing;

  const handleSubscribe = async () => {
    setRedirecting(true);
    try {
      const { url } = await db.billing.createCheckoutSession(interval, undefined, needsBase ? "base" : "addon");
      window.location.href = url;
    } catch (err) {
      toast({ title: "Could not start checkout", description: err.message, variant: "destructive" });
      setRedirecting(false);
    }
  };

  const handleManageBilling = async () => {
    setRedirecting(true);
    try {
      const { url } = await db.billing.createPortalSession();
      window.location.href = url;
    } catch (err) {
      toast({ title: "Could not open billing portal", description: err.message, variant: "destructive" });
      setRedirecting(false);
    }
  };

  if (role === "child") {
    return (
      <div className="fixed inset-0 flex items-center justify-center p-6">
        <div className="finn-card max-w-md w-full text-center space-y-4">
          <FinnLogo className="w-16 h-16 mx-auto" />
          <Lock className="w-8 h-8 mx-auto text-slate-400" />
          <h1 className="text-xl font-extrabold text-slate-800">Ask your parent for help</h1>
          <p className="text-sm text-muted-foreground font-semibold">
            Your family's FinnTrack subscription needs attention. Ask a parent to fix billing to get back in.
          </p>
          <Button variant="outline" className="w-full" onClick={() => logout()}>
            Log out
          </Button>
        </div>
      </div>
    );
  }

  if (checkoutProcessing) {
    return (
      <div className="fixed inset-0 flex items-center justify-center p-6">
        <div className="finn-card max-w-md w-full text-center space-y-4">
          <FinnLogo className="w-16 h-16 mx-auto" />
          <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin mx-auto"></div>
          <h1 className="text-xl font-extrabold text-slate-800">Confirming your subscription…</h1>
          <p className="text-sm text-muted-foreground font-semibold">
            This should only take a few seconds.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center p-6">
      <div className="finn-card max-w-md w-full text-center space-y-6">
        <FinnLogo className="w-16 h-16 mx-auto" />
        {hasLapsedSubscription ? (
          <>
            <h1 className="text-xl font-extrabold text-slate-800">Your subscription needs attention</h1>
            <p className="text-sm text-muted-foreground font-semibold">
              Update your billing details to keep FinnTrack running for your family.
            </p>
            <Button
              type="button"
              className="w-full h-14 rounded-2xl font-extrabold text-base"
              onClick={handleManageBilling}
              disabled={redirecting}
            >
              {redirecting ? "Redirecting..." : "Update billing"}
            </Button>
          </>
        ) : (
          <>
            <h1 className="text-xl font-extrabold text-slate-800">Subscription required</h1>
            <p className="text-sm text-muted-foreground font-semibold">
              {needsBase
                ? "FinnTrack includes your first child free. Additional children are billed separately."
                : "An active subscription is required to keep using FinnTrack with more than one child."}
            </p>
            <div className="grid grid-cols-2 gap-3">
              {(needsBase ? BASE_INTERVALS : ADDON_INTERVALS).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setInterval(opt.value)}
                  className={`relative flex flex-col items-center justify-center gap-0.5 rounded-2xl border-2 py-3 font-bold transition-colors ${
                    interval === opt.value
                      ? "border-slate-800 bg-slate-800 text-white"
                      : "border-slate-200 text-slate-600"
                  }`}
                >
                  {opt.badge && (
                    <span className="absolute -top-2.5 inset-x-0 flex justify-center">
                      <span className="whitespace-nowrap rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-extrabold text-white">
                        {opt.badge}
                      </span>
                    </span>
                  )}
                  <span>{opt.label}</span>
                  <span
                    className={`text-xs font-semibold ${
                      interval === opt.value ? "text-slate-300" : "text-slate-400"
                    }`}
                  >
                    {opt.price} · {opt.priceSuffix}
                  </span>
                </button>
              ))}
            </div>
            <Button
              type="button"
              className="w-full h-14 rounded-2xl font-extrabold text-base"
              onClick={handleSubscribe}
              disabled={redirecting}
            >
              {redirecting ? "Redirecting..." : "Subscribe"}
            </Button>
          </>
        )}
        <Button variant="ghost" className="w-full" onClick={() => logout()}>
          Log out
        </Button>
      </div>
    </div>
  );
}
