import { db } from "@/api/db";
import { buildAchievementContext, evaluateBadges } from "@/lib/gamification";

// Recomputes badge eligibility for the current child from their full
// transaction history + profile state, persists any newly-qualified badges
// (and their XP) via the sync_badges RPC, and returns the resulting state.
// Call after any action that could newly satisfy a badge (logging an entry,
// visiting a page whose view-count feeds a badge) — it's cheap and a no-op
// when nothing new was earned.
export async function syncAchievements() {
  const [profile, transactions, badgeRows] = await Promise.all([
    db.users.getMyProfile(),
    db.entities.Transaction.list(),
    db.users.listMyBadges(),
  ]);

  const alreadyEarned = new Set(badgeRows.map((r) => r.badge_key));
  const ctx = buildAchievementContext({ transactions, profile });
  const qualifying = evaluateBadges(ctx, alreadyEarned);
  const newKeys = [...qualifying].filter((k) => !alreadyEarned.has(k));

  if (newKeys.length === 0) {
    return { profile, earnedKeys: alreadyEarned, newlyEarned: [], prevXp: profile.xp, newXp: profile.xp };
  }

  const { totalXp, newlyEarned } = await db.users.syncBadges(newKeys);
  return {
    profile: { ...profile, xp: totalXp },
    earnedKeys: new Set([...alreadyEarned, ...newlyEarned]),
    newlyEarned,
    prevXp: profile.xp,
    newXp: totalXp,
  };
}
