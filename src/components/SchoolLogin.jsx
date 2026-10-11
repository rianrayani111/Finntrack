import React, { useState } from "react";
import { Building2, KeyRound, Loader2, Lock, LogIn, User, UserPlus, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/AuthContext";
import { education } from "@/api/education";

// Remembers which class/school this device last used, so a student on a
// classroom device only types their username and password. Never the
// credentials themselves. Best-effort: storage can be unavailable.
const LAST_CLASS_KEY = "finntrack:last-class-code";
const LAST_SCHOOL_KEY = "finntrack:last-school-passcode";

const readRemembered = (key) => {
  try {
    return window.localStorage.getItem(key) || "";
  } catch {
    return "";
  }
};

const remember = (key, value) => {
  try {
    window.localStorage.setItem(key, value);
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

function SignupLink({ onSignup }) {
  if (!onSignup) return null;
  return (
    <div className="mt-4 pt-3 border-t border-slate-100 text-center text-sm font-semibold">
      <span className="text-slate-500">New to FinnTrack? </span>
      <button type="button" onClick={onSignup} className="font-bold text-sky-600 hover:underline">
        Create a teacher account
      </button>
    </div>
  );
}

function CodeStep({ title, subtitle, label, placeholder, icon, value, onChange, onSubmit, loading, error, onDismiss, onBack, footer }) {
  return (
    <>
      <h2 className="text-2xl font-extrabold text-slate-800 text-center mb-1">{title}</h2>
      <p className="text-sm text-muted-foreground font-semibold text-center mb-5">{subtitle}</p>
      <ErrorBox error={error} onDismiss={onDismiss} />
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="code-step" className="font-bold text-slate-700">
            {label}
          </Label>
          <IconInput
            id="code-step"
            icon={icon}
            placeholder={placeholder}
            autoComplete="off"
            autoCapitalize="characters"
            autoFocus
            value={value}
            onChange={(e) => onChange(e.target.value.toUpperCase())}
            className={`${inputClass} uppercase tracking-widest`}
          />
        </div>
        <button type="submit" className={submitClass} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <KeyRound className="w-4 h-4 mr-2" />}
          {loading ? "Checking..." : "Continue"}
        </button>
      </form>
      {footer}
      <BackLink onBack={onBack} />
    </>
  );
}

// Students: class code, then either log in or make an account in that class.
function StudentLogin({ onBack }) {
  const { loginStudent } = useAuth();
  const [classCode, setClassCode] = useState(() => readRemembered(LAST_CLASS_KEY));
  const [klass, setKlass] = useState(null);
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showForgotHelp, setShowForgotHelp] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const fail = (message) => setError({ id: Date.now(), message });

  const handleFindClass = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const found = await education.findClass(classCode);
      if (!found) {
        fail("We couldn't find that class code. Check it with your teacher.");
        return;
      }
      remember(LAST_CLASS_KEY, classCode.trim().toUpperCase());
      setKlass(found);
    } catch (err) {
      fail(err?.message || "Could not look up your class. Please try again.");
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
      fail(
        /invalid login credentials/i.test(err?.message || "")
          ? "Incorrect username or password."
          : err?.message || "Incorrect username or password."
      );
      setLoading(false);
    }
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      return fail("Those passwords don't match.");
    }
    setError(null);
    setLoading(true);
    try {
      await education.joinClass({
        classCode,
        username,
        displayName,
        password,
      });
      await loginStudent(klass.classId, username, password);
      window.location.assign("/student");
    } catch (err) {
      fail(err?.message || "Could not join that class.");
      setLoading(false);
    }
  };

  if (!klass) {
    return (
      <CodeStep
        title="Student Login"
        subtitle="Enter the class code your teacher gave you."
        label="Class code"
        placeholder="RIAN1G"
        icon={KeyRound}
        value={classCode}
        onChange={setClassCode}
        onSubmit={handleFindClass}
        loading={loading}
        error={error}
        onDismiss={() => setError(null)}
        onBack={onBack}
      />
    );
  }

  const canJoin = klass.joinOpen && klass.seatsLeft > 0;
  const joining = mode === "join";

  return (
    <>
      <h2 className="text-2xl font-extrabold text-slate-800 text-center mb-1">{klass.className}</h2>
      <p className="text-sm text-muted-foreground font-semibold text-center mb-4">{klass.schoolName}</p>

      <div className="grid grid-cols-2 gap-2 mb-4">
        {[
          ["login", "I have an account"],
          ["join", "Join this class"],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              setMode(value);
              setError(null);
            }}
            className={`h-10 rounded-2xl border-2 text-sm font-bold ${
              mode === value ? "border-sky-500 bg-sky-50 text-sky-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <ErrorBox error={error} onDismiss={() => setError(null)} />

      {joining && !canJoin ? (
        <p className="p-3 rounded-2xl border-2 border-amber-100 bg-amber-50 text-amber-800 text-sm font-bold text-center">
          {klass.joinOpen
            ? "This class is full. Ask your teacher to add more seats."
            : "This class isn't taking new students right now."}
        </p>
      ) : (
        <form onSubmit={joining ? handleJoin : handleLogin} className="space-y-4">
          {joining && (
            <div className="space-y-2">
              <Label htmlFor="student-name" className="font-bold text-slate-700">
                Your name
              </Label>
              <IconInput
                id="student-name"
                icon={User}
                autoComplete="name"
                autoFocus
                placeholder="Alex Morgan"
                maxLength={40}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="student-username" className="font-bold text-slate-700">
              Username
            </Label>
            <IconInput
              id="student-username"
              icon={User}
              autoComplete="username"
              autoFocus={!joining}
              placeholder="alex_m"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase())}
            />
            {joining && (
              <p className="text-xs font-semibold text-slate-500">
                Lowercase letters, numbers and underscores. Your teacher will see this.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="student-password" className="font-bold text-slate-700">
              Password
            </Label>
            <IconInput
              id="student-password"
              icon={Lock}
              type="password"
              autoComplete={joining ? "new-password" : "current-password"}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {!joining && (
              <>
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
                    Ask your teacher to reset your password.
                  </div>
                )}
              </>
            )}
          </div>

          {joining && (
            <div className="space-y-2">
              <Label htmlFor="student-confirm" className="font-bold text-slate-700">
                Confirm password
              </Label>
              <IconInput
                id="student-confirm"
                icon={Lock}
                type="password"
                autoComplete="new-password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          )}

          <button type="submit" className={submitClass} disabled={loading}>
            {loading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : joining ? (
              <UserPlus className="w-4 h-4 mr-2" />
            ) : (
              <LogIn className="w-4 h-4 mr-2" />
            )}
            {loading ? (joining ? "Creating your account..." : "Logging in...") : joining ? "Join class" : "Log in"}
          </button>
        </form>
      )}

      <div className="mt-4 text-center text-sm font-semibold">
        <button
          type="button"
          onClick={() => {
            setKlass(null);
            setError(null);
            setPassword("");
            setConfirmPassword("");
          }}
          className="text-slate-500 hover:text-sky-600 hover:underline"
        >
          Not your class? Change the code
        </button>
      </div>
      <BackLink onBack={onBack} />
    </>
  );
}

// Teachers: school passcode, then their username and password.
function TeacherLogin({ onBack, onSignup }) {
  const { loginEducator } = useAuth();
  const [passcode, setPasscode] = useState(() => readRemembered(LAST_SCHOOL_KEY));
  const [school, setSchool] = useState(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const fail = (message) => setError({ id: Date.now(), message });

  const handleFindSchool = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const found = await education.findSchool(passcode);
      if (!found) {
        fail("We couldn't find that school passcode. Check it with your school admin.");
        return;
      }
      remember(LAST_SCHOOL_KEY, passcode.trim().toUpperCase());
      setSchool(found);
    } catch (err) {
      fail(err?.message || "Could not look up your school. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await loginEducator(school.schoolId, username, password);
      window.location.assign("/educator");
    } catch (err) {
      fail(
        /invalid login credentials/i.test(err?.message || "")
          ? "Incorrect username or password."
          : err?.message || "Incorrect username or password."
      );
      setLoading(false);
    }
  };

  if (!school) {
    return (
      <CodeStep
        title="Teacher Login"
        subtitle="Enter your school passcode."
        label="School passcode"
        placeholder="LMS2026"
        icon={Building2}
        value={passcode}
        onChange={setPasscode}
        onSubmit={handleFindSchool}
        loading={loading}
        error={error}
        onDismiss={() => setError(null)}
        onBack={onBack}
        footer={<SignupLink onSignup={onSignup} />}
      />
    );
  }

  return (
    <>
      <h2 className="text-2xl font-extrabold text-slate-800 text-center mb-1">{school.schoolName}</h2>
      <p className="text-sm text-muted-foreground font-semibold text-center mb-5">Log in with your teacher username.</p>
      <ErrorBox error={error} onDismiss={() => setError(null)} />
      <form onSubmit={handleLogin} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="teacher-username" className="font-bold text-slate-700">
            Username
          </Label>
          <IconInput
            id="teacher-username"
            icon={User}
            autoComplete="username"
            autoFocus
            placeholder="mdavis_finance"
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase())}
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
            setSchool(null);
            setError(null);
            setPassword("");
          }}
          className="text-slate-500 hover:text-sky-600 hover:underline"
        >
          Different school? Change the passcode
        </button>
      </div>
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

export default function SchoolLogin({ mode, onBack, onTeacherSignup }) {
  return mode === "teacher" ? (
    <TeacherLogin onBack={onBack} onSignup={onTeacherSignup} />
  ) : (
    <StudentLogin onBack={onBack} />
  );
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
