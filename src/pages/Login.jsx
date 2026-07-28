import React, { useState } from "react";
import { Link } from "react-router-dom";

import { useAuth } from '@/lib/AuthContext';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Lock, Loader2, LogIn, X } from "lucide-react";
import FinnAuthLayout from "@/components/FinnAuthLayout";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e?.preventDefault?.();

    const form = e?.currentTarget;
    const nextEmail = form?.elements?.namedItem?.("email")?.value ?? email;
    const nextPassword = form?.elements?.namedItem?.("password")?.value ?? password;

    setError(null);
    setLoading(true);
    try {
      await login(nextEmail, nextPassword);
      setError(null);
      window.location.assign("/");
    } catch (err) {
      setError({
        id: Date.now(),
        message: err?.message || "Incorrect email or password."
      });
    } finally {
      setLoading(false);
    }
  };

  const dismissError = () => {
    setError(null);
  };

  return (
    <FinnAuthLayout mascotMessage="Welcome back, friend!">
      <h2 className="text-2xl font-extrabold text-slate-800 text-center mb-1">Log In</h2>
      <p className="text-sm text-muted-foreground font-semibold text-center mb-5">
        Dive back into your money tracker
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

      <form onSubmit={handleSubmit} className="space-y-4">
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
              autoFocus
              placeholder="you@example.com"
              name="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-10 h-12 rounded-2xl border-2"
              required
            />
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className="font-bold text-slate-700">
              Password
            </Label>
            <Link to="/forgot-password" className="text-xs text-sky-600 font-bold hover:underline">
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              name="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-10 h-12 rounded-2xl border-2"
              required
            />
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

      <Link to="/register">
        <Button
          variant="outline"
          className="w-full h-12 rounded-2xl font-bold mt-3 border-2 border-sky-200 text-sky-600 hover:bg-sky-50"
        >
          Create Account
        </Button>
      </Link>
    </FinnAuthLayout>
  );
}