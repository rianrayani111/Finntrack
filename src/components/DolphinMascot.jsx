import React from "react";
import FinnLogo from "@/components/FinnLogo";

export default function DolphinMascot({ className = "w-32 h-32", message }) {
  return (
    <div className="flex items-center justify-center gap-3">
      <FinnLogo className={className} />
      {message && (
        <div className="max-w-[9.5rem] bg-white/95 rounded-2xl px-3 py-2 text-sm text-center text-ocean-700 font-semibold shadow-md relative">
          {message}
          <span className="absolute top-1/2 -left-1.5 -translate-y-1/2 w-3 h-3 bg-white/95 rotate-45" />
        </div>
      )}
    </div>
  );
}