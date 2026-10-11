import React, { useState } from "react";
import { Building2, GraduationCap, Loader2, Lock, Mail, User } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { education } from "@/api/education";
import { useAuth } from "@/lib/AuthContext";

// Free teacher sign-up. Two shapes, same form:
//   no invite token -- starts a new school; this teacher becomes its admin
//   invite token    -- joins the school that issued the link, as a teacher
//
// Nothing is charged: plans and checkout come later and will sit in front of
// this. The school passcode and class code are generated for them, so the
// last screen shows both.
const inputClass = "pl-10 h-12 rounded-2xl border-2";
const submitClass =
  "w-full h-12 rounded-2xl bg-sky-500 hover:bg-sky-600 text-white font-bold text-base inline-flex items-center justify-center disabled:opacity-60";

function IconInput({ id, icon: Icon, ...props }) {
  return (
    <div className="relative">
      <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
      <Input id={id} className={inputClass} {...props} />
    </div>
  );
}

function Field({ id, label, hint, children }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="font-bold text-slate-700">
        {label}
      </Label>
      {children}
      {hint && <p className="text-xs font-semibold text-slate-500">{hint}</p>}
    </div>
  );
}

export default function TeacherSignup({ inviteToken, onBack }) {
  const { loginEducator } = useAuth();
  const [form, setForm] = useState({
    schoolName: "",
    className: "Period 1",
    displayName: "",
    displayTitle: "",
    username: "",
    contactEmail: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(null);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const isInvite = Boolean(inviteToken);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) {
      setError("Those passwords don't match.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const result = await education.teacherSignup({
        inviteToken: inviteToken || undefined,
        schoolName: form.schoolName,
        className: form.className,
        displayName: form.displayName,
        displayTitle: form.displayTitle,
        username: form.username,
        contactEmail: form.contactEmail,
        password: form.password,
        // So paydays and market days follow the school's own calendar.
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      setDone(result);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleContinue = async () => {
    setLoading(true);
    try {
      await loginEducator(done.schoolId, done.username, form.password);
      window.location.assign("/educator");
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  if (done) {
    return (
      <>
        <h2 className="text-2xl font-extrabold text-slate-800 text-center mb-1">You&apos;re all set!</h2>
        <p className="text-sm text-muted-foreground font-semibold text-center mb-5">
          Write these down. You&apos;ll need them to log in and to get your students in.
        </p>
        <div className="space-y-3">
          <div className="rounded-2xl border-2 border-sky-100 bg-sky-50 p-3">
            <p className="text-xs font-extrabold uppercase tracking-wide text-sky-700">School passcode</p>
            <p className="text-2xl font-extrabold text-slate-800 tracking-widest">{done.passcode}</p>
            <p className="text-xs font-semibold text-slate-600">
              You and your colleagues type this before your username at login.
            </p>
          </div>
          {done.classCode && (
            <div className="rounded-2xl border-2 border-emerald-100 bg-emerald-50 p-3">
              <p className="text-xs font-extrabold uppercase tracking-wide text-emerald-700">Class code</p>
              <p className="text-2xl font-extrabold text-slate-800 tracking-widest">{done.classCode}</p>
              <p className="text-xs font-semibold text-slate-600">
                Students go to the Student login and enter this to join your class.
              </p>
            </div>
          )}
          <div className="rounded-2xl border-2 border-slate-100 bg-slate-50 p-3">
            <p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">Your username</p>
            <p className="text-lg font-extrabold text-slate-800">{done.username}</p>
          </div>
        </div>
        {error && <p className="mt-3 text-sm font-bold text-rose-600">{error}</p>}
        <button type="button" className={`${submitClass} mt-5`} onClick={handleContinue} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
          Go to my dashboard
        </button>
      </>
    );
  }

  return (
    <>
      <h2 className="text-2xl font-extrabold text-slate-800 text-center mb-1">
        {isInvite ? "Join your school" : "Create a teacher account"}
      </h2>
      <p className="text-sm text-muted-foreground font-semibold text-center mb-5">
        {isInvite
          ? "You were invited by your school admin. Set up your own login."
          : "Free to start. You'll get a school passcode and your first class."}
      </p>

      {error && (
        <div role="alert" className="mb-4 p-3 rounded-2xl border border-red-300 bg-red-50 text-red-600 text-sm font-bold">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {!isInvite && (
          <>
            <Field id="school-name" label="School name">
              <IconInput
                id="school-name"
                icon={Building2}
                placeholder="Lincoln Middle School"
                autoFocus
                required
                value={form.schoolName}
                onChange={set("schoolName")}
              />
            </Field>
            <Field id="class-name" label="Your first class" hint="You can rename it or add more classes later.">
              <IconInput
                id="class-name"
                icon={GraduationCap}
                placeholder="Period 3 - Social Studies"
                required
                value={form.className}
                onChange={set("className")}
              />
            </Field>
          </>
        )}

        <div className="grid sm:grid-cols-2 gap-3">
          <Field id="teacher-name" label="Your name">
            <IconInput
              id="teacher-name"
              icon={User}
              placeholder="Marcus Davis"
              autoFocus={isInvite}
              required
              value={form.displayName}
              onChange={set("displayName")}
            />
          </Field>
          <Field id="teacher-title" label="What students call you">
            <IconInput
              id="teacher-title"
              icon={User}
              placeholder="Mr. Davis"
              value={form.displayTitle}
              onChange={set("displayTitle")}
            />
          </Field>
        </div>

        <Field id="signup-username" label="Username" hint="Lowercase letters, numbers, dots and underscores.">
          <IconInput
            id="signup-username"
            icon={User}
            placeholder="mdavis_finance"
            autoComplete="username"
            required
            value={form.username}
            onChange={(e) => setForm((f) => ({ ...f, username: e.target.value.toLowerCase() }))}
          />
        </Field>

        <Field id="signup-email" label="Email (optional)" hint="Only used to reach you about your account.">
          <IconInput
            id="signup-email"
            icon={Mail}
            type="email"
            placeholder="you@school.edu"
            autoComplete="email"
            value={form.contactEmail}
            onChange={set("contactEmail")}
          />
        </Field>

        <div className="grid sm:grid-cols-2 gap-3">
          <Field id="signup-password" label="Password" hint="At least 8 characters.">
            <IconInput
              id="signup-password"
              icon={Lock}
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              required
              value={form.password}
              onChange={set("password")}
            />
          </Field>
          <Field id="signup-confirm" label="Confirm password">
            <IconInput
              id="signup-confirm"
              icon={Lock}
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              required
              value={form.confirmPassword}
              onChange={set("confirmPassword")}
            />
          </Field>
        </div>

        <button type="submit" className={submitClass} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
          {loading ? "Setting things up..." : isInvite ? "Join school" : "Create my school"}
        </button>
      </form>

      {onBack && (
        <div className="mt-3 text-center text-sm font-semibold">
          <button type="button" onClick={onBack} className="text-slate-500 hover:text-sky-600 hover:underline">
            Back
          </button>
        </div>
      )}
    </>
  );
}
