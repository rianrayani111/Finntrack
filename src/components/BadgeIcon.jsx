import React from "react";
import { Lock } from "lucide-react";
import { TIERS } from "@/lib/gamification";

export default function BadgeIcon({ icon: Icon, tier, earned = true, size = 64 }) {
  const t = TIERS[tier] || TIERS.starter;
  const iconSize = Math.round(size * 0.46);

  if (!earned) {
    return (
      <div
        style={{ width: size, height: size }}
        className="relative rounded-full flex items-center justify-center bg-slate-200 border-4 border-slate-300"
      >
        <Icon style={{ width: iconSize, height: iconSize }} className="text-slate-400" />
        <div className="absolute -bottom-1 -right-1 bg-slate-400 rounded-full p-1 border-2 border-white">
          <Lock className="w-3 h-3 text-white" />
        </div>
      </div>
    );
  }

  return (
    <div
      style={{ width: size, height: size }}
      className={`rounded-full flex items-center justify-center bg-gradient-to-br ${t.gradient} shadow-md ring-4 ${t.ring}`}
    >
      <Icon style={{ width: iconSize, height: iconSize }} className="text-white drop-shadow" />
    </div>
  );
}
