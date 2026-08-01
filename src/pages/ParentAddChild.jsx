import React, { useEffect, useMemo, useState } from 'react';
import { db } from '@/api/db';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';

const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

export default function ParentAddChild() {
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [usernameAvailable, setUsernameAvailable] = useState(null);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [saving, setSaving] = useState(false);
  const [createdCreds, setCreatedCreds] = useState(null);

  const usernameFormatValid = USERNAME_PATTERN.test(username.trim().toLowerCase());

  const canSubmit = useMemo(() => {
    return (
      displayName.trim() &&
      username.trim() &&
      usernameFormatValid &&
      password &&
      confirmPassword &&
      password === confirmPassword &&
      usernameAvailable === true
    );
  }, [displayName, username, usernameFormatValid, password, confirmPassword, usernameAvailable]);

  useEffect(() => {
    const cleanUsername = username.trim().toLowerCase();
    if (!cleanUsername || !USERNAME_PATTERN.test(cleanUsername)) {
      setUsernameAvailable(null);
      return;
    }

    let isActive = true;
    setCheckingUsername(true);

    db.users
      .checkUsernameAvailability(cleanUsername)
      .then((result) => {
        if (!isActive) return;
        setUsernameAvailable(Boolean(result?.available));
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

  const handleCreateChild = async (event) => {
    event.preventDefault();

    if (password !== confirmPassword) {
      toast({ title: 'Passwords do not match.', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const result = await db.auth.createChildWithSecondaryApp({
        displayName: displayName.trim(),
        username: username.trim().toLowerCase(),
        password,
      });

      setCreatedCreds({
        displayName: displayName.trim(),
        username: result.username,
        password,
        parentStayedLoggedIn: result.parentStayedLoggedIn,
      });

      setDisplayName('');
      setUsername('');
      setPassword('');
      setConfirmPassword('');
      setUsernameAvailable(null);

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

  return (
    <div className="max-w-2xl space-y-4">
      <div className="finn-card">
        <h1 className="text-2xl font-extrabold text-slate-800">Add a Child</h1>
        <p className="text-sm text-muted-foreground font-semibold mt-1">
          Create a child username + password. Kids never sign up with email.
        </p>

        <form className="space-y-4 mt-6" onSubmit={handleCreateChild}>
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
                required
              />
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

          <Button className="w-full" type="submit" disabled={saving || !canSubmit}>
            {saving ? 'Creating...' : 'Create Child Account'}
          </Button>
        </form>
      </div>

      {createdCreds && (
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
          <p className="text-xs text-slate-600 font-semibold mt-3">
            Parent session preserved after child creation: {createdCreds.parentStayedLoggedIn ? 'Yes' : 'No'}
          </p>
        </div>
      )}
    </div>
  );
}
