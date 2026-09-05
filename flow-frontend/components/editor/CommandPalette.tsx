'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search, FileText, ArrowRight } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { getDiagrams } from '@/lib/storage';
import { Diagram } from '@/types/diagram';

export interface CommandPaletteAction {
  id: string;
  label: string;
  hint?: string;
  icon?: React.ReactNode;
  onRun: () => void;
}

interface PaletteItem {
  id: string;
  label: string;
  hint?: string;
  icon?: React.ReactNode;
  onRun: () => void;
}

interface CommandPaletteProps {
  actions?: CommandPaletteAction[];
}

// Global Cmd/Ctrl+K palette: jump to any of your diagrams by name, or run a
// context-specific action (passed in via `actions` — the flow editor wires
// up its own toolbar actions; the dashboard mounts this with none, just
// navigation). Self-contained: manages its own open state and keybinding,
// so it just needs to be mounted once per page.
export function CommandPalette({ actions = [] }: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  // Bumped every time the palette opens and used as PaletteBody's key, so
  // it remounts fresh (query/selection reset for free) instead of an effect
  // reaching back to reset state in response to `open` changing.
  const [openKey, setOpenKey] = useState(0);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((wasOpen) => {
          if (!wasOpen) setOpenKey((k) => k + 1);
          return !wasOpen;
        });
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  if (!open) return null;

  return <PaletteBody key={openKey} actions={actions} onClose={() => setOpen(false)} />;
}

function PaletteBody({ actions, onClose }: { actions: CommandPaletteAction[]; onClose: () => void }) {
  const router = useRouter();
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [diagrams, setDiagrams] = useState<Diagram[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);

  // Fetching data on mount based on the current user is a legitimate effect
  // (syncing with an external system) — nothing here resets local state in
  // response to a prop change, which is what the outer remount-via-key
  // avoids needing.
  useEffect(() => {
    if (user?.id) {
      getDiagrams(user.id).then(setDiagrams);
    }
  }, [user?.id]);

  const diagramItems: PaletteItem[] = useMemo(
    () =>
      diagrams
        .filter((d) => !d.isTemplate && d.title.toLowerCase().includes(query.toLowerCase()))
        .slice(0, 6)
        .map((d) => ({
          id: `diagram-${d.id}`,
          label: d.title,
          hint: d.category,
          icon: <FileText className="w-4 h-4 text-slate-400" />,
          onRun: () => router.push(`/flow/${d.id}`),
        })),
    [diagrams, query, router]
  );

  const actionItems: PaletteItem[] = useMemo(
    () => actions.filter((a) => a.label.toLowerCase().includes(query.toLowerCase())),
    [actions, query]
  );

  const items: PaletteItem[] = [...actionItems, ...diagramItems];
  // Deriving during render instead of an effect: if the filtered list
  // shrinks below the current index, just clamp what we read this render
  // rather than writing activeIndex back in response to `query` changing.
  const clampedIndex = Math.min(activeIndex, Math.max(items.length - 1, 0));

  const runItem = useCallback(
    (item: PaletteItem) => {
      item.onRun();
      onClose();
    },
    [onClose]
  );

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] bg-slate-900/40"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg mx-4 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActiveIndex((i) => Math.min(i + 1, items.length - 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActiveIndex((i) => Math.max(i - 1, 0));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                if (items[clampedIndex]) runItem(items[clampedIndex]);
              }
            }}
            placeholder="Search diagrams or actions…"
            className="flex-1 text-sm outline-none placeholder-slate-400 text-slate-800"
          />
          <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-400 font-mono shrink-0">
            Esc
          </kbd>
        </div>
        <div className="max-h-80 overflow-y-auto py-1.5">
          {items.length === 0 ? (
            <div className="px-4 py-6 text-center text-xs text-slate-400">No matches</div>
          ) : (
            items.map((item, idx) => (
              <button
                key={item.id}
                onClick={() => runItem(item)}
                onMouseEnter={() => setActiveIndex(idx)}
                className={`w-full flex items-center gap-2.5 px-4 py-2 text-left text-sm transition-colors cursor-pointer ${
                  idx === clampedIndex ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                {item.icon}
                <span className="flex-1 truncate">{item.label}</span>
                {item.hint && <span className="text-[10px] text-slate-400 shrink-0">{item.hint}</span>}
                {idx === clampedIndex && <ArrowRight className="w-3.5 h-3.5 text-blue-400 shrink-0" />}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
