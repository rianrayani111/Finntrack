import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import usePageMeta from "@/hooks/usePageMeta";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";
import { db } from "@/api/db";
import { education } from "@/api/education";
import {
  Chip,
  ChipRow,
  ErrorBanner,
  PageTitle,
  Section,
  SmallButton,
  Spinner,
  parseAmount,
  useLoad,
  useStudent,
} from "@/components/student/StudentUI";

const AVATARS = ["🦁", "🐯", "🐻", "🐼", "🦊", "🐨", "🐸", "🐵", "🦄", "🐬", "🦈", "🐙", "🦉", "🐢", "🚀", "⚡"];
const SLOT_COUNT = 4;
const MIN_PASSWORD_LENGTH = 8;

const formFromSummary = (summary) => ({
  displayName: summary.displayName || "",
  avatarEmoji: summary.avatarEmoji || AVATARS[0],
  quote: summary.quote || "",
  savingsGoalAmount: summary.savingsGoalAmount ? summary.savingsGoalAmount.toFixed(2) : "",
  savingsGoalName: summary.savingsGoalName || "",
  showHoldings: summary.showHoldings,
  pinned: Array.from({ length: SLOT_COUNT }, (_, i) => summary.pinnedBadges?.[i] || ""),
});

function ChangePassword() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password.length < MIN_PASSWORD_LENGTH) return setError(`Use at least ${MIN_PASSWORD_LENGTH} characters.`);
    if (password !== confirm) return setError("The passwords don't match.");
    setError("");
    setBusy(true);
    try {
      await db.auth.changePassword(password);
      setPassword("");
      setConfirm("");
      toast({ title: "Password changed" });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <p className="font-bold text-slate-700">Change password</p>
      <div className="grid sm:grid-cols-2 gap-2">
        <Input
          type="password"
          autoComplete="new-password"
          placeholder="New password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="h-10 rounded-2xl border-2"
        />
        <Input
          type="password"
          autoComplete="new-password"
          placeholder="Confirm new password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="h-10 rounded-2xl border-2"
        />
      </div>
      {error && <p className="text-sm font-bold text-rose-600">{error}</p>}
      <SmallButton type="submit" tone="primary" disabled={busy || !password}>
        {busy && <Loader2 className="w-4 h-4 animate-spin" />}
        Update password
      </SmallButton>
    </form>
  );
}

