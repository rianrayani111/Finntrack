import React from "react";
import { Pencil, Star } from "lucide-react";
import AvatarPreview from "@/components/AvatarPreview";
import { getLevelInfo } from "@/lib/gamification";

// Profile + avatar + level + XP bar, in one box with its own gradient
// (distinct from the sky-blue balance/streak card). Shared by the
// Achievements page and the student's Profile page so both show identical,
// always-in-sync level info.
export default function LevelHeroCard({ profile, editable = false, onAvatarClick }) {
  const avatar = profile?.avatar || {};
  const levelInfo = getLevelInfo(profile?.xp || 0);

  return (
    <div className="bg-gradient-to-br from-violet-500 via-fuchsia-600 to-purple-700 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
      <div className="absolute -right-8 -top-8 w-40 h-40 bg-white/10 rounded-full" />
      <div className="absolute left-10 -bottom-10 w-28 h-28 bg-white/10 rounded-full" />

      <div className="relative flex flex-col sm:flex-row items-center sm:items-start gap-5">
        <button
          type="button"
          onClick={editable ? onAvatarClick : undefined}
          disabled={!editable}
          className={`relative shrink-0 bg-white/15 rounded-full p-2 ring-4 ring-white/30 ${editable ? "cursor-pointer hover:ring-white/60 transition" : ""}`}
          aria-label={editable ? "Change avatar" : "Avatar"}
        >
          <AvatarPreview {...avatar} size={96} />
          {editable && (
            <span className="absolute -bottom-1 -right-1 bg-white text-fuchsia-600 rounded-full p-1.5 shadow-md">
              <Pencil className="w-3.5 h-3.5" />
            </span>
          )}
        </button>

        <div className="flex-1 text-center sm:text-left w-full">
          <p className="text-lg font-extrabold">{profile?.displayName || "Your Achievements"}</p>
          <div className="flex items-center justify-center sm:justify-start gap-2 mt-1">
            <Star className="w-5 h-5 fill-yellow-300 text-yellow-300" />
            <span className="text-2xl font-extrabold">Level {levelInfo.level}</span>
            <span className="text-sm font-bold opacity-90">· {levelInfo.title}</span>
          </div>
          <p className="text-xs font-bold uppercase tracking-wide opacity-80 mt-0.5">{levelInfo.rank} rank</p>

          <div className="mt-4">
            {levelInfo.isMax ? (
              <p className="text-sm font-bold opacity-90">Max level reached! 🎉</p>
            ) : (
              <p className="text-sm font-bold opacity-90 mb-1.5">
                {levelInfo.xpRemaining.toLocaleString()} XP to Level {levelInfo.level + 1}
              </p>
            )}
            <div className="h-3 w-full bg-white/25 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-all"
                style={{ width: `${levelInfo.progressPct}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
