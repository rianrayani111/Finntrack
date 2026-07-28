import React, { useEffect, useState } from "react";
import { db } from '@/api/base44Client';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/AuthContext";
import { LogOut, UserCircle, Mail, Phone } from "lucide-react";
import DolphinMascot from "@/components/DolphinMascot";
import { toast } from "@/components/ui/use-toast";

export default function Profile() {
  const { user, logout } = useAuth();
  const [username, setUsername] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setUsername(user?.data?.username || user?.username || "");
    setParentEmail(user?.data?.parent_email || "");
    setParentPhone(user?.data?.parent_phone || "");
  }, [user]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await db.auth.updateMe({
        username: username.trim(),
        parent_email: parentEmail.trim(),
        parent_phone: parentPhone.trim(),
      });
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
      <div className="finn-card">
        <div className="flex items-center gap-3 mb-6">
          <DolphinMascot className="w-14 h-14" />
          <div>
            <h1 className="text-2xl font-extrabold text-slate-800">Profile</h1>
            <p className="text-sm text-muted-foreground font-semibold">Keep your account details up to date.</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Your display name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="parentEmail">Parent / Guardian Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="parentEmail"
                value={parentEmail}
                onChange={(e) => setParentEmail(e.target.value)}
                placeholder="you@example.com"
                className="pl-10"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="parentPhone">Parent / Guardian Phone</Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="parentPhone"
                value={parentPhone}
                onChange={(e) => setParentPhone(e.target.value)}
                placeholder="(555) 123-4567"
                className="pl-10"
              />
            </div>
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
          {user?.email || user?.data?.email || "Signed in locally in this browser."}
        </p>
      </div>
    </div>
  );
}