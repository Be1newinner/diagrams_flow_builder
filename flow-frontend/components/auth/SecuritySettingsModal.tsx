'use client';

import React, { useState, useEffect } from 'react';
import { X, ShieldCheck, Monitor, LogOut, Loader2, AlertCircle, CheckCircle2, Lock } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

interface SessionRecord {
  jti: string;
  userAgent: string;
  ip: string;
  createdAt: string;
}

interface SecuritySettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// A crude but dependency-free UA summary — good enough to tell two sessions
// apart in a list ("Chrome on Mac" vs "Safari on iPhone"), not a full parse.
function summarizeUserAgent(ua: string): string {
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /Chrome\//.test(ua)
    ? 'Chrome'
    : /Firefox\//.test(ua)
    ? 'Firefox'
    : /Safari\//.test(ua)
    ? 'Safari'
    : 'Unknown browser';
  const os = /Windows/.test(ua)
    ? 'Windows'
    : /Mac OS X/.test(ua)
    ? 'macOS'
    : /Android/.test(ua)
    ? 'Android'
    : /iPhone|iPad/.test(ua)
    ? 'iOS'
    : /Linux/.test(ua)
    ? 'Linux'
    : 'Unknown OS';
  return `${browser} on ${os}`;
}

export function SecuritySettingsModal({ isOpen, onClose }: SecuritySettingsModalProps) {
  const { user, refreshUser } = useAuth();

  // null = not fetched yet (renders the loading state); [] = fetched, empty.
  // Distinguishing the two this way means the effect below never needs a
  // separate "loading" flag it would otherwise have to set synchronously.
  const [sessions, setSessions] = useState<SessionRecord[] | null>(null);
  const [currentJti, setCurrentJti] = useState<string | undefined>();
  const [revokingJti, setRevokingJti] = useState<string | null>(null);

  const [twoFactorPromptOpen, setTwoFactorPromptOpen] = useState(false);
  const [pendingEnabled, setPendingEnabled] = useState(false);
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Fetching on open is a legitimate effect (syncing with the server); the
  // transient UI resets below are handled in handleClose instead — resetting
  // them here in response to `isOpen` flipping is the anti-pattern React's
  // own docs warn against (state that should reset "when this reopens" is
  // simpler to reset "when this closes," from an event handler).
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    fetch('/api/auth/sessions')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        setSessions(data?.sessions || []);
        setCurrentJti(data?.currentJti);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleClose = () => {
    setError(null);
    setSuccess(null);
    setTwoFactorPromptOpen(false);
    setPassword('');
    setSessions(null);
    setCurrentJti(undefined);
    onClose();
  };

  const handleRevoke = async (jti: string) => {
    setRevokingJti(jti);
    try {
      const res = await fetch(`/api/auth/sessions/${jti}`, { method: 'DELETE' });
      if (res.ok) {
        setSessions((prev) => (prev ? prev.filter((s) => s.jti !== jti) : prev));
      }
    } finally {
      setRevokingJti(null);
    }
  };

  const startTwoFactorToggle = (nextEnabled: boolean) => {
    setError(null);
    setSuccess(null);
    setPendingEnabled(nextEnabled);
    setPassword('');
    setTwoFactorPromptOpen(true);
  };

  const confirmTwoFactorToggle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setError('Please enter your password to confirm.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/two-factor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: pendingEnabled, password }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Failed to update two-factor authentication.');
        return;
      }
      await refreshUser();
      setSuccess(pendingEnabled ? 'Two-factor authentication enabled.' : 'Two-factor authentication disabled.');
      setTwoFactorPromptOpen(false);
      setPassword('');
    } catch (err: any) {
      setError(err.message || 'Network error.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-4" onClick={handleClose}>
      <div
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-slate-100 flex items-center justify-between shrink-0">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-blue-600" />
            Security
          </h2>
          <button onClick={handleClose} className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-5 overflow-y-auto text-xs">
          {error && (
            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{success}</span>
            </div>
          )}

          {/* Two-Factor Authentication */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold text-slate-800">Two-Factor Authentication</span>
              <button
                onClick={() => startTwoFactorToggle(!user?.twoFactorEnabled)}
                className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer ${
                  user?.twoFactorEnabled ? 'bg-blue-600' : 'bg-slate-200'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                    user?.twoFactorEnabled ? 'translate-x-4' : ''
                  }`}
                />
              </button>
            </div>
            <p className="text-slate-400 leading-relaxed">
              {user?.twoFactorEnabled
                ? 'Enabled — a 6-digit email code is required every time you sign in.'
                : 'Off — turn this on to require a 6-digit email code on every sign-in.'}
            </p>

            {twoFactorPromptOpen && (
              <form onSubmit={confirmTwoFactorToggle} className="mt-2.5 p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
                <label className="block font-medium text-slate-600">
                  Confirm your password to {pendingEnabled ? 'enable' : 'disable'} two-factor authentication
                </label>
                <div className="relative">
                  <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
                  <input
                    type="password"
                    autoFocus
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-7 pr-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500"
                    placeholder="Current password"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 cursor-pointer"
                  >
                    {submitting && <Loader2 className="w-3 h-3 animate-spin" />}
                    Confirm
                  </button>
                  <button
                    type="button"
                    onClick={() => setTwoFactorPromptOpen(false)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:bg-slate-100 cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Active Sessions */}
          <div className="pt-4 border-t border-slate-100">
            <span className="font-semibold text-slate-800 block mb-2">Active Sessions</span>
            {sessions === null ? (
              <div className="flex items-center gap-2 text-slate-400 py-3">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Loading sessions…
              </div>
            ) : sessions.length === 0 ? (
              <p className="text-slate-400 italic py-2">No active sessions found.</p>
            ) : (
              <ul className="space-y-1.5">
                {sessions.map((s) => (
                  <li
                    key={s.jti}
                    className="flex items-center gap-2.5 p-2.5 rounded-lg border border-slate-200 bg-white"
                  >
                    <Monitor className="w-4 h-4 text-slate-400 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-slate-800 truncate flex items-center gap-1.5">
                        {summarizeUserAgent(s.userAgent)}
                        {s.jti === currentJti && (
                          <span className="px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[9px] font-bold border border-emerald-200">
                            This device
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">
                        {s.ip} · signed in {new Date(s.createdAt).toLocaleString()}
                      </div>
                    </div>
                    {s.jti !== currentJti && (
                      <button
                        onClick={() => handleRevoke(s.jti)}
                        disabled={revokingJti === s.jti}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors shrink-0 cursor-pointer disabled:opacity-50"
                        title="Sign out this device"
                      >
                        {revokingJti === s.jti ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <LogOut className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
