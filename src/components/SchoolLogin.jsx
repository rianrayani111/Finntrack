import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Building2, KeyRound, Loader2, Lock, LogIn, Mail, School, User, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/AuthContext";
import { education } from "@/api/education";

// Remembers which school/class this device last logged in to, so a student on
// a classroom device only types their username and password. Never the
// credentials themselves. Best-effort: storage can be unavailable.
const LAST_CLASS_KEY = "finntrack:last-class";

const readLastClass = () => {
  try {
    return JSON.parse(window.localStorage.getItem(LAST_CLASS_KEY)) || {};
  } catch {
    return {};
  }
};

const writeLastClass = (value) => {
  try {
    window.localStorage.setItem(LAST_CLASS_KEY, JSON.stringify(value));
  } catch {
    // ignore
  }
};

const inputClass = "pl-10 h-12 rounded-2xl border-2";
const submitClass =
  "w-full h-12 rounded-2xl bg-sky-500 hover:bg-sky-600 text-white font-bold text-base inline-flex items-center justify-center disabled:opacity-60";

function ErrorBox({ error, onDismiss }) {
  if (!error) return null;
  return (
    <div
      key={error.id}
      role="alert"
      className="mb-4 p-3 rounded-2xl border border-red-300 bg-red-50 text-red-600 text-sm font-bold flex items-start justify-between gap-3"
    >
      <span className="flex-1">{error.message}</span>
      <button
        type="button"
        onClick={onDismiss}
        className="text-red-500 hover:text-red-700 transition-colors"
        aria-label="Dismiss error"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

function IconInput({ id, icon: Icon, ...props }) {
  return (
    <div className="relative">
      <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
      <Input id={id} className={inputClass} required {...props} />
    </div>
  );
}

// Student login is two steps: school name + class ID find the class, then
// the class's own login screen takes a username and password.
function StudentLogin({ onBack }) {
  const { loginStudent } = useAuth();
  const [lastClass] = useState(readLastClass);
  const [schoolName, setSchoolName] = useState(lastClass.schoolName || "");
  const [classCode, setClassCode] = useState(lastClass.classCode || "");
  const [klass, setKlass] = useState(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showForgotHelp, setShowForgotHelp] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const fail = (err, fallback) => setError({ id: Date.now(), message: err?.message || fallback });

  const handleFindClass = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const found = await education.findClass(schoolName, classCode);
      if (!found) {
        fail(null, "We couldn't find that class. Check the school name and class ID with your teacher.");
        return;
      }
      writeLastClass({ schoolName: found.schoolName, classCode: classCode.trim().toUpperCase() });
      setKlass(found);
    } catch (err) {
      fail(err, "Could not look up your class. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await loginStudent(klass.classId, username, password);
      window.location.assign("/student");
    } catch (err) {
      const message = /invalid login credentials/i.test(err?.message || "")
        ? "Incorrect username or password."
        : err?.message;
      fail({ message }, "Incorrect username or password.");
      setLoading(false);
    }
  };

  if (!klass) {
    return (
      <>
        <h2 className="text-2xl font-extrabold text-slate-800 text-center mb-1">Student Login</h2>
        <p className="text-sm text-muted-foreground font-semibold text-center mb-5">
          Enter your school name and the class ID your teacher gave you.
        </p>
        <ErrorBox error={error} onDismiss={() => setError(null)} />
        <form onSubmit={handleFindClass} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="school-name" className="font-bold text-slate-700">
              School name
            </Label>
            <IconInput
              id="school-name"
              icon={Building2}
              placeholder="Lincoln Middle"
              autoComplete="organization"
              autoFocus
              value={schoolName}
              onChange={(e) => setSchoolName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="class-code" className="font-bold text-slate-700">
              Class ID
            </Label>
            <IconInput
              id="class-code"
              icon={KeyRound}
              placeholder="RIAN1G"
              autoComplete="off"
              autoCapitalize="characters"
              value={classCode}
              onChange={(e) => setClassCode(e.target.value.toUpperCase())}
              className={`${inputClass} uppercase tracking-widest`}
            />
          </div>
          <button type="submit" className={submitClass} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <School className="w-4 h-4 mr-2" />}
            {loading ? "Finding your class..." : "Continue"}
          </button>
        </form>
        <BackLink onBack={onBack} />
      </>
    );
  }

  return (
    <>
      <h2 className="text-2xl font-extrabold text-slate-800 text-center mb-1">{klass.className}</h2>
      <p className="text-sm text-muted-foreground font-semibold text-center mb-5">
        {klass.schoolName} · Log in with your class username.
      </p>
      <ErrorBox error={error} onDismiss={() => setError(null)} />
      <form onSubmit={handleLogin} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="student-username" className="font-bold text-slate-700">
            Username
          </Label>
          <IconInput
            id="student-username"
            icon={User}
            autoComplete="username"
            autoFocus
            placeholder="alex"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="student-password" className="font-bold text-slate-700">
            Password
          </Label>
          <IconInput
            id="student-password"
            icon={Lock}
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <div className="text-right">
            <button
              type="button"
              onClick={() => setShowForgotHelp((v) => !v)}
              className="text-xs font-bold text-sky-600 hover:underline"
            >
              Forgot password?
            </button>
          </div>
          {showForgotHelp && (
            <div className="p-3 rounded-2xl border border-sky-200 bg-sky-50 text-sky-700 text-sm font-bold text-center">
              Ask your teacher or school to reset your password.
            </div>
          )}
        </div>
        <button type="submit" className={submitClass} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <LogIn className="w-4 h-4 mr-2" />}
          {loading ? "Logging in..." : "Log in"}
        </button>
      </form>
      <div className="mt-4 text-center text-sm font-semibold">
        <button
          type="button"
          onClick={() => {
            setKlass(null);
            setError(null);
            setPassword("");
          }}
          className="text-slate-500 hover:text-sky-600 hover:underline"
        >
          Not your class? Change it
        </button>
      </div>
      <BackLink onBack={onBack} />
    </>
  );
}

