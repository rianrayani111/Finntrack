import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";

import { useAuth } from '@/lib/AuthContext';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Lock, Loader2, LogIn, User, X } from "lucide-react";
import FinnAuthLayout from "@/components/FinnAuthLayout";
import { Checkbox } from "@/components/ui/checkbox";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import usePageMeta from "@/hooks/usePageMeta";

const VIEW = {
  CHILD_LOGIN: 'child_login',
  PARENT_LOGIN: 'parent_login',
  PARENT_SIGNUP: 'parent_signup',
  PARENT_SIGNUP_OTP: 'parent_signup_otp',
  CHILD_SIGNUP_BLOCKED: 'child_signup_blocked',
};

export default function Login() {
  usePageMeta("Log In", "Log in to your FinnTrack parent or kid account.", "/login");

  const [view, setView] = useState(VIEW.CHILD_LOGIN);

  const [childUsername, setChildUsername] = useState("");
  const [childPassword, setChildPassword] = useState("");

  const [parentEmail, setParentEmail] = useState("");
  const [parentPassword, setParentPassword] = useState("");

  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupConfirmPassword, setSignupConfirmPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const [otpCode, setOtpCode] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);

  const [resendLoading, setResendLoading] = useState(false);
  const [notice, setNotice] = useState(null);
  const [showChildForgotHelp, setShowChildForgotHelp] = useState(false);

  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const { loginChild, loginParent, signupParent, verifyParentSignup, resendParentOtp } = useAuth();

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => setResendCooldown((s) => Math.max(s - 1, 0)), 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const moveToChildLogin = () => {
    setView(VIEW.CHILD_LOGIN);
    setError(null);
    setLoading(false);
  };

  const handleChildLogin = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await loginChild(childUsername, childPassword);
      window.location.assign('/dashboard');
    } catch (err) {
      setError({ id: Date.now(), message: err?.message || 'Incorrect username or password.' });
    } finally {
      setLoading(false);
    }
  };

  const handleParentLogin = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await loginParent(parentEmail, parentPassword);
      window.location.assign('/parent');
    } catch (err) {
      setError({ id: Date.now(), message: err?.message || 'Incorrect email or password.' });
    } finally {
      setLoading(false);
    }
  };

  const handleParentSignup = async (e) => {
    e.preventDefault();

    if (signupPassword !== signupConfirmPassword) {
      setError({ id: Date.now(), message: 'Passwords do not match.' });
      return;
    }

    if (!acceptedTerms) {
      setError({
        id: Date.now(),
        message: 'Please confirm you are a parent/guardian aged 18+ and accept the Terms and Conditions.',
      });
      return;
    }

    setError(null);
    setLoading(true);
    try {
      await signupParent(signupEmail, signupPassword);
      setNotice(null);
      setOtpCode("");
      setResendCooldown(60);
      setView(VIEW.PARENT_SIGNUP_OTP);
    } catch (err) {
      setError({ id: Date.now(), message: err?.message || 'Could not create parent account.' });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyParentOtp = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await verifyParentSignup(signupEmail, otpCode);
      window.location.assign('/parent');
    } catch {
      setOtpCode("");
      setError({ id: Date.now(), message: 'Incorrect pin has been entered, please try again.' });
      setLoading(false);
    }
  };

  const handleResendParentOtp = async () => {
    if (resendCooldown > 0) return;
    setError(null);
    setResendLoading(true);
    try {
      await resendParentOtp(signupEmail);
      setOtpCode("");
      setResendCooldown(60);
      setNotice({ id: Date.now(), message: `We sent a new code to ${signupEmail}.` });
    } catch (err) {
      setError({ id: Date.now(), message: err?.message || 'Failed to resend the verification email.' });
    } finally {
      setResendLoading(false);
    }
  };

  const dismissError = () => {
    setError(null);
  };

  return (
    <FinnAuthLayout mascotMessage="Welcome back, friend!">
      {view === VIEW.CHILD_LOGIN && (
        <>
          <h2 className="text-2xl font-extrabold text-slate-800 text-center mb-1">Kid Log In</h2>
          <p className="text-sm text-muted-foreground font-semibold text-center mb-5">
            Enter your username and password to continue.
          </p>

          {error && (
            <div
              key={error.id}
              role="alert"
              className="mb-4 p-3 rounded-2xl border border-red-300 bg-red-50 text-red-600 text-sm font-bold flex items-start justify-between gap-3"
            >
              <span className="flex-1">{error.message}</span>
              <button
                type="button"
                onClick={dismissError}
                className="text-red-500 hover:text-red-700 transition-colors"
                aria-label="Dismiss error"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <form onSubmit={handleChildLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username" className="font-bold text-slate-700">
                Username
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  id="username"
                  type="text"
                  autoComplete="username"
                  autoFocus
                  placeholder="maya"
                  name="username"
                  value={childUsername}
                  onChange={(e) => setChildUsername(e.target.value)}
                  className="pl-10 h-12 rounded-2xl border-2"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="child-password" className="font-bold text-slate-700">
                Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  id="child-password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  name="password"
                  value={childPassword}
                  onChange={(e) => setChildPassword(e.target.value)}
                  className="pl-10 h-12 rounded-2xl border-2"
                  required
                />
              </div>
              <div className="text-right">
                <button
                  type="button"
                  onClick={() => setShowChildForgotHelp((v) => !v)}
                  className="text-xs font-bold text-sky-600 hover:underline"
                >
                  Forgot password?
                </button>
              </div>
              {showChildForgotHelp && (
                <div className="p-3 rounded-2xl border border-sky-200 bg-sky-50 text-sky-700 text-sm font-bold text-center">
                  Ask your parent to log in to their account to change your password.
                </div>
              )}
            </div>

            <button
              type="submit"
              className="w-full h-12 rounded-2xl bg-sky-500 hover:bg-sky-600 text-white font-bold text-base inline-flex items-center justify-center"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Logging in...
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4 mr-2" />
                  Log in
                </>
              )}
            </button>
          </form>

          <div className="mt-4 text-center space-y-2 text-sm font-semibold">
            <button
              type="button"
              onClick={() => setView(VIEW.PARENT_LOGIN)}
              className="text-slate-500 hover:text-sky-600 hover:underline"
            >
              Log in as a parent
            </button>
            <br />
            <button
              type="button"
              onClick={() => setView(VIEW.PARENT_SIGNUP)}
              className="text-slate-500 hover:text-sky-600 hover:underline"
            >
              Sign up as a parent
            </button>
            <br />
            <button
              type="button"
              onClick={() => setView(VIEW.CHILD_SIGNUP_BLOCKED)}
              className="text-slate-500 hover:text-sky-600 hover:underline"
            >
              Sign up as a kid
            </button>
          </div>
        </>
      )}

      {view === VIEW.PARENT_LOGIN && (
        <>
          <h2 className="text-2xl font-extrabold text-slate-800 text-center mb-1">Parent Log In</h2>
          <p className="text-sm text-muted-foreground font-semibold text-center mb-5">
            Sign in with your parent email and password.
          </p>

          {error && (
            <div
              key={error.id}
              role="alert"
              className="mb-4 p-3 rounded-2xl border border-red-300 bg-red-50 text-red-600 text-sm font-bold flex items-start justify-between gap-3"
            >
              <span className="flex-1">{error.message}</span>
              <button
                type="button"
                onClick={dismissError}
                className="text-red-500 hover:text-red-700 transition-colors"
                aria-label="Dismiss error"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <form onSubmit={handleParentLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="parent-email" className="font-bold text-slate-700">
                Email
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  id="parent-email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={parentEmail}
                  onChange={(e) => setParentEmail(e.target.value)}
                  className="pl-10 h-12 rounded-2xl border-2"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="parent-password" className="font-bold text-slate-700">
                Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  id="parent-password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={parentPassword}
                  onChange={(e) => setParentPassword(e.target.value)}
                  className="pl-10 h-12 rounded-2xl border-2"
                  required
                />
              </div>
              <div className="text-right">
                <Link to="/forgot-password" className="text-xs font-bold text-sky-600 hover:underline">
                  Forgot password?
                </Link>
              </div>
            </div>

            <button
              type="submit"
              className="w-full h-12 rounded-2xl bg-sky-500 hover:bg-sky-600 text-white font-bold text-base inline-flex items-center justify-center"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Logging in...
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4 mr-2" />
                  Log in
                </>
              )}
            </button>
          </form>

          <div className="mt-4 text-center space-y-2 text-sm font-semibold">
            <button
              type="button"
              onClick={moveToChildLogin}
              className="text-slate-500 hover:text-sky-600 hover:underline"
            >
              Back
            </button>
            <br />
            <button
              type="button"
              onClick={() => setView(VIEW.PARENT_SIGNUP)}
              className="text-slate-500 hover:text-sky-600 hover:underline"
            >
              Sign up as a parent
            </button>
          </div>
        </>
      )}

      {view === VIEW.PARENT_SIGNUP && (
        <>
          <h2 className="text-2xl font-extrabold text-slate-800 text-center mb-1">Parent Sign Up</h2>
          <p className="text-sm text-muted-foreground font-semibold text-center mb-5">
            Create a parent account to manage child profiles.
          </p>

          {error && (
            <div
              key={error.id}
              role="alert"
              className="mb-4 p-3 rounded-2xl border border-red-300 bg-red-50 text-red-600 text-sm font-bold flex items-start justify-between gap-3"
            >
              <span className="flex-1">{error.message}</span>
              <button
                type="button"
                onClick={dismissError}
                className="text-red-500 hover:text-red-700 transition-colors"
                aria-label="Dismiss error"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <form onSubmit={handleParentSignup} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="signup-email" className="font-bold text-slate-700">
                Email
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  id="signup-email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={signupEmail}
                  onChange={(e) => setSignupEmail(e.target.value)}
                  className="pl-10 h-12 rounded-2xl border-2"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="signup-password" className="font-bold text-slate-700">
                  Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    id="signup-password"
                    type="password"
                    autoComplete="new-password"
                    placeholder="••••••••"
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    className="pl-10 h-12 rounded-2xl border-2"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-confirm-password" className="font-bold text-slate-700">
                  Confirm Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    id="signup-confirm-password"
                    type="password"
                    autoComplete="new-password"
                    placeholder="••••••••"
                    value={signupConfirmPassword}
                    onChange={(e) => setSignupConfirmPassword(e.target.value)}
                    className="pl-10 h-12 rounded-2xl border-2"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-2xl bg-sky-50 border-2 border-sky-100 p-3">
              <Checkbox
                id="terms"
                checked={acceptedTerms}
                onCheckedChange={(value) => setAcceptedTerms(Boolean(value))}
                className="mt-0.5 data-[state=checked]:bg-sky-500 data-[state=checked]:border-sky-500"
              />
              <Label
                htmlFor="terms"
                className="text-sm font-bold text-slate-700 leading-snug cursor-pointer"
              >
                I am a parent or guardian aged 18 or over, and I agree to the{' '}
                <Link to="/terms" target="_blank" className="text-sky-600 underline hover:text-sky-700">
                  Terms and Conditions
                </Link>
                .
              </Label>
            </div>

            <Button
              type="submit"
              className="w-full h-12 rounded-2xl bg-sky-500 hover:bg-sky-600 text-white font-bold text-base"
              disabled={loading || !acceptedTerms}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating account...
                </>
              ) : (
                'Create parent account'
              )}
            </Button>
          </form>

          <div className="mt-4 text-center text-sm font-semibold">
            <button
              type="button"
              onClick={moveToChildLogin}
              className="text-slate-500 hover:text-sky-600 hover:underline"
            >
              Back
            </button>
          </div>
        </>
      )}

      {view === VIEW.PARENT_SIGNUP_OTP && (
        <>
          <h2 className="text-2xl font-extrabold text-slate-800 text-center mb-5">Verify your email</h2>

          {error && (
            <div
              key={error.id}
              role="alert"
              className="mb-4 p-3 rounded-2xl border border-red-300 bg-red-50 text-red-600 text-sm font-bold flex items-start justify-between gap-3"
            >
              <span className="flex-1">{error.message}</span>
              <button
                type="button"
                onClick={dismissError}
                className="text-red-500 hover:text-red-700 transition-colors"
                aria-label="Dismiss error"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {notice && (
            <div className="mb-4 p-3 rounded-2xl border border-sky-200 bg-sky-50 text-sky-700 text-sm font-bold text-center">
              {notice.message}
            </div>
          )}

          <p className="text-sm text-muted-foreground font-semibold text-center mb-5">
            We sent an 8-digit code to <span className="text-slate-700">{signupEmail}</span>. Enter it below to
            finish creating your account.
          </p>

          <form onSubmit={handleVerifyParentOtp} className="space-y-4">
            <div className="flex justify-center">
              <InputOTP maxLength={8} value={otpCode} onChange={setOtpCode} autoFocus>
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                  <InputOTPSlot index={6} />
                  <InputOTPSlot index={7} />
                </InputOTPGroup>
              </InputOTP>
            </div>

            <Button
              type="submit"
              className="w-full h-12 rounded-2xl bg-sky-500 hover:bg-sky-600 text-white font-bold text-base"
              disabled={loading || otpCode.length !== 8}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Verifying...
                </>
              ) : (
                'Verify and continue'
              )}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-4 font-semibold">
            Didn't receive the email?{" "}
            <button
              type="button"
              onClick={handleResendParentOtp}
              disabled={resendLoading || resendCooldown > 0}
              className="text-sky-600 font-bold hover:underline disabled:opacity-50 disabled:no-underline"
            >
              {resendLoading
                ? 'Resending...'
                : resendCooldown > 0
                ? `Resend in ${resendCooldown}s`
                : 'Resend'}
            </button>
          </p>

          <div className="mt-4 text-center text-sm font-semibold">
            <button
              type="button"
              onClick={() => {
                setView(VIEW.PARENT_SIGNUP);
                setError(null);
                setNotice(null);
              }}
              className="text-slate-500 hover:text-sky-600 hover:underline"
            >
              Back
            </button>
          </div>
        </>
      )}

      {view === VIEW.CHILD_SIGNUP_BLOCKED && (
        <>
          <h2 className="text-2xl font-extrabold text-slate-800 text-center mb-2">Hey, kiddo!</h2>
          <p className="text-sm text-slate-600 font-semibold text-center mb-6">
            Kids can't make their own account. Ask a parent to set one up for you, and they'll give
            you your username and password.
          </p>
          <Button className="w-full" onClick={moveToChildLogin}>
            Back
          </Button>
        </>
      )}
    </FinnAuthLayout>
  );
}