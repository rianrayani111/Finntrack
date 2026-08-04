import React, { useEffect, useState } from "react";
import { db } from '@/api/db';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/AuthContext";
import { LogOut, UserCircle } from "lucide-react";
import FinnLogo from "@/components/FinnLogo";
import { toast } from "@/components/ui/use-toast";
import LevelHeroCard from "@/components/LevelHeroCard";
import AvatarPicker from "@/components/AvatarPicker";

export default function Profile() {
  const { user, profile, logout, refreshProfile } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);
  const [heroProfile, setHeroProfile] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    setDisplayName(profile?.displayName || user?.displayName || "");
  }, [profile, user]);

  useEffect(() => {
    if (profile?.role === 'child') {
      db.users.getMyProfile().then(setHeroProfile).catch(() => {});
    }
  }, [profile?.role]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await db.auth.updateMe({
        displayName: displayName.trim(),
      });
      await refreshProfile();
      toast({ title: "Profile updated." });
    } catch (err) {
      toast({ title: "Could not save", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    logout(true);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {heroProfile && (
        <LevelHeroCard profile={heroProfile} editable onAvatarClick={() => setPickerOpen(true)} />
      )}

      <div className="finn-card">
        <div className="flex items-center gap-3 mb-6">
          <FinnLogo className="w-14 h-14" />
          <div>
            <h1 className="text-2xl font-extrabold text-slate-800">Profile</h1>
            <p className="text-sm text-muted-foreground font-semibold">Keep your account details up to date.</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="displayName">Display Name</Label>
            <Input
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your display name"
            />
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save changes"}
            </Button>
            <Button variant="outline" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              Log out
            </Button>
          </div>
        </div>
      </div>

      <div className="finn-card">
        <div className="flex items-center gap-2 text-slate-700">
          <UserCircle className="w-5 h-5 text-sky-500" />
          <h2 className="font-extrabold">Account info</h2>
        </div>
        <p className="mt-3 text-sm text-muted-foreground font-semibold">
          {profile?.role === 'parent'
            ? `Parent email: ${user?.email || 'Unknown'}`
            : `Kid username: @${profile?.username || user?.username || 'unknown'}`}
        </p>
      </div>

      {heroProfile && (
        <AvatarPicker
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          avatar={heroProfile.avatar}
          onSaved={(avatar) => setHeroProfile((p) => ({ ...p, avatar }))}
        />
      )}
    </div>
  );
}