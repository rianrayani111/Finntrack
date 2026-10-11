import React, { useState } from "react";
import { Copy, LogOut, Plus, RefreshCw } from "lucide-react";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";
import FinnLogo from "@/components/FinnLogo";
import usePageMeta from "@/hooks/usePageMeta";
import { useAuth } from "@/lib/AuthContext";
import { education } from "@/api/education";
import {
  Chip,
  ChipRow,
  Empty,
  ErrorBanner,
  PageTitle,
  Pill,
  Section,
  SmallButton,
  Spinner,
  useLoad,
} from "@/components/student/StudentUI";

// The teacher's home until the full classroom dashboard lands: their school's
// codes, the invite link for colleagues, and their classes.
const copyToClipboard = async (text, label) => {
  try {
    await navigator.clipboard.writeText(text);
    toast({ title: `${label} copied` });
  } catch {
    toast({ title: `Could not copy. It is: ${text}` });
  }
};

function CodeCard({ label, value, hint, tone = "sky", onCopy, onRotate }) {
  const tones = {
    sky: "border-sky-100 bg-sky-50 text-sky-700",
    emerald: "border-emerald-100 bg-emerald-50 text-emerald-700",
  };
  return (
    <div className={`rounded-3xl border-2 p-4 ${tones[tone]}`}>
      <p className="text-xs font-extrabold uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-extrabold text-slate-800 tracking-widest break-all">{value}</p>
      {hint && <p className="text-xs font-semibold text-slate-600 mt-1">{hint}</p>}
      <div className="flex gap-1.5 mt-2">
        {onCopy && (
          <SmallButton onClick={onCopy}>
            <Copy className="w-4 h-4" /> Copy
          </SmallButton>
        )}
        {onRotate && (
          <SmallButton onClick={onRotate}>
            <RefreshCw className="w-4 h-4" /> Replace
          </SmallButton>
        )}
      </div>
    </div>
  );
}

