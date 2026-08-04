import React from "react";
import { Link } from "react-router-dom";
import DolphinMascot from "@/components/DolphinMascot";
import FinnLogo from "@/components/FinnLogo";

export default function FinnAuthLayout({ children, showMascot = true, mascotMessage }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 relative overflow-hidden">
      {/* Ocean background */}
      <div className="absolute inset-0 bg-gradient-to-br from-sky-400 via-sky-500 to-cyan-600" />
      <div className="absolute top-0 left-0 w-72 h-72 bg-white/10 rounded-full -translate-x-1/3 -translate-y-1/3 blur-2xl" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-cyan-200/20 rounded-full translate-x-1/3 translate-y-1/3 blur-2xl" />

      <div className="absolute top-4 right-4 z-10 flex items-center gap-2 sm:top-6 sm:right-6">
        <Link
          to="/"
          className="inline-flex h-10 items-center justify-center rounded-2xl border-2 border-white/40 bg-white/10 px-4 text-sm font-extrabold text-white backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/20"
        >
          Home
        </Link>
        <Link
          to="/faq"
          className="inline-flex h-10 items-center justify-center rounded-2xl border-2 border-white/40 bg-white/10 px-4 text-sm font-extrabold text-white backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/20"
        >
          FAQs
        </Link>
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