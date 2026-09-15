import { db } from "@/api/db";

// Badge eligibility is computed server-side (finn_evaluate_badges, migration
// 0026) from the child's own data -- this just triggers that recompute,
// persists whatever's newly earned, and returns the resulting state for the
// UI to render/celebrate. Call after any action that could newly satisfy a
// badge (logging an entry, visiting a page whose view-count feeds a badge)
// -- it's cheap and a no-op when nothing new was earned.
export async function syncAchievements() {
  const [profile, badgeRows] = await Promise.all([
    db.users.getMyProfile(),
    db.users.listMyBadges(),
  ]);

  const alreadyEarned = new Set(badgeRows.map((r) => r.badge_key));
  const { totalXp, newlyEarned } = await db.users.syncBadges();

  return {
    profile: { ...profile, xp: totalXp },
    earnedKeys: new Set([...alreadyEarned, ...newlyEarned]),
    newlyEarned,
    prevXp: profile.xp,
    newXp: totalXp,
  };
}
