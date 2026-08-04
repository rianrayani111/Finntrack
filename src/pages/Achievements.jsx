import React, { useEffect, useState } from "react";
import AchievementsPanel from "@/components/AchievementsPanel";
import AvatarPicker from "@/components/AvatarPicker";
import { syncAchievements } from "@/lib/achievementsSync";
import { useCelebrations } from "@/lib/celebrations";

export default function Achievements() {
  const [profile, setProfile] = useState(null);
  const [earnedKeys, setEarnedKeys] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const { celebrateGains } = useCelebrations();

  useEffect(() => {
    let cancelled = false;

    syncAchievements()
      .then(({ profile: nextProfile, earnedKeys: nextEarnedKeys, newlyEarned, prevXp, newXp }) => {
        if (cancelled) return;
        setProfile(nextProfile);
        setEarnedKeys(nextEarnedKeys);
        celebrateGains({ prevXp, newXp, newlyEarnedKeys: newlyEarned });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-4 border-sky-200 border-t-sky-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold text-slate-800">Achievements</h1>
        <p className="text-muted-foreground font-semibold">Badges, XP, and levels for staying on top of your money.</p>
      </div>

      <AchievementsPanel
        profile={profile}
        earnedBadgeKeys={earnedKeys}
        editable
        onAvatarClick={() => setPickerOpen(true)}
      />

      <AvatarPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        avatar={profile?.avatar}
        onSaved={(avatar) => setProfile((p) => ({ ...p, avatar }))}
      />
    </div>
  );
}