function TeacherLogin({ onBack }) {
  const { loginEducator } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await loginEducator(email.trim().toLowerCase(), password);
      window.location.assign("/educator");
    } catch (err) {
      setError({ id: Date.now(), message: err?.message || "Incorrect email or password." });
      setLoading(false);
    }
  };

  return (
    <>
      <h2 className="text-2xl font-extrabold text-slate-800 text-center mb-1">Teacher Login</h2>
      <p className="text-sm text-muted-foreground font-semibold text-center mb-5">
        Sign in with your school email and password.
      </p>
      <ErrorBox error={error} onDismiss={() => setError(null)} />
      <form onSubmit={handleLogin} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="teacher-email" className="font-bold text-slate-700">
            Email
          </Label>
          <IconInput
            id="teacher-email"
            icon={Mail}
            type="email"
            autoComplete="email"
            autoFocus
            placeholder="you@school.edu"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="teacher-password" className="font-bold text-slate-700">
            Password
          </Label>
          <IconInput
            id="teacher-password"
            icon={Lock}
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <div className="text-right">
            <Link to="/forgot-password" className="text-xs font-bold text-sky-600 hover:underline">
              Forgot password?
            </Link>
          </div>
        </div>
        <button type="submit" className={submitClass} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <LogIn className="w-4 h-4 mr-2" />}
          {loading ? "Logging in..." : "Log in"}
        </button>
      </form>
      <BackLink onBack={onBack} />
    </>
  );
}

function BackLink({ onBack }) {
  return (
    <div className="mt-3 text-center text-sm font-semibold">
      <button type="button" onClick={onBack} className="text-slate-500 hover:text-sky-600 hover:underline">
        Back to family login
      </button>
    </div>
  );
}

export default function SchoolLogin({ mode, onBack }) {
  return mode === "teacher" ? <TeacherLogin onBack={onBack} /> : <StudentLogin onBack={onBack} />;
}

// The "Schools & institutions" entry points shown under the family logins.
export function SchoolLoginLinks({ onStudent, onTeacher }) {
  return (
    <div className="mt-5 pt-4 border-t border-slate-100 text-center">
      <p className="text-xs font-extrabold uppercase tracking-wide text-slate-400 mb-2">Schools &amp; institutions</p>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onStudent}
          className="h-10 rounded-2xl border-2 border-sky-100 bg-sky-50 text-sky-700 text-sm font-bold hover:bg-sky-100"
        >
          Student login
        </button>
        <button
          type="button"
          onClick={onTeacher}
          className="h-10 rounded-2xl border-2 border-sky-100 bg-sky-50 text-sky-700 text-sm font-bold hover:bg-sky-100"
        >
          Teacher login
        </button>
      </div>
    </div>
  );
}
