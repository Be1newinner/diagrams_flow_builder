'use client';

import React, { useState, useEffect } from 'react';
import { X, Share2, Mail, Globe2, Loader2, AlertCircle, CheckCircle2, UserMinus, Copy, Check } from 'lucide-react';

interface ShareViewer {
  userId: string;
  name: string;
  email: string;
  accesstype: 'EDITOR' | 'VIEWER';
}

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  diagramId: string;
  diagramTitle: string;
}

export function ShareModal({ isOpen, onClose, diagramId, diagramTitle }: ShareModalProps) {
  // null = not fetched yet (renders the loading state) — same pattern as
  // SecuritySettingsModal, avoids a synchronous setState-in-effect for a
  // separate "loading" flag.
  const [viewers, setViewers] = useState<ShareViewer[] | null>(null);
  const [isPublic, setIsPublic] = useState(false);
  const [togglingPublic, setTogglingPublic] = useState(false);
  const [revokingUserId, setRevokingUserId] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  const [email, setEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'EDITOR' | 'VIEWER'>('VIEWER');
  const [inviting, setInviting] = useState(false);
  const [changingRoleUserId, setChangingRoleUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Fetching current sharing state on open is a legitimate effect (syncing
  // with the server); transient UI resets live in handleClose instead.
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    fetch(`/api/diagrams/${diagramId}/share`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        setViewers(data?.viewers || []);
        setIsPublic(data?.isPublic === true);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, diagramId]);

  if (!isOpen) return null;

  const handleClose = () => {
    setEmail('');
    setInviteRole('VIEWER');
    setError(null);
    setSuccess(null);
    setLinkCopied(false);
    setViewers(null);
    onClose();
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setInviting(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/diagrams/${diagramId}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), accesstype: inviteRole }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Failed to share diagram.');
        return;
      }
      setSuccess(`Invite sent to ${email.trim()} as ${inviteRole === 'EDITOR' ? 'an editor' : 'a viewer'}.`);
      setEmail('');
      // Re-fetch instead of guessing the new viewer's name/email locally.
      const refreshed = await fetch(`/api/diagrams/${diagramId}/share`);
      if (refreshed.ok) {
        const refreshedData = await refreshed.json();
        setViewers(refreshedData?.viewers || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error.');
    } finally {
      setInviting(false);
    }
  };

  // Re-inviting an already-shared email changes their role instead of
  // being a no-op (see shareDiagramWithUser) — reused here to promote a
  // viewer to editor or demote an editor back to viewer.
  const handleChangeRole = async (v: ShareViewer, nextRole: 'EDITOR' | 'VIEWER') => {
    if (v.accesstype === nextRole) return;
    setChangingRoleUserId(v.userId);
    setError(null);
    try {
      const res = await fetch(`/api/diagrams/${diagramId}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: v.email, accesstype: nextRole }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Failed to change role.');
        return;
      }
      setViewers((prev) =>
        prev ? prev.map((p) => (p.userId === v.userId ? { ...p, accesstype: nextRole } : p)) : prev
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error.');
    } finally {
      setChangingRoleUserId(null);
    }
  };

  const handleRevoke = async (userId: string) => {
    setRevokingUserId(userId);
    try {
      const res = await fetch(`/api/diagrams/${diagramId}/share?userId=${encodeURIComponent(userId)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setViewers((prev) => (prev ? prev.filter((v) => v.userId !== userId) : prev));
      }
    } finally {
      setRevokingUserId(null);
    }
  };

  const handleTogglePublic = async () => {
    const next = !isPublic;
    setTogglingPublic(true);
    setError(null);
    try {
      const res = await fetch(`/api/diagrams/${diagramId}/share`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublic: next }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Failed to update sharing settings.');
        return;
      }
      setIsPublic(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error.');
    } finally {
      setTogglingPublic(false);
    }
  };

  const diagramUrl = typeof window !== 'undefined' ? `${window.location.origin}/flow/${diagramId}` : '';

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(diagramUrl);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      // Clipboard API unavailable — user can still select the URL manually.
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-4" onClick={handleClose}>
      <div
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-slate-100 flex items-center justify-between shrink-0">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2 min-w-0">
            <Share2 className="w-4 h-4 text-blue-600 shrink-0" />
            <span className="truncate">Share &quot;{diagramTitle}&quot;</span>
          </h2>
          <button onClick={handleClose} className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer shrink-0">
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

          {/* Invite by email */}
          <div>
            <span className="font-semibold text-slate-800 block mb-1.5">Invite by email</span>
            <p className="text-slate-400 leading-relaxed mb-2">
              They&apos;ll get an email with a link.{' '}
              {inviteRole === 'EDITOR'
                ? 'As an editor they can add, move, and style nodes/edges — but can’t manage sharing or delete the diagram.'
                : 'As a viewer they get read-only access — they can’t edit this diagram, including through the AI/MCP integration.'}
            </p>
            <form onSubmit={handleInvite} className="flex items-center gap-2">
              <div className="relative flex-1">
                <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="person@example.com"
                  className="w-full pl-7 pr-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white"
                />
              </div>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as 'EDITOR' | 'VIEWER')}
                className="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500 shrink-0"
              >
                <option value="VIEWER">Viewer</option>
                <option value="EDITOR">Editor</option>
              </select>
              <button
                type="submit"
                disabled={inviting || !email.trim()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 cursor-pointer shrink-0"
              >
                {inviting && <Loader2 className="w-3 h-3 animate-spin" />}
                Invite
              </button>
            </form>
          </div>

          {/* Shared with */}
          <div className="pt-4 border-t border-slate-100">
            <span className="font-semibold text-slate-800 block mb-2">People with access</span>
            {viewers === null ? (
              <div className="flex items-center gap-2 text-slate-400 py-3">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Loading…
              </div>
            ) : viewers.length === 0 ? (
              <p className="text-slate-400 italic py-1">Not shared with anyone yet.</p>
            ) : (
              <ul className="space-y-1.5">
                {viewers.map((v) => (
                  <li
                    key={v.userId}
                    className="flex items-center gap-2.5 p-2.5 rounded-lg border border-slate-200 bg-white"
                  >
                    <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-[10px] font-bold shrink-0">
                      {v.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-slate-800 truncate">{v.name}</div>
                      <div className="text-[10px] text-slate-400 truncate">{v.email}</div>
                    </div>
                    <select
                      value={v.accesstype}
                      disabled={changingRoleUserId === v.userId}
                      onChange={(e) => handleChangeRole(v, e.target.value as 'EDITOR' | 'VIEWER')}
                      className={`px-1.5 py-1 rounded-lg text-[10px] font-semibold border shrink-0 cursor-pointer disabled:opacity-50 ${
                        v.accesstype === 'EDITOR'
                          ? 'bg-blue-50 text-blue-700 border-blue-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}
                      title="Change role"
                    >
                      <option value="VIEWER">Viewer</option>
                      <option value="EDITOR">Editor</option>
                    </select>
                    <button
                      onClick={() => handleRevoke(v.userId)}
                      disabled={revokingUserId === v.userId}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors shrink-0 cursor-pointer disabled:opacity-50"
                      title="Remove access"
                    >
                      {revokingUserId === v.userId ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <UserMinus className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Share with everyone */}
          <div className="pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                <Globe2 className="w-3.5 h-3.5 text-slate-500" />
                Share with everyone
              </span>
              <button
                onClick={handleTogglePublic}
                disabled={togglingPublic}
                className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer disabled:opacity-50 ${
                  isPublic ? 'bg-blue-600' : 'bg-slate-200'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                    isPublic ? 'translate-x-4' : ''
                  }`}
                />
              </button>
            </div>
            <p className="text-slate-400 leading-relaxed">
              {isPublic
                ? 'On — any signed-in FlowCraft user with the link can view this diagram as a read-only viewer.'
                : 'Off — only people you invite above can view this diagram.'}
            </p>

            {isPublic && (
              <div className="mt-2 flex items-center gap-2">
                <input
                  readOnly
                  value={diagramUrl}
                  className="flex-1 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-500 truncate"
                />
                <button
                  onClick={handleCopyLink}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer shrink-0"
                >
                  {linkCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  {linkCopied ? 'Copied' : 'Copy link'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
