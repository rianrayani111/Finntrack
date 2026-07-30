import React from "react";
import finnLogo from "@/assets/finn-logo.png";

export default function FinnLogo({ className = "w-32 h-32" }) {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <img src={finnLogo} alt="FinnTrack logo" className="block w-full h-full object-contain" />
    </div>
  );
}