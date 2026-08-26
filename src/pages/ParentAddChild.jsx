import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { db } from '@/api/db';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';
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
} from '@/components/ui/alert-dialog';
import { Trash2 } from 'lucide-react';

const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;
// Matches what the create-child-account / update-child-password edge functions
// enforce. Checked here too so a short password fails in the form instead of
// after a round-trip — which matters most in the post-checkout resume flow
// below, where a rejected attempt discards the stashed pending child.
const MIN_PASSWORD_LENGTH = 6;
const PENDING_CHILD_KEY = 'finntrack_pending_child';
const RESUME_MAX_ATTEMPTS = 10;
const RESUME_RETRY_DELAY_MS = 1500;

const INTERVAL_OPTIONS = [
  { value: 'month', label: 'Monthly', price: '$3.99', priceSuffix: 'billed monthly' },
  { value: 'year', label: 'Annual', price: '$19.99', priceSuffix: 'billed annually', badge: 'Save over 55%' },
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default function ParentAddChild() {
  const { childCount, addonSubscriptionStatus, refreshSubscription } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [children, setChildren] = useState([]);
  const [loadingChildren, setLoadingChildren] = useState(true);
  const [childrenLoadError, setChildrenLoadError] = useState('');
  const [deletingId, setDeletingId] = useState(null);

  const [showForm, setShowForm] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [usernameAvailable, setUsernameAvailable] = useState(null);
  const [usernameCheckError, setUsernameCheckError] = useState(false);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [interval, setInterval_] = useState('month');
  const [saving, setSaving] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [createdCreds, setCreatedCreds] = useState(null);

  const [resuming, setResuming] = useState(false);
  const [resumeError, setResumeError] = useState(null);
  const [resumePending, setResumePending] = useState(null); // { displayName, username } from a stashed checkout, password never included
  const [resumePassword, setResumePassword] = useState('');
  const [resumeConfirmPassword, setResumeConfirmPassword] = useState('');

  const needsCheckout = (childCount ?? 0) >= 1 && addonSubscriptionStatus !== 'active';
  const usernameFormatValid = USERNAME_PATTERN.test(username.trim().toLowerCase());

  const canSubmit = useMemo(() => {
    return (
      displayName.trim() &&
      username.trim() &&
      usernameFormatValid &&
      password.length >= MIN_PASSWORD_LENGTH &&
      confirmPassword &&
      password === confirmPassword &&
      usernameAvailable === true
    );
  }, [displayName, username, usernameFormatValid, password, confirmPassword, usernameAvailable]);

  const loadChildren = async () => {
    setLoadingChildren(true);
    try {
      const docs = await db.users.listMyChildren();
      setChildren(docs || []);
      setChildrenLoadError('');
    } catch (error) {
      // Without this the rejection was unhandled and the list fell through to
      // "No child accounts yet." — telling a parent who has children that they
      // have none, and offering to bill them for a "first child" they already own.
      setChildrenLoadError(error.message || 'Could not load your children. Please refresh and try again.');
    } finally {
      setLoadingChildren(false);
    }
  };

  useEffect(() => {
    loadChildren();
  }, []);

  useEffect(() => {
    const cleanUsername = username.trim().toLowerCase();
    if (!cleanUsername || !USERNAME_PATTERN.test(cleanUsername)) {
      setUsernameAvailable(null);
      return;
    }

    let isActive = true;
    setCheckingUsername(true);
    setUsernameAvailable(null);
    setUsernameCheckError(false);

    db.users
      .checkUsernameAvailability(cleanUsername)
      .then((result) => {
        if (!isActive) return;
        setUsernameAvailable(Boolean(result?.available));
      })
      .catch(() => {
        // Without this the rejection was unhandled and the hint stayed on
        // "Type a username to check availability" forever, with the submit
        // button permanently disabled and no explanation.
        if (isActive) setUsernameCheckError(true);
      })
      .finally(() => {
        if (isActive) {
          setCheckingUsername(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [username]);

  const resetForm = () => {
    setDisplayName('');
    setUsername('');
    setPassword('');
    setConfirmPassword('');
    setUsernameAvailable(null);
    setShowForm(false);
  };

  const handleCreated = (payload, result) => {
    setCreatedCreds({
      displayName: payload.displayName,
      username: result.username,
      password: payload.password,
      parentStayedLoggedIn: result.parentStayedLoggedIn,
    });
    resetForm();
    refreshSubscription();
    loadChildren();
  };

  const clearCheckoutParam = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('checkout');
    setSearchParams(next, { replace: true });
  };

  // Only recovers displayName/username from the checkout round-trip. The
  // password is never stashed, so finishing account creation always requires
  // the parent to re-enter it below.
  const checkForPendingChild = async () => {
    const stashed = sessionStorage.getItem(PENDING_CHILD_KEY);
    if (!stashed) return;
    try {
      const { displayName, username } = JSON.parse(stashed);
      setResumePending({ displayName, username });
    } catch {
      sessionStorage.removeItem(PENDING_CHILD_KEY);
    }
  };

  const handleResumeSubmit = async (event) => {
    event.preventDefault();
    if (resumePassword.length < MIN_PASSWORD_LENGTH) {
      toast({
        title: 'Password too short',
        description: `Use at least ${MIN_PASSWORD_LENGTH} characters.`,
        variant: 'destructive',
      });
      return;
    }
    if (resumePassword !== resumeConfirmPassword) {
      toast({ title: 'Passwords do not match.', variant: 'destructive' });
      return;
    }

    const payload = { ...resumePending, password: resumePassword };
    setResuming(true);
    setResumeError(null);

    for (let attempt = 1; attempt <= RESUME_MAX_ATTEMPTS; attempt += 1) {
      try {
        const result = await db.auth.createChildWithSecondaryApp(payload);
        sessionStorage.removeItem(PENDING_CHILD_KEY);
        setResuming(false);
        setResumePending(null);
        handleCreated(payload, result);
        toast({ title: 'Payment successful. Child account created.' });
        return;
      } catch (err) {
        const stillActivating = err.status === 402 && attempt < RESUME_MAX_ATTEMPTS;
        if (stillActivating) {
          await sleep(RESUME_RETRY_DELAY_MS);
          continue;
        }
        setResuming(false);
        sessionStorage.removeItem(PENDING_CHILD_KEY);
        setResumeError(err.message || 'Could not finish creating the child account. Please try again.');
        return;
      }
    }
  };

  useEffect(() => {
    const checkoutState = searchParams.get('checkout');
    if (checkoutState === 'success') {
      checkForPendingChild().finally(clearCheckoutParam);
    } else if (checkoutState === 'cancelled') {
      sessionStorage.removeItem(PENDING_CHILD_KEY);
      toast({ title: 'Checkout cancelled.' });
      clearCheckoutParam();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (password.length < MIN_PASSWORD_LENGTH) {
      toast({
        title: 'Password too short',
        description: `Use at least ${MIN_PASSWORD_LENGTH} characters.`,
        variant: 'destructive',
      });
      return;
    }
    if (password !== confirmPassword) {
      toast({ title: 'Passwords do not match.', variant: 'destructive' });
      return;
    }

    const payload = {
      displayName: displayName.trim(),
      username: username.trim().toLowerCase(),
      password,
    };

    if (needsCheckout) {
      setRedirecting(true);
      try {
        sessionStorage.setItem(
          PENDING_CHILD_KEY,
          JSON.stringify({ displayName: payload.displayName, username: payload.username })
        );
        const { url } = await db.billing.createCheckoutSession(interval, '/parent/add-child', 'addon');
        window.location.href = url;
      } catch (err) {
        sessionStorage.removeItem(PENDING_CHILD_KEY);
        toast({ title: 'Could not start checkout', description: err.message, variant: 'destructive' });
        setRedirecting(false);
      }
      return;
    }

    setSaving(true);
    try {
      const result = await db.auth.createChildWithSecondaryApp(payload);
      handleCreated(payload, result);
      toast({ title: 'Child account created.' });
    } catch (error) {
      toast({
        title: 'Could not create child account',
        description: error.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteChild = async (child) => {
    setDeletingId(child.uid);
    try {
      await db.users.deleteChild(child.uid);
      await refreshSubscription();
      await loadChildren();
      toast({ title: `${child.displayName}'s account was deleted.` });
    } catch (err) {
      toast({ title: 'Could not delete child', description: err.message, variant: 'destructive' });
    } finally {
      setDeletingId(null);
    }
  };

  if (resuming) {
    return (
      <div className="max-w-2xl">
        <div className="finn-card text-center space-y-3 py-10">
          <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin mx-auto" />
          <p className="text-sm font-bold text-slate-700">Finishing setting up your child's account...</p>
        </div>
      </div>
    );
  }

  if (resumeError) {
    return (
      <div className="max-w-2xl">
        <div className="finn-card border-2 border-red-200 bg-red-50 space-y-3 text-center">
          <p className="text-sm font-bold text-red-700">{resumeError}</p>
          <Button onClick={() => setResumeError(null)} className="w-full">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (resumePending) {
    return (
      <div className="max-w-2xl">
        <div className="finn-card space-y-4">
          <div>
            <h2 className="font-extrabold text-slate-800">
              Finish setting up {resumePending.displayName}'s account
            </h2>
            <p className="text-sm text-muted-foreground font-semibold mt-1">
              Payment successful. Set a password for @{resumePending.username} to finish creating their account.
            </p>
          </div>
          <form className="space-y-4" onSubmit={handleResumeSubmit}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="resume-password">Password</Label>
                <Input
                  id="resume-password"
                  type="password"
                  value={resumePassword}
                  onChange={(event) => setResumePassword(event.target.value)}
                  minLength={MIN_PASSWORD_LENGTH}
                  required
                />
                <p className="text-xs font-semibold text-muted-foreground">
                  At least {MIN_PASSWORD_LENGTH} characters.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="resume-confirm-password">Confirm Password</Label>
                <Input
                  id="resume-confirm-password"
                  type="password"
                  value={resumeConfirmPassword}
                  onChange={(event) => setResumeConfirmPassword(event.target.value)}
                  required
                />
              </div>
            </div>
            <Button
              className="w-full"
              type="submit"
              disabled={resumePassword.length < MIN_PASSWORD_LENGTH || !resumeConfirmPassword}
            >
              Finish creating account
            </Button>
          </form>
        </div>
      </div>
    );
  }

  if (createdCreds) {
    return (
      <div className="max-w-2xl">
        <div className="finn-card border-2 border-sky-200 bg-sky-50">
          <h2 className="font-extrabold text-slate-800">Share these with your child now</h2>
          <p className="text-sm text-slate-700 font-semibold mt-1">
            Write these down. This is shown once after creation.
          </p>
          <div className="mt-4 space-y-1 text-sm font-bold text-slate-800">
            <p>Name: {createdCreds.displayName}</p>
            <p>Username: {createdCreds.username}</p>
            <p>Password: {createdCreds.password}</p>
          </div>
          <Button className="w-full mt-4" onClick={() => setCreatedCreds(null)}>
            Done
          </Button>
        </div>
      </div>
    );
  }

  if (showForm) {
    return (
      <div className="max-w-2xl space-y-4">
        <div className="finn-card">
          <button
            type="button"
            className="text-sm font-bold text-slate-500 hover:text-slate-700 mb-3"
            onClick={() => setShowForm(false)}
          >
            ← Back
          </button>

          <h1 className="text-2xl font-extrabold text-slate-800">Add a Child</h1>
          <p className="text-sm text-muted-foreground font-semibold mt-1">
            Create a child username + password. Kids never sign up with email.
          </p>
          <p className="text-sm font-bold text-emerald-600 mt-2">
            {needsCheckout ? "You'll pay after entering your child's info." : 'This child is free.'}
          </p>

          <form className="space-y-4 mt-6" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="displayName">Display Name</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Maya"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="maya"
                required
              />
              <p className="text-xs font-semibold text-muted-foreground">
                {username.trim() && !usernameFormatValid
                  ? 'Usernames can only contain lowercase letters, numbers, and underscores (3-20 characters). Do not use an email address.'
                  : checkingUsername
                  ? 'Checking username...'
                  : usernameCheckError
                  ? 'Could not check that username right now. Please try again.'
                  : usernameAvailable === null
                  ? 'Type a username to check availability.'
                  : usernameAvailable
                  ? 'Username is available.'
                  : 'Username is already taken.'}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  minLength={MIN_PASSWORD_LENGTH}
                  required
                />
                <p className="text-xs font-semibold text-muted-foreground">
                  At least {MIN_PASSWORD_LENGTH} characters.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  required
                />
              </div>
            </div>

            {needsCheckout && (
              <div className="space-y-2">
                <Label>Billing plan</Label>
                <div className="grid grid-cols-2 gap-3">
                  {INTERVAL_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setInterval_(opt.value)}
                      className={`relative flex flex-col items-center justify-center gap-0.5 rounded-2xl border-2 py-3 font-bold transition-colors ${
                        interval === opt.value
                          ? 'border-slate-800 bg-slate-800 text-white'
                          : 'border-slate-200 text-slate-600'
                      }`}
                    >
                      {opt.badge && (
                        <span className="absolute -top-2.5 inset-x-0 flex justify-center">
                          <span className="whitespace-nowrap rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-extrabold text-white">
                            {opt.badge}
                          </span>
                        </span>
                      )}
                      <span>{opt.label}</span>
                      <span
                        className={`text-xs font-semibold ${
                          interval === opt.value ? 'text-slate-300' : 'text-slate-400'
                        }`}
                      >
                        {opt.price} · {opt.priceSuffix}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <Button className="w-full" type="submit" disabled={saving || redirecting || !canSubmit}>
              {redirecting
                ? 'Redirecting to payment...'
                : saving
                ? 'Creating...'
                : needsCheckout
                ? 'Continue to Payment'
                : 'Create Child Account'}
            </Button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div className="finn-card">
        <h1 className="text-2xl font-extrabold text-slate-800">Your Children</h1>

        {loadingChildren ? (
          <p className="text-sm text-muted-foreground font-semibold mt-4">Loading...</p>
        ) : childrenLoadError ? (
          <p className="text-sm text-red-600 font-semibold mt-4">{childrenLoadError}</p>
        ) : children.length === 0 ? (
          <p className="text-sm text-muted-foreground font-semibold mt-4">No child accounts yet.</p>
        ) : (
          <div className="space-y-3 mt-4">
            {children.map((child) => (
              <div
                key={child.uid}
                className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3"
              >
                <div>
                  <p className="font-extrabold text-slate-800">{child.displayName}</p>
                  <p className="text-sm text-muted-foreground font-semibold">@{child.username}</p>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2 text-red-600 border-red-200 hover:bg-red-50">
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete {child.displayName}'s account?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This permanently deletes their account and all their transactions, goals, and alerts. You'll
                        stop being charged for this child right away. This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-red-600 text-white hover:bg-red-700"
                        onClick={() => handleDeleteChild(child)}
                        disabled={deletingId === child.uid}
                      >
                        {deletingId === child.uid ? 'Deleting...' : 'Delete child account'}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            ))}
          </div>
        )}

        <Button className="w-full mt-6" onClick={() => setShowForm(true)}>
          {(childCount ?? 0) === 0 ? 'Add a Child (Free)' : 'Add a Child ($3.99/month or $19.99/year)'}
        </Button>
      </div>
    </div>
  );
}
