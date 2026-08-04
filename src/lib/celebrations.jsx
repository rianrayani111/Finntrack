import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import BadgeIcon from "@/components/BadgeIcon";
import { BADGES, TIERS, LEVELS, rankForLevel, getLevelInfo } from "@/lib/gamification";

const CelebrationContext = createContext({ celebrateGains: () => {} });

function CelebrationModal({ event, onClose }) {
  if (!event) return null;
  const isBadge = event.type === "badge";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4 animate-in fade-in-0 duration-150"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full text-center animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {isBadge ? (
          <>
            <div className="flex justify-center mb-4">
              <BadgeIcon icon={event.badge.icon} tier={event.badge.tier} earned size={96} />
            </div>
            <p className="text-lg font-extrabold text-slate-800">{event.badge.title}</p>
            <p className="text-sm text-muted-foreground font-semibold mt-1">{event.badge.description}</p>
            <p className="text-2xl font-extrabold text-fuchsia-600 mt-4">Badge Achieved!</p>
            <p className="text-sm font-bold text-amber-600 mt-1">+{TIERS[event.badge.tier].xp.toLocaleString()} XP</p>
          </>
        ) : (
          <>
            <div className="flex justify-center mb-4">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center shadow-md ring-4 ring-fuchsia-200">
                <Star className="w-11 h-11 text-white fill-white" />
              </div>
            </div>
            <p className="text-lg font-extrabold text-slate-800">Level {event.level} · {event.title}</p>
            <p className="text-sm text-muted-foreground font-semibold mt-1">{event.rank} rank</p>
            <p className="text-2xl font-extrabold text-fuchsia-600 mt-4">Level Up!</p>
          </>
        )}

        <Button
          onClick={onClose}
          className="mt-6 w-full rounded-2xl font-bold bg-sky-500 hover:bg-sky-600"
        >
          Nice!
        </Button>
      </div>
    </div>
  );
}

export function CelebrationProvider({ children }) {
  const [queue, setQueue] = useState([]);

  // Queues one popup per newly-earned badge (in the order given), followed
  // by one popup per level crossed between prevXp and newXp — badges show
  // first since they're usually what caused the level up. XP/badge state is
  // already persisted by the caller before this runs; this only controls
  // what pops up and in what order, one at a time.
  const celebrateGains = useCallback(({ prevXp, newXp, newlyEarnedKeys = [] }) => {
    const events = [];

    newlyEarnedKeys.forEach((key) => {
      const badge = BADGES.find((b) => b.key === key);
      if (badge) events.push({ type: "badge", badge });
    });

    if (typeof prevXp === "number" && typeof newXp === "number" && newXp > prevXp) {
      const fromLevel = getLevelInfo(prevXp).level;
      const toLevel = getLevelInfo(newXp).level;
      for (let lvl = fromLevel + 1; lvl <= toLevel; lvl++) {
        const levelDef = LEVELS.find((l) => l.level === lvl);
        if (levelDef) {
          events.push({ type: "level", level: levelDef.level, title: levelDef.title, rank: rankForLevel(levelDef.level) });
        }
      }
    }

    if (events.length > 0) setQueue((q) => [...q, ...events]);
  }, []);

  const dismissCurrent = useCallback(() => {
    setQueue((q) => q.slice(1));
  }, []);

  const value = useMemo(() => ({ celebrateGains }), [celebrateGains]);

  return (
    <CelebrationContext.Provider value={value}>
      {children}
      <CelebrationModal event={queue[0] || null} onClose={dismissCurrent} />
    </CelebrationContext.Provider>
  );
}

export function useCelebrations() {
  return useContext(CelebrationContext);
}
