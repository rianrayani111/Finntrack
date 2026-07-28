import React, { useState } from "react";
import { db } from '@/api/base44Client';
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Lock, Loader2, UserPlus, User } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import FinnAuthLayout from "@/components/FinnAuthLayout";
import { toast } from "@/components/ui/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { CreditCard, Sparkles, Wallet, Zap } from "lucide-react";

const PLANS = [
  { id: "monthly", label: "Monthly", price: "$4.99/mo", icon: Zap, note: "Cancel anytime" },
  { id: "annual", label: "Annual", price: "$39/yr", icon: Sparkles, note: "Save 34%" },
  { id: "lifetime", label: "One-time", price: "$89", icon: Wallet, note: "Pay once" },
];

export default function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showOtp, setShowOtp] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [plan, setPlan] = useState("monthly");

  const handlePayment = () => {
    toast({
      title: "Coming soon",
      description: "Payments aren't active yet — this is a preview.",
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (!acceptedTerms) {
      setError("Please read and accept the Terms and Conditions to continue.");
      return;
    }
    setLoading(true);
    try {
      await db.auth.register({ email, password });
      setShowOtp(true);
    } catch (err) {
      setError(err.message || "Registration failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    setError("");
    setLoading(true);
    try {
      const result = await db.auth.verifyOtp({ email, otpCode });
      if (result?.access_token) {
        db.auth.setToken(result.access_token);
        // Save child profile details
        try {
          await db.auth.updateMe({
            username: username.trim(),
          });
        } catch (e) {
          /* profile save is best-effort */
        }
      }
      window.location.href = "/";
    } catch (err) {
      setError(err.message || "Invalid verification code.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError("");
    try {
      await db.auth.resendOtp(email);
      toast({ title: "Code sent", description: "Check your email for the new code." });
    } catch (err) {
      setError(err.message || "Failed to resend code.");
    }
  };

  if (showOtp) {
    return (
      <FinnAuthLayout showMascot={false}>
        <h2 className="text-2xl font-extrabold text-slate-800 text-center mb-1">Verify your email</h2>
        <p className="text-sm text-muted-foreground font-semibold text-center mb-2">
          We sent a code to {email}
        </p>
        <p className="text-xs text-muted-foreground text-center mb-5">
          For local preview, any 6-digit code will verify.
        </p>

        {error && (
          <div className="mb-4 p-3 rounded-2xl bg-red-50 text-red-500 text-sm font-bold text-center">
            {error}
          </div>
        )}

        <div className="flex justify-center mb-6">
          <InputOTP
            maxLength={6}
            value={otpCode}
            onChange={setOtpCode}
            autoFocus
            autoComplete="one-time-code"
          >
            <InputOTPGroup>
              <InputOTPSlot index={0} />
              <InputOTPSlot index={1} />
              <InputOTPSlot index={2} />
              <InputOTPSlot index={3} />
              <InputOTPSlot index={4} />
              <InputOTPSlot index={5} />
            </InputOTPGroup>
          </InputOTP>
        </div>

        <Button
          className="w-full h-12 rounded-2xl bg-sky-500 hover:bg-sky-600 text-white font-bold"
          onClick={handleVerify}
          disabled={loading || otpCode.length < 6}
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Verifying...
            </>
          ) : (
            "Verify"
          )}
        </Button>

        <p className="text-center text-sm text-muted-foreground mt-4 font-semibold">
          Didn't receive the code?{" "}
          <button onClick={handleResend} className="text-sky-600 font-bold hover:underline">
            Resend
          </button>
        </p>
      </FinnAuthLayout>
    );
  }

  return (
    <FinnAuthLayout showMascot={false}>
      <h2 className="text-2xl font-extrabold text-slate-800 text-center mb-1">Create Account</h2>
      <p className="text-sm text-muted-foreground font-semibold text-center mb-5">
        Start your money-smart journey
      </p>

      {error && (
        <div className="mb-4 p-3 rounded-2xl bg-red-50 text-red-500 text-sm font-bold text-center">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Payment options */}
        <div className="mb-2">
          <div className="flex items-center gap-2 mb-2">
            <CreditCard className="w-4 h-4 text-sky-500" />
            <span className="font-bold text-slate-700 text-sm">Choose your plan</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {PLANS.map((p) => {
              const Icon = p.icon;
              const selected = plan === p.id;
              return (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => setPlan(p.id)}
                  className={`rounded-2xl border-2 p-3 text-left transition ${
                    selected
                      ? "border-sky-500 bg-sky-50"
                      : "border-slate-200 bg-white hover:border-sky-300"
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 mb-1 ${selected ? "text-sky-500" : "text-slate-400"}`}
                  />
                  <div className="text-sm font-extrabold text-slate-800">{p.label}</div>
                  <div className="text-xs font-bold text-sky-600">{p.price}</div>
                  <div className="text-[10px] text-muted-foreground font-semibold">
                    {p.note}
                  </div>
                </button>
              );
            })}
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={handlePayment}
            className="w-full h-10 mt-2 rounded-2xl border-2 border-sky-200 text-sky-600 font-bold hover:bg-sky-50"
          >
            <CreditCard className="w-4 h-4 mr-2" />
            Pay & activate
          </Button>
          <p className="text-[11px] text-muted-foreground font-semibold text-center mt-1">
            A parent or guardian over 18 must complete this payment.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="username" className="font-bold text-slate-700">
            Username
          </Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              id="username"
              placeholder="Your nickname"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="pl-10 h-12 rounded-2xl border-2"
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="email" className="font-bold text-slate-700">
            Email
          </Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-10 h-12 rounded-2xl border-2"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="password" className="font-bold text-slate-700">
              Password
            </Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10 h-12 rounded-2xl border-2"
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm" className="font-bold text-slate-700">
              Confirm
            </Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                id="confirm"
                type="password"
                autoComplete="new-password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
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
            onCheckedChange={(v) => setAcceptedTerms(!!v)}
            className="mt-0.5 data-[state=checked]:bg-sky-500 data-[state=checked]:border-sky-500"
          />
          <Label
            htmlFor="terms"
            className="text-sm font-bold text-slate-700 leading-snug cursor-pointer"
          >
            I have read and accept the{" "}
            <Link
              to="/terms"
              target="_blank"
              className="text-sky-600 underline hover:text-sky-700"
            >
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
            <>
              <UserPlus className="w-4 h-4 mr-2" />
              Create account
            </>
          )}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground mt-4 font-semibold">
        Already have an account?{" "}
        <Link to="/login" className="text-sky-600 font-bold hover:underline">
          Log in
        </Link>
      </p>
    </FinnAuthLayout>
  );
}