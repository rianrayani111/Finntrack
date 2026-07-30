import React, { useState } from "react";
import { db } from '@/api/base44Client';
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";

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
import {
  LayoutDashboard,
  PlusCircle,
  CalendarRange,
  History,
  Target,
  UserCircle,
  Menu,
  X,
  LogOut,
} from "lucide-react";
import FinnLogo from "@/components/FinnLogo";

const NAV_ITEMS = [
  { label: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
  { label: "Log Withdrawal", path: "/add", icon: PlusCircle },
  { label: "Monthly Summary", path: "/summary", icon: CalendarRange },
  { label: "Transaction History", path: "/history", icon: History },
  { label: "Goals", path: "/goals", icon: Target },
  { label: "Profile", path: "/profile", icon: UserCircle },
];

export default function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (path) =>
    path === "/dashboard" ? location.pathname === "/dashboard" : location.pathname.startsWith(path);

  const handleLogout = async () => {
    await db.auth.logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex flex-1">
        <aside className="hidden lg:flex w-72 flex-col border-r border-slate-200 bg-slate-50/80 p-6">
          <div className="flex items-center gap-3 mb-8">
            <FinnLogo className="w-14 h-14" />
            <div>
              <h2 className="text-lg font-extrabold text-slate-800">FinnTrack</h2>
              <p className="text-sm text-slate-500">Budgeting made simple</p>
            </div>
          </div>

          <nav className="space-y-2">
            {NAV_ITEMS.map(({ label, path, icon: Icon }) => (
              <Link
                key={path}
                to={path}
                className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold transition ${
                  isActive(path)
                    ? "bg-sky-500 text-white shadow-md"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <Icon className="w-5 h-5" />
                {label}
              </Link>
            ))}
          </nav>

          <div className="mt-auto pt-6 border-t border-slate-200">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-2 rounded-2xl text-red-600 hover:bg-red-50 hover:text-red-700"
                >
                  <LogOut className="w-4 h-4" />
                  Logout
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure you want to log out?</AlertDialogTitle>
                  <AlertDialogDescription>
                    You will be signed out and returned to the login page.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-sky-600 text-white hover:bg-sky-700"
                    onClick={handleLogout}
                  >
                    Logout
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </aside>

        <div className="flex-1">
          <header className="flex items-center justify-between border-b border-slate-200 bg-white/80 px-4 py-4 lg:px-6">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                onClick={() => setMobileOpen(true)}
              >
                <Menu className="w-5 h-5" />
              </Button>
              <div>
                <p className="text-sm font-semibold text-slate-500">Hello, friend</p>
                <h1 className="text-xl font-extrabold text-slate-800">Keep growing your savings</h1>
              </div>
            </div>
          </header>

          <main className="p-4 lg:p-6">
            <Outlet />
          </main>
        </div>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-slate-900/50 lg:hidden" onClick={() => setMobileOpen(false)}>
          <div className="w-72 h-full bg-white p-4 flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <FinnLogo className="w-12 h-12" />
                <div>
                  <h2 className="font-extrabold text-slate-800">FinnTrack</h2>
                  <p className="text-sm text-slate-500">Budgeting made simple</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setMobileOpen(false)}>
                <X className="w-5 h-5" />
              </Button>
            </div>

            <nav className="space-y-2">
              {NAV_ITEMS.map(({ label, path, icon: Icon }) => (
                <Link
                  key={path}
                  to={path}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold transition ${
                    isActive(path)
                      ? "bg-sky-500 text-white shadow-md"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {label}
                </Link>
              ))}
            </nav>

            <div className="mt-auto pt-6 border-t border-slate-200">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-2 rounded-2xl text-red-600 hover:bg-red-50 hover:text-red-700"
                  >
                    <LogOut className="w-4 h-4" />
                    Logout
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure you want to log out?</AlertDialogTitle>
                    <AlertDialogDescription>
                      You will be signed out and returned to the login page.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-sky-600 text-white hover:bg-sky-700"
                      onClick={async () => {
                        setMobileOpen(false);
                        await handleLogout();
                      }}
                    >
                      Logout
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