function NewClassDialog({ open, onOpenChange, onCreated }) {
  const [name, setName] = useState("");
  const [gradeLevel, setGradeLevel] = useState("");
  const [seatLimit, setSeatLimit] = useState(30);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const result = await education.createClass({
        name,
        gradeLevel,
        seatLimit: Number(seatLimit),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      toast({ title: `${result.name} created`, description: `Class code ${result.classCode}` });
      onOpenChange(false);
      setName("");
      setGradeLevel("");
      onCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-3xl">
        <DialogHeader>
          <DialogTitle className="font-extrabold">New classroom</DialogTitle>
          <DialogDescription>
            It starts with example jobs and store items so it isn&apos;t empty. Edit or delete them freely.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="class-name" className="font-bold text-slate-700">Class name</Label>
            <Input
              id="class-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Period 3 - Social Studies"
              className="h-11 rounded-2xl border-2"
              required
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="class-grade" className="font-bold text-slate-700">Grade level</Label>
              <Input
                id="class-grade"
                value={gradeLevel}
                onChange={(e) => setGradeLevel(e.target.value)}
                placeholder="6-8"
                className="h-11 rounded-2xl border-2"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="class-seats" className="font-bold text-slate-700">Seats</Label>
              <Input
                id="class-seats"
                type="number"
                min={1}
                max={500}
                value={seatLimit}
                onChange={(e) => setSeatLimit(e.target.value)}
                className="h-11 rounded-2xl border-2"
              />
            </div>
          </div>
          {error && <p className="text-sm font-bold text-rose-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <SmallButton onClick={() => onOpenChange(false)}>Cancel</SmallButton>
            <SmallButton tone="primary" type="submit" disabled={saving}>
              Create class
            </SmallButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function EducatorHome() {
  usePageMeta("Teacher Portal", "Your FinnTrack classes.", "/educator");
  const { logout, profile } = useAuth();
  const [newClassOpen, setNewClassOpen] = useState(false);

  const { data, loading, error, reload } = useLoad(async () => {
    const [school, classes] = await Promise.all([education.schoolSettings(), education.myClasses()]);
    return { school, classes };
  }, []);

  const rotate = async (which) => {
    try {
      await education.rotateSchoolSecret(which);
      toast({ title: which === "passcode" ? "New school passcode set" : "New invite link set" });
      reload();
    } catch (err) {
      toast({ title: "Could not update", description: err.message, variant: "destructive" });
    }
  };

  const inviteLink = data?.school?.inviteToken
    ? `${window.location.origin}/join-school?token=${data.school.inviteToken}`
    : null;

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white/80 px-4 py-4 lg:px-6">
        <div className="flex items-center gap-3">
          <FinnLogo className="w-12 h-12" />
          <div>
            <h1 className="text-xl font-extrabold text-slate-800">
              Hello, {profile?.displayName || "teacher"}!
            </h1>
            <p className="text-sm font-semibold text-slate-500">Teacher Portal</p>
          </div>
        </div>
        <SmallButton tone="danger" onClick={() => logout()}>
          <LogOut className="w-4 h-4" /> Log out
        </SmallButton>
      </header>

      <main className="p-4 lg:p-6 max-w-5xl">
        <ErrorBanner message={error} />
        {loading ? (
          <Spinner />
        ) : data ? (
          <>
            <PageTitle>{data.school.schoolName}</PageTitle>
            <ChipRow>
              <Chip label="Classes" value={data.school.classCount} />
              <Chip label="Students" value={data.school.studentCount} tone="green" />
              <Chip label="Teachers" value={data.school.teacherCount} tone="slate" />
              {data.school.isAdmin && <Chip label="Role" value="School admin" tone="amber" />}
            </ChipRow>

            <Section title="Codes & invites">
              <div className="grid sm:grid-cols-2 gap-3">
                <CodeCard
                  label="School passcode"
                  value={data.school.passcode}
                  hint="Teachers type this before their username at login."
                  onCopy={() => copyToClipboard(data.school.passcode, "Passcode")}
                  onRotate={data.school.isAdmin ? () => rotate("passcode") : undefined}
                />
                {inviteLink && (
                  <CodeCard
                    label="Teacher invite link"
                    tone="emerald"
                    value={`${inviteLink.slice(0, 38)}…`}
                    hint="Colleagues use this to create their own free teacher account in this school."
                    onCopy={() => copyToClipboard(inviteLink, "Invite link")}
                    onRotate={() => rotate("invite")}
                  />
                )}
              </div>
            </Section>

            <Section
              title="Your classrooms"
              subtitle="Each class runs its own separate economy."
              action={
                <SmallButton tone="primary" onClick={() => setNewClassOpen(true)}>
                  <Plus className="w-4 h-4" /> New classroom
                </SmallButton>
              }
            >
              {data.classes.length === 0 ? (
                <div className="finn-card">
                  <Empty>No classrooms yet. Create your first one.</Empty>
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {data.classes.map((klass) => (
                    <div key={klass.id} className="finn-card">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-extrabold text-slate-800">{klass.name}</p>
                        {klass.isArchived && <Pill tone="slate">Archived</Pill>}
                      </div>
                      <p className="text-sm font-semibold text-slate-600 mt-1">
                        Class code <span className="font-extrabold tracking-widest text-slate-800">{klass.code}</span>
                      </p>
                      <p className="text-xs font-semibold text-slate-500">
                        {klass.seatLimit} seats · {klass.currencyName}
                        {klass.gradeLevel ? ` · grade ${klass.gradeLevel}` : ""}
                      </p>
                      <div className="mt-2">
                        <SmallButton onClick={() => copyToClipboard(klass.code, "Class code")}>
                          <Copy className="w-4 h-4" /> Copy code
                        </SmallButton>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            <p className="mt-8 text-sm font-semibold text-slate-500">
              The classroom dashboard, roster, job board and class store are being built next.
            </p>

            <NewClassDialog open={newClassOpen} onOpenChange={setNewClassOpen} onCreated={reload} />
          </>
        ) : null}
      </main>
    </div>
  );
}
