import React, { useEffect, useState } from "react";
import { db } from '@/api/db';
import { useAuth } from "@/lib/AuthContext";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Eye, EyeOff, Lock, Mail, Users, KeyRound } from "lucide-react";
import FinnLogo from "@/components/FinnLogo";
import { toast } from "@/components/ui/use-toast";

function PasswordInput({ id, value, onChange, show, onToggleShow, autoComplete }) {
  return (
    <div className="relative">
      <Input
        id={id}
        type={show ? "text" : "password"}
        value={value}
        onChange={onChange}
        placeholder="••••••••"
        autoComplete={autoComplete}
        className="pr-10"
        required
      />
      <button
        type="button"
        onClick={onToggleShow}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
        aria-label={show ? "Hide password" : "Show password"}
      >
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}

export default function ParentSettings() {
  const {
    user,
    profile,
    refreshProfile,
    logout,
    baseSubscriptionStatus,
    baseSubscriptionPeriodEnd,
    addonSubscriptionStatus,
    addonSubscriptionPeriodEnd,
  } = useAuth();

  const [displayName, setDisplayName] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const [children, setChildren] = useState([]);
  const [loadingChildren, setLoadingChildren] = useState(true);

  const [childPasswordTarget, setChildPasswordTarget] = useState(null);
  const [childNewPassword, setChildNewPassword] = useState("");
  const [childConfirmPassword, setChildConfirmPassword] = useState("");
  const [showChildPassword, setShowChildPassword] = useState(false);
  const [savingChildPassword, setSavingChildPassword] = useState(false);

  const [deletingAccount, setDeletingAccount] = useState(false);
  const [managingBilling, setManagingBilling] = useState(false);

  useEffect(() => {
    setDisplayName(profile?.displayName || "");
  }, [profile]);

  useEffect(() => {
    db.users
      .listMyChildren()
      .then((docs) => setChildren(docs || []))
      .finally(() => setLoadingChildren(false));
  }, []);

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      await db.auth.updateMe({ displayName: displayName.trim() });
      await refreshProfile();
      toast({ title: "Profile updated." });
    } catch (err) {
      toast({ title: "Could not save", description: err.message, variant: "destructive" });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast({ title: "Password too short", description: "Use at least 6 characters.", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Passwords do not match", variant: "destructive" });
      return;
    }
    setSavingPassword(true);
    try {
      await db.auth.changePassword(newPassword);
      setNewPassword("");
      setConfirmPassword("");
      toast({ title: "Password updated." });
    } catch (err) {
      toast({ title: "Could not update password", description: err.message, variant: "destructive" });
    } finally {
      setSavingPassword(false);
    }
  };

  const openChildPasswordDialog = (child) => {
    setChildPasswordTarget(child);
    setChildNewPassword("");
    setChildConfirmPassword("");
    setShowChildPassword(false);
  };

  const handleChangeChildPassword = async (e) => {
    e.preventDefault();
    if (!childPasswordTarget) return;
    if (childNewPassword.length < 6) {
      toast({ title: "Password too short", description: "Use at least 6 characters.", variant: "destructive" });
      return;
    }
    if (childNewPassword !== childConfirmPassword) {
      toast({ title: "Passwords do not match", variant: "destructive" });
      return;
    }
    setSavingChildPassword(true);
    try {
      await db.users.updateChildPassword(childPasswordTarget.uid, childNewPassword);
      toast({ title: `Password updated for @${childPasswordTarget.username}.` });
      setChildPasswordTarget(null);
    } catch (err) {
      toast({ title: "Could not update password", description: err.message, variant: "destructive" });
    } finally {
      setSavingChildPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeletingAccount(true);
    try {
      await db.auth.deleteOwnAccount();
      await logout(true);
    } catch (err) {
      toast({ title: "Could not delete account", description: err.message, variant: "destructive" });
      setDeletingAccount(false);
    }
  };

  const handleManageBilling = async () => {
    setManagingBilling(true);
    try {
      const { url } = await db.billing.createPortalSession();
      window.location.href = url;
    } catch (err) {
      toast({ title: "Could not open billing portal", description: err.message, variant: "destructive" });
      setManagingBilling(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="finn-card">
        <div className="flex items-center gap-3 mb-6">
          <FinnLogo className="w-14 h-14" />
          <div>
            <h1 className="text-2xl font-extrabold text-slate-800">Settings</h1>
            <p className="text-sm text-muted-foreground font-semibold">Manage your account and family.</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="settings-email">Email address</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input id="settings-email" value={user?.email || ""} readOnly disabled className="pl-10 bg-slate-50" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="settings-display-name">Display name</Label>
            <Input
              id="settings-display-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your display name"
            />
          </div>

          <Button onClick={handleSaveProfile} disabled={savingProfile}>
            {savingProfile ? "Saving..." : "Save changes"}
          </Button>
        </div>
      </div>

      <div className="finn-card">
        <div className="flex items-center gap-2 text-slate-700 mb-4">
          <Lock className="w-5 h-5 text-sky-500" />
          <h2 className="font-extrabold">Change password</h2>
        </div>

        <form onSubmit={handleChangePassword} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-password">New password</Label>
            <PasswordInput
              id="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              show={showNewPassword}
              onToggleShow={() => setShowNewPassword((v) => !v)}
              autoComplete="new-password"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm new password</Label>
            <PasswordInput
              id="confirm-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              show={showConfirmPassword}
              onToggleShow={() => setShowConfirmPassword((v) => !v)}
              autoComplete="new-password"
            />
          </div>

          <Button type="submit" disabled={savingPassword}>
            {savingPassword ? "Updating..." : "Update password"}
          </Button>
        </form>
      </div>

      <div className="finn-card">
        <div className="flex items-center gap-2 text-slate-700 mb-4">
          <Users className="w-5 h-5 text-sky-500" />
          <h2 className="font-extrabold">Your kids</h2>
        </div>

        {loadingChildren ? (
          <p className="text-sm text-muted-foreground font-semibold">Loading...</p>
        ) : children.length === 0 ? (
          <p className="text-sm text-muted-foreground font-semibold">No child accounts yet.</p>
        ) : (
          <div className="space-y-3">
            {children.map((child) => (
              <div
                key={child.uid}
                className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3"
              >
                <div>
                  <p className="font-extrabold text-slate-800">{child.displayName}</p>
                  <p className="text-sm text-muted-foreground font-semibold">@{child.username}</p>
                </div>
                <Dialog
                  open={childPasswordTarget?.uid === child.uid}
                  onOpenChange={(open) => (open ? openChildPasswordDialog(child) : setChildPasswordTarget(null))}
                >
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                      <KeyRound className="w-4 h-4" />
                      Change password
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Change password for @{child.username}</DialogTitle>
                      <DialogDescription>
                        Set a new password for {child.displayName}'s account.
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleChangeChildPassword} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="child-new-password">New password</Label>
                        <PasswordInput
                          id="child-new-password"
                          value={childNewPassword}
                          onChange={(e) => setChildNewPassword(e.target.value)}
                          show={showChildPassword}
                          onToggleShow={() => setShowChildPassword((v) => !v)}
                          autoComplete="new-password"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="child-confirm-password">Confirm new password</Label>
                        <PasswordInput
                          id="child-confirm-password"
                          value={childConfirmPassword}
                          onChange={(e) => setChildConfirmPassword(e.target.value)}
                          show={showChildPassword}
                          onToggleShow={() => setShowChildPassword((v) => !v)}
                          autoComplete="new-password"
                        />
                      </div>
                      <DialogFooter>
                        <Button type="submit" disabled={savingChildPassword}>
                          {savingChildPassword ? "Updating..." : "Update password"}
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="finn-card space-y-3">
        <h2 className="text-lg font-extrabold text-slate-800">Billing</h2>
        <p className="text-sm text-muted-foreground font-semibold">
          Your account ($6.99/mo or $49.99/yr) includes your first child free — you're billed separately only for
          additional children.
        </p>
        {baseSubscriptionStatus && (
          <p className="text-sm text-muted-foreground font-semibold">
            Account plan: <span className="capitalize">{baseSubscriptionStatus}</span>
            {baseSubscriptionPeriodEnd &&
              ` · renews ${new Date(baseSubscriptionPeriodEnd).toLocaleDateString()}`}
          </p>
        )}
        {addonSubscriptionStatus && (
          <p className="text-sm text-muted-foreground font-semibold">
            Additional children: <span className="capitalize">{addonSubscriptionStatus}</span>
            {addonSubscriptionPeriodEnd &&
              ` · renews ${new Date(addonSubscriptionPeriodEnd).toLocaleDateString()}`}
          </p>
        )}
        <Button
          type="button"
          variant="outline"
          className="w-full h-14 rounded-2xl font-extrabold text-base"
          onClick={handleManageBilling}
          disabled={managingBilling}
        >
          {managingBilling ? "Redirecting..." : "Manage Billing"}
        </Button>
      </div>

      <div className="finn-card">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              type="button"
              className="w-full h-14 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-extrabold text-base"
            >
              Delete Account
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete your account?</AlertDialogTitle>
              <AlertDialogDescription>
                This permanently deletes your account and every child account in your family, along with all
                transactions, goals, and alerts. This does not cancel your subscription — do that first from
                Manage Billing if you don't want to keep being charged. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-red-600 text-white hover:bg-red-700"
                onClick={handleDeleteAccount}
                disabled={deletingAccount}
              >
                {deletingAccount ? "Deleting..." : "Confirm deletion"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