export default function StudentProfile() {
  usePageMeta("Profile", "Your student profile and settings.", "/student/profile");
  const { summary, refreshSummary } = useStudent();
  const [form, setForm] = useState(() => formFromSummary(summary));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const { data: badges, loading } = useLoad(() => education.badges(), []);

  useEffect(() => {
    setForm(formFromSummary(summary));
  }, [summary]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const earned = (badges || []).filter((b) => b.earnedAt);

  const handleSave = async () => {
    const goalText = form.savingsGoalAmount.trim();
    const goalAmount = goalText ? parseAmount(goalText) : null;
    if (goalText && !(goalAmount > 0)) return setError("Enter your savings target in dollars and cents, like 200.00.");
    const pinned = form.pinned.filter(Boolean);
    if (new Set(pinned).size !== pinned.length) return setError("Each badge can only be pinned once.");
    setError("");
    setSaving(true);
    try {
      await education.updateProfile({
        displayName: form.displayName,
        avatarEmoji: form.avatarEmoji,
        quote: form.quote,
        savingsGoalName: form.savingsGoalName,
        savingsGoalAmount: goalAmount,
        showHoldings: form.showHoldings,
        pinnedBadges: pinned,
      });
      await refreshSummary();
      toast({ title: "Profile saved" });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const fieldClass = "h-10 rounded-2xl border-2";

  return (
    <div>
      <PageTitle>My Profile &amp; Account Settings</PageTitle>
      <ChipRow>
        <Chip label="Student ID" value={summary.studentNumber ? `#${summary.studentNumber}` : "—"} />
        <Chip label="Username" value={summary.username} tone="slate" />
      </ChipRow>

      <Section title="Public Profile Customization" subtitle="Your classmates see this on the Class page.">
        <div className="finn-card grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="display-name" className="font-bold text-slate-700">Display name</Label>
            <Input id="display-name" maxLength={40} value={form.displayName} onChange={set("displayName")} className={fieldClass} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="avatar" className="font-bold text-slate-700">Avatar / icon</Label>
            <select
              id="avatar"
              value={form.avatarEmoji}
              onChange={set("avatarEmoji")}
              className="w-full h-10 rounded-2xl border-2 border-input bg-white px-3 text-lg"
            >
              {AVATARS.map((emoji) => (
                <option key={emoji} value={emoji}>
                  {emoji}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="quote" className="font-bold text-slate-700">Public quote</Label>
            <Input id="quote" maxLength={120} value={form.quote} onChange={set("quote")} className={fieldClass} placeholder="Saving for the deed" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="goal-amount" className="font-bold text-slate-700">Target savings (EduBucks)</Label>
            <Input id="goal-amount" inputMode="decimal" value={form.savingsGoalAmount} onChange={set("savingsGoalAmount")} className={fieldClass} placeholder="200.00" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="goal-name" className="font-bold text-slate-700">Goal name</Label>
            <Input id="goal-name" maxLength={60} value={form.savingsGoalName} onChange={set("savingsGoalName")} className={fieldClass} placeholder="Desk Property Deed" />
          </div>
        </div>
      </Section>

      <Section title="Pinned Badges" subtitle="Shown on your public card.">
        <div className="finn-card">
          {loading ? (
            <Spinner />
          ) : (
            <>
              <div className="grid sm:grid-cols-2 gap-3">
                {form.pinned.map((value, i) => (
                  <div key={i} className="space-y-1.5">
                    <Label htmlFor={`slot-${i}`} className="font-bold text-slate-700">Slot {i + 1}</Label>
                    <select
                      id={`slot-${i}`}
                      value={value}
                      disabled={earned.length === 0}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, pinned: f.pinned.map((p, j) => (j === i ? e.target.value : p)) }))
                      }
                      className="w-full h-10 rounded-2xl border-2 border-input bg-white px-3 text-sm font-semibold disabled:opacity-60"
                    >
                      <option value="">None</option>
                      {earned.map((b) => (
                        <option key={b.key} value={b.key}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              {earned.length === 0 && (
                <p className="mt-2 text-xs font-semibold text-slate-500">Earn badges to pin them here.</p>
              )}
            </>
          )}
        </div>
      </Section>

      <Section title="Privacy & Display Preferences">
        <div className="finn-card space-y-2 text-sm font-semibold text-slate-700">
          <p className="font-bold">Public holdings:</p>
          {[
            [true, "Show my item names and values to classmates"],
            [false, "Hide my holdings from classmates"],
          ].map(([value, label]) => (
            <label key={String(value)} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="show-holdings"
                checked={form.showHoldings === value}
                onChange={() => setForm((f) => ({ ...f, showHoldings: value }))}
                className="accent-sky-500"
              />
              {label}
            </label>
          ))}
          <p className="text-xs text-slate-500">
            Your name, rank and net worth always show on the class leaderboard.
          </p>
        </div>
      </Section>

      <Section title="Account Security & Classroom Code">
        <div className="finn-card space-y-4 text-sm font-semibold text-slate-700">
          <p>
            Linked class:{" "}
            <span className="font-extrabold text-slate-900">
              {summary.className}
              {summary.teacherName ? ` (${summary.teacherName})` : ""}
            </span>{" "}
            · {summary.schoolName} · Class ID {summary.classCode}
          </p>
          <ChangePassword />
          <p className="text-xs text-slate-500">Forgot your password? Ask your teacher or school to reset it.</p>
        </div>
      </Section>

      <ErrorBanner message={error} />
      <div className="flex justify-end gap-2 mt-4">
        <SmallButton className="px-5 py-2" onClick={() => setForm(formFromSummary(summary))}>
          Cancel
        </SmallButton>
        <SmallButton tone="primary" className="px-5 py-2" disabled={saving} onClick={handleSave}>
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          Save changes
        </SmallButton>
      </div>
    </div>
  );
}
