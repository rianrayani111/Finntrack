import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Menu, X } from "lucide-react";
import FinnLogo from "@/components/FinnLogo";

const NAV_LINKS = [
  { key: "home", label: "Home", path: "/" },
  { key: "about", label: "About Us", path: "/about" },
  { key: "faq", label: "FAQs", path: "/faq" },
  { key: "resources", label: "Resources", path: "/resources" },
];

// Shared marketing-site header used by Home, About, FAQ, Resources, and
// ResourceArticle. Below `lg` the nav links no longer fit next to the logo
// without squishing on portrait phones, so they collapse into a dropdown.
export default function PublicHeader({ active }) {
  const [open, setOpen] = useState(false);
  const links = NAV_LINKS.filter((link) => link.key !== active);

  return (
    <header className="w-full px-4 pt-5 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-6xl rounded-3xl border border-white/45 bg-white/70 shadow-lg backdrop-blur-md">
        <div className="flex items-center justify-between px-4 py-3 sm:px-6">
          <Link to="/" className="inline-flex items-center gap-2" aria-label="FinnTrack home">
            <FinnLogo className="h-10 w-10" />
            <span className="text-xl font-black tracking-tight text-slate-800">
              Finn<span className="text-amber-500">Track</span>
            </span>
          </Link>

          <div className="hidden items-center gap-3 lg:flex">
            {links.map((link) => (
              <Link
                key={link.key}
                to={link.path}
                className="inline-flex h-12 items-center justify-center rounded-2xl border-2 border-sky-200 bg-white px-5 text-base font-extrabold text-sky-700 transition-all duration-200 hover:-translate-y-0.5 hover:border-sky-300"
              >
                {link.label}
              </Link>
            ))}
            <Link
              to="/login"
              className="inline-flex h-12 items-center justify-center rounded-2xl bg-sky-500 px-6 text-base font-extrabold text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-sky-600"
            >
              Login
            </Link>
          </div>

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border-2 border-sky-200 bg-white text-sky-700 transition-colors hover:border-sky-300 lg:hidden"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {open && (
          <div className="flex flex-col gap-2 border-t border-slate-200/70 px-4 pb-4 pt-3 lg:hidden">
            {links.map((link) => (
              <Link
                key={link.key}
                to={link.path}
                onClick={() => setOpen(false)}
                className="flex h-12 items-center rounded-2xl border-2 border-sky-200 bg-white px-5 text-base font-extrabold text-sky-700 transition-colors hover:border-sky-300"
              >
                {link.label}
              </Link>
            ))}
            <Link
              to="/login"
              onClick={() => setOpen(false)}
              className="flex h-12 items-center justify-center rounded-2xl bg-sky-500 px-6 text-base font-extrabold text-white transition-colors hover:bg-sky-600"
            >
              Login
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
