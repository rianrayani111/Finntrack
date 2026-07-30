import React from "react";
import FinnLogo from "@/components/FinnLogo";

export default function DolphinMascot({ className = "w-32 h-32", message }) {
  return (
    <div className={`flex flex-col items-center ${className}`}>
      <FinnLogo className="w-full h-full" />
      {message && (
        <div className="mt-2 max-w-xs bg-white/95 rounded-2xl px-4 py-2 text-sm text-center text-ocean-700 font-semibold shadow-md relative">
          {message}
          <span className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white rotate-45" />
        </div>
      )}
    </div>
  );
}