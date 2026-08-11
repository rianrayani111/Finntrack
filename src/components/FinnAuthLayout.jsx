import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Menu, X } from "lucide-react";
import DolphinMascot from "@/components/DolphinMascot";
import FinnLogo from "@/components/FinnLogo";

const NAV_LINKS = [
  { key: "home", label: "Home", path: "/" },
  { key: "about", label: "About Us", path: "/about" },
  { key: "faq", label: "FAQs", path: "/faq" },
  { key: "resources", label: "Resources", path: "/resources" },
];

export default function FinnAuthLayout({ children, showMascot = true, mascotMessage }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 relative overflow-hidden">
      {/* Ocean background */}
      <div className="absolute inset-0 bg-gradient-to-br from-sky-400 via-sky-500 to-cyan-600" />
      <div className="absolute top-0 left-0 w-72 h-72 bg-white/10 rounded-full -translate-x-1/3 -translate-y-1/3 blur-2xl" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-cyan-200/20 rounded-full translate-x-1/3 translate-y-1/3 blur-2xl" />

      {/* Nav links no longer fit next to each other on portrait phones, so
          below `sm` they collapse behind a toggle button instead of squishing. */}
      <div className="absolute top-4 right-4 z-20 sm:top-6 sm:right-6">
        <div className="hidden items-center gap-2 sm:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.key}
              to={link.path}
              className="inline-flex h-10 items-center justify-center rounded-2xl border-2 border-white/40 bg-white/10 px-4 text-sm font-extrabold text-white backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/20"
            >
              {link.label}
            </Link>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border-2 border-white/40 bg-white/10 text-white backdrop-blur-md transition-all duration-200 hover:bg-white/20 sm:hidden"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
        >
          {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>

        {menuOpen && (
          <div className="absolute right-0 mt-2 flex w-44 flex-col gap-1.5 rounded-2xl border-2 border-white/40 bg-sky-600/95 p-2 shadow-xl backdrop-blur-md sm:hidden">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.key}
                to={link.path}
                onClick={() => setMenuOpen(false)}
                className="flex h-10 items-center rounded-xl px-3 text-sm font-extrabold text-white transition-colors hover:bg-white/20"
              >
                {link.label}
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="relative w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 justify-center mb-2">
            <FinnLogo className="w-10 h-10" />
            <h1 className="text-3xl font-extrabold text-white tracking-tight">
              Finn<span className="text-amber-300">Track</span>
            </h1>
          </div>
          <p className="text-sky-50 font-bold text-sm">Helping kids build smart financial habits</p>
        </div>

        {showMascot && (
          <div className="flex justify-center mb-4">
            <DolphinMascot className="w-28 h-28" message={mascotMessage} />
          </div>
        )}

        <div className="bg-white rounded-3xl shadow-2xl p-7">{children}</div>
      </div>
    </div>
  );
}