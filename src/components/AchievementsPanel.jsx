import React from "react";
import { Trophy } from "lucide-react";
import BadgeIcon from "@/components/BadgeIcon";
import LevelHeroCard from "@/components/LevelHeroCard";
import { BADGES, TIERS, TIER_ORDER, totalBadgeXp } from "@/lib/gamification";

function TierGroup({ tier, badges, earned }) {
  if (badges.length === 0) return null;
  const t = TIERS[tier];
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className={`text-xs font-extrabold uppercase tracking-wide px-2.5 py-1 rounded-full ${t.chip}`}>
          {t.label}
        </span>
        <span className="text-xs font-semibold text-muted-foreground">{t.xp} XP each</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {badges.map((b) => (
          <div
            key={b.key}
            className={`rounded-2xl p-3 flex flex-col items-center text-center gap-2 border ${
              earned ? "bg-white border-border shadow-sm" : "bg-slate-50 border-slate-100"
            }`}
          >
            <BadgeIcon icon={b.icon} tier={b.tier} earned={earned} size={56} />
            <div>
              <p className={`text-xs font-extrabold ${earned ? "text-slate-800" : "text-slate-500"}`}>{b.title}</p>
              <p className="text-[11px] text-muted-foreground font-semibold mt-0.5">{b.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AchievementsPanel({
  profile,
  earnedBadgeKeys,
  editable = false,
  onAvatarClick,
}) {
  const earnedBadges = BADGES.filter((b) => earnedBadgeKeys.has(b.key));
  const remainingBadges = BADGES.filter((b) => !earnedBadgeKeys.has(b.key));

  return (
    <div className="space-y-6">
      <LevelHeroCard profile={profile} editable={editable} onAvatarClick={onAvatarClick} />

      {/* Badges earned */}
      <div className="finn-card">
        <div className="flex items-center gap-2 mb-4">
          <Trophy className="w-5 h-5 text-amber-500" />
          <h2 className="font-extrabold text-slate-800">
            Badges Earned <span className="text-muted-foreground font-semibold">({earnedBadges.length} of {BADGES.length})</span>
          </h2>
        </div>
        {earnedBadges.length === 0 ? (
          <p className="text-sm text-muted-foreground font-semibold py-4 text-center">
            No badges yet — log an entry to earn your first one!
          </p>
        ) : (
          <div className="space-y-6">
            {TIER_ORDER.map((tier) => (
              <TierGroup key={tier} tier={tier} badges={earnedBadges.filter((b) => b.tier === tier)} earned />
            ))}
          </div>
        )}
      </div>

      {/* Badges remaining */}
      <div className="finn-card">
        <h2 className="font-extrabold text-slate-800 mb-4">
          Badges Remaining <span className="text-muted-foreground font-semibold">({remainingBadges.length} of {BADGES.length})</span>
        </h2>
        {remainingBadges.length === 0 ? (
          <p className="text-sm text-muted-foreground font-semibold py-4 text-center">
            Every badge earned — incredible work! 🏆
          </p>
        ) : (
          <div className="space-y-6">
            {TIER_ORDER.map((tier) => (
              <TierGroup key={tier} tier={tier} badges={remainingBadges.filter((b) => b.tier === tier)} earned={false} />
            ))}
          </div>
        )}
      </div>

      <p className="text-center text-xs text-muted-foreground font-semibold">
        {totalBadgeXp().toLocaleString()} XP available from badges, plus XP from everyday logging.
      </p>
    </div>
  );
}
