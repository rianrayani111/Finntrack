import React, { useCallback, useEffect, useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { AlertCircle } from "lucide-react";

// Shared building blocks for the student portal pages.

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export const formatEdu = (value) => currency.format(Number(value) || 0);

export const CATEGORY_LABELS = {
  privilege: "Classroom Privilege",
  physical: "Physical Good",
  financial: "Financial Asset",
};

export const ASSET_KIND_LABELS = {
  bond: "Bond",
  venture: "Startup Equity",
  property: "Real Estate",
};

export const itemCategoryLabel = (item) =>
  item?.assetKind ? `${CATEGORY_LABELS.financial} · ${ASSET_KIND_LABELS[item.assetKind]}` : CATEGORY_LABELS[item?.category] || "Item";

export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// Whole days from the class's "today" (YYYY-MM-DD, class timezone) until the
// next payday. 0 means payday is today.
export const daysUntilPayday = (summary) => {
  if (!summary?.today) return null;
  const [y, m, d] = summary.today.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return (summary.paydayDow - dow + 7) % 7;
};

export const paydayText = (summary) => {
  const days = daysUntilPayday(summary);
  if (days === null) return "";
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  return `in ${days} days`;
};

export const formatDate = (value) =>
  value ? new Date(value).toLocaleDateString(undefined, { month: "short", day: "2-digit", year: "numeric" }) : "";

export const formatTimeLeft = (endsAt, now = Date.now()) => {
  const ms = new Date(endsAt).getTime() - now;
  if (ms <= 0) return "ending now";
  const minutes = Math.ceil(ms / 60000);
  if (minutes < 60) return `${minutes}m left`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m left`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h left`;
};

export const formatDuration = (hours) => {
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"}`;
  const days = Math.floor(hours / 24);
  const rest = hours % 24;
  return `${days} day${days === 1 ? "" : "s"}${rest ? ` ${rest}h` : ""}`;
};

export const ordinal = (n) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
};

// The portal layout loads the student's summary once and shares it (plus a
// refresher, for after anything that moves money) with every page.
export const useStudent = () => useOutletContext();

// Loads data for a page and exposes a reload. Ignores results from a load
// that was superseded by a newer one.
export function useLoad(loader, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: "" });
  const latest = useRef(0);

  const reload = useCallback(async () => {
    const id = ++latest.current;
    try {
      const data = await loader();
      if (id === latest.current) setState({ data, loading: false, error: "" });
      return data;
    } catch (error) {
      if (id === latest.current) {
        setState((prev) => ({ ...prev, loading: false, error: error.message || "Something went wrong." }));
      }
      return null;
    }
  }, deps);

  useEffect(() => {
    reload();
  }, [reload]);

  return { ...state, reload };
}

export function PageTitle({ children }) {
  return <h2 className="text-2xl font-extrabold text-slate-800">{children}</h2>;
}

export function ChipRow({ children }) {
  return <div className="flex flex-wrap gap-2 mt-3">{children}</div>;
}

export function Chip({ label, value, tone = "sky" }) {
  const tones = {
    sky: "bg-sky-50 border-sky-100 text-sky-800",
    green: "bg-emerald-50 border-emerald-100 text-emerald-800",
    amber: "bg-amber-50 border-amber-100 text-amber-800",
    slate: "bg-slate-50 border-slate-200 text-slate-700",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-2xl border-2 px-3 py-1.5 text-sm font-bold ${tones[tone]}`}>
      <span className="opacity-70">{label}:</span>
      <span className="font-extrabold">{value}</span>
    </span>
  );
}

export function Section({ title, subtitle, action, children, className = "" }) {
  return (
    <section className={`mt-6 ${className}`}>
      <div className="flex flex-wrap items-end justify-between gap-2 mb-2">
        <div>
          <h3 className="text-lg font-extrabold text-slate-700">{title}</h3>
          {subtitle && <p className="text-xs font-semibold text-slate-500">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function StatusDot({ tone = "green", children }) {
  const dots = {
    green: "bg-emerald-400",
    red: "bg-rose-400",
    amber: "bg-amber-400",
    sky: "bg-sky-400",
    slate: "bg-slate-300",
  };
  return (
    <span className="inline-flex items-center gap-1.5 font-bold text-slate-700">
      <span className={`w-2.5 h-2.5 rounded-full ${dots[tone]}`} />
      {children}
    </span>
  );
}

export function Pill({ tone = "sky", children }) {
  const tones = {
    sky: "bg-sky-100 text-sky-700",
    green: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-700",
    red: "bg-rose-100 text-rose-700",
    slate: "bg-slate-100 text-slate-600",
  };
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-extrabold ${tones[tone]}`}>{children}</span>;
}

export function Spinner() {
  return (
    <div className="flex justify-center py-16">
      <div className="w-8 h-8 border-4 border-sky-200 border-t-sky-600 rounded-full animate-spin" />
    </div>
  );
}

export function ErrorBanner({ message }) {
  if (!message) return null;
  return (
    <div role="alert" className="mt-4 p-3 rounded-2xl border border-red-300 bg-red-50 text-red-600 text-sm font-bold flex gap-2">
      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
      {message}
    </div>
  );
}

export function Empty({ children }) {
  return <p className="text-sm font-semibold text-slate-500 py-4 text-center">{children}</p>;
}

export function SmallButton({ tone = "outline", className = "", ...props }) {
  const tones = {
    outline: "border-2 border-slate-200 text-slate-700 hover:bg-slate-50",
    primary: "bg-sky-500 text-white hover:bg-sky-600 border-2 border-sky-500",
    danger: "border-2 border-rose-200 text-rose-600 hover:bg-rose-50",
    green: "bg-emerald-500 text-white hover:bg-emerald-600 border-2 border-emerald-500",
  };
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-bold transition disabled:opacity-50 disabled:cursor-not-allowed ${tones[tone]} ${className}`}
      {...props}
    />
  );
}

// Money-safe parse of an amount typed by the student: returns a number with
// at most two decimals, or NaN.
export const parseAmount = (text) => {
  const trimmed = String(text ?? "").trim().replace(/^\$/, "");
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return NaN;
  return Number(trimmed);
};
