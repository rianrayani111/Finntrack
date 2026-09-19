import React, { useCallback, useEffect, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import {
  Award,
  Briefcase,
  LayoutDashboard,
  LineChart,
  LogOut,
  Menu,
  PiggyBank,
  ShoppingCart,
  Store,
  UserCircle,
  Users,
  X,
} from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import FinnLogo from "@/components/FinnLogo";
import { useAuth } from "@/lib/AuthContext";
import { education } from "@/api/education";
import { ErrorBanner, Spinner } from "@/components/student/StudentUI";

const NAV_ITEMS = [
  { key: "dashboard", label: "Dashboard", path: "/student", icon: LayoutDashboard },
  { key: "bank", label: "Bank & Savings", path: "/student/bank", icon: PiggyBank },
  { key: "marketplace", label: "Marketplace", path: "/student/marketplace", icon: Store },
  { key: "jobs", label: "Job Board", path: "/student/jobs", icon: Briefcase },
  { key: "store", label: "Class Store", path: "/student/store", icon: ShoppingCart },
  { key: "finance", label: "Finance", path: "/student/finance", icon: LineChart },
  { key: "class", label: "Class", path: "/student/class", icon: Users },
  { key: "badges", label: "Badges", path: "/student/badges", icon: Award },
  { key: "profile", label: "Profile", path: "/student/profile", icon: UserCircle },
];

function NavLinks({ summary, isActive, onNavigate }) {
  return (
    <nav className="space-y-1.5">
      {NAV_ITEMS.map(({ key, label, path, icon: Icon }) => {
        const active = isActive(path);
        const unread = key === "marketplace" ? summary?.unreadMarketEvents || 0 : 0;
        return (
          <Link
            key={key}
            to={path}
            onClick={onNavigate}
            className={`flex items-center gap-3 rounded-2xl px-4 py-2.5 text-sm font-bold transition ${
              active ? "bg-sky-500 text-white shadow-md" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <Icon className="w-5 h-5" />
            {label}
            {key === "badges" && summary && (
              <span className={active ? "text-white/80" : "text-slate-400"}>({summary.badgesEarned})</span>
            )}
            {unread > 0 && (
              <span className="ml-auto flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-rose-500 text-white text-xs font-extrabold">
                {unread}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

function LogoutButton({ onLogout }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" className="w-full justify-start gap-2 rounded-2xl text-red-600 hover:bg-red-50 hover:text-red-700">
          <LogOut className="w-4 h-4" />
          Log out
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure you want to log out?</AlertDialogTitle>
          <AlertDialogDescription>You will be signed out and returned to the login page.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction className="bg-sky-600 text-white hover:bg-sky-700" onClick={onLogout}>
            Log out
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default function StudentLayout() {
  const location = useLocation();
  const { logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");

  // refreshFirst brings the class up to date (payday, auctions ending) before
  // reading; plain summary reads are enough after the student's own actions.
  const refreshSummary = useCallback(async ({ refreshFirst = false } = {}) => {
    try {
      if (refreshFirst) await education.refresh();
      const next = await education.summary();
      setSummary(next);
      setError("");
      return next;
    } catch (err) {
      setError(err.message || "Could not load your account.");
      return null;
    }
  }, []);

  useEffect(() => {
    refreshSummary({ refreshFirst: true });
  }, [refreshSummary]);

  // Keeps the Marketplace count current as the student moves between pages.
  useEffect(() => {
    if (summary) refreshSummary();
  }, [location.pathname]);

  const isActive = (path) =>
    path === "/student" ? location.pathname === "/student" : location.pathname.startsWith(path);

  const sidebarBrand = (
    <Link to="/student" className="flex items-center gap-3" onClick={() => setMobileOpen(false)}>
      <FinnLogo className="w-12 h-12" />
      <div>
        <h2 className="text-lg font-extrabold text-slate-800">FinnTrack</h2>
        <p className="text-sm text-slate-500">Student Portal</p>
      </div>
    </Link>
  );

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex flex-1">
        <aside className="hidden lg:flex w-72 flex-col border-r border-slate-200 bg-slate-50/80 p-6">
          <div className="mb-8">{sidebarBrand}</div>
          <NavLinks summary={summary} isActive={isActive} />
          <div className="mt-auto pt-6 border-t border-slate-200">
            <LogoutButton onLogout={() => logout()} />
          </div>
        </aside>

        <div className="flex-1 min-w-0">
          <header className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white/80 px-4 py-4 lg:px-6">
            <div className="flex items-center gap-3 min-w-0">
              <Button variant="ghost" size="icon" className="lg:hidden shrink-0" onClick={() => setMobileOpen(true)}>
                <Menu className="w-5 h-5" />
              </Button>
              <div className="min-w-0">
                <h1 className="text-xl font-extrabold text-slate-800 truncate">
                  Welcome back{summary ? `, ${summary.displayName}` : ""}!
                </h1>
                <p className="text-sm font-semibold text-slate-500">Student Portal</p>
              </div>
            </div>
            {summary && (
              <div className="text-right shrink-0">
                <p className="text-sm font-extrabold text-slate-700">{summary.schoolName}</p>
                <p className="text-xs font-bold text-slate-500">
                  Class Code: <span className="tracking-widest text-slate-700">{summary.classCode}</span>
                </p>
              </div>
            )}
          </header>

          <main className="p-4 lg:p-6 max-w-6xl">
            <ErrorBanner message={error} />
            {summary ? <Outlet context={{ summary, refreshSummary }} /> : !error && <Spinner />}
          </main>
        </div>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-slate-900/50 lg:hidden" onClick={() => setMobileOpen(false)}>
          <div className="w-72 h-full bg-white p-4 flex flex-col overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              {sidebarBrand}
              <Button variant="ghost" size="icon" onClick={() => setMobileOpen(false)}>
                <X className="w-5 h-5" />
              </Button>
            </div>
            <NavLinks summary={summary} isActive={isActive} onNavigate={() => setMobileOpen(false)} />
            <div className="mt-auto pt-6 border-t border-slate-200">
              <LogoutButton
                onLogout={() => {
                  setMobileOpen(false);
                  logout();
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
