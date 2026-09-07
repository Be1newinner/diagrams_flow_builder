'use client';

import React, { useState } from 'react';
import { Folder as FolderIcon, FolderPlus, Layers, MoreHorizontal, Pencil, Trash2, Check, X } from 'lucide-react';
import { Folder, FolderColor } from '@/types/folder';

interface FolderSidebarProps {
  folders: Folder[];
  selectedFolderId: string | null; // null = "All Flows"
  onSelectFolder: (id: string | null) => void;
  onCreateFolder: (name: string) => void;
  onRenameFolder: (id: string, name: string) => void;
  onDeleteFolder: (folder: Folder) => void;
  countsByFolder: Record<string, number>;
  unfiledCount: number;
  totalCount: number;
  canManageFolders: boolean;
}

const DOT_COLOR: Record<FolderColor, string> = {
  blue: 'bg-blue-500',
  emerald: 'bg-emerald-500',
  amber: 'bg-amber-500',
  purple: 'bg-purple-500',
  rose: 'bg-rose-500',
  slate: 'bg-slate-500',
  cyan: 'bg-cyan-500',
  indigo: 'bg-indigo-500',
};

const UNFILED_ID = '__unfiled__';

export function FolderSidebar({
  folders,
  selectedFolderId,
  onSelectFolder,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  countsByFolder,
  unfiledCount,
  totalCount,
  canManageFolders,
}: FolderSidebarProps) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  const submitCreate = () => {
    const trimmed = newName.trim();
    if (trimmed) onCreateFolder(trimmed);
    setNewName('');
    setCreating(false);
  };

  const submitRename = (id: string) => {
    const trimmed = editingName.trim();
    if (trimmed) onRenameFolder(id, trimmed);
    setEditingId(null);
  };

  return (
    <aside className="w-full lg:w-56 shrink-0 space-y-1">
      <div className="flex items-center justify-between px-1 mb-1">
        <h2 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
          Folders
        </h2>
        {canManageFolders && (
          <button
            onClick={() => setCreating(true)}
            className="p-1 text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-md transition-colors cursor-pointer"
            title="New folder"
          >
            <FolderPlus className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <button
        onClick={() => onSelectFolder(null)}
        className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
          selectedFolderId === null
            ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-semibold'
            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
        }`}
      >
        <span className="flex items-center gap-2 min-w-0">
          <Layers className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">All Flows</span>
        </span>
        <span className="text-[10px] text-slate-400 dark:text-slate-500">{totalCount}</span>
      </button>

      <button
        onClick={() => onSelectFolder(UNFILED_ID)}
        className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
          selectedFolderId === UNFILED_ID
            ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-semibold'
            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
        }`}
      >
        <span className="flex items-center gap-2 min-w-0">
          <FolderIcon className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">Unfiled</span>
        </span>
        <span className="text-[10px] text-slate-400 dark:text-slate-500">{unfiledCount}</span>
      </button>

      <div className="pt-1 space-y-0.5">
        {folders.map((folder) => (
          <div key={folder.id} className="group relative">
            {editingId === folder.id ? (
              <div className="flex items-center gap-1 px-2 py-1">
                <input
                  autoFocus
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') submitRename(folder.id);
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                  className="flex-1 min-w-0 text-xs px-2 py-1 rounded-md border border-blue-300 dark:border-blue-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none"
                />
                <button onClick={() => submitRename(folder.id)} className="p-1 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-md cursor-pointer">
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setEditingId(null)} className="p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md cursor-pointer">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => onSelectFolder(folder.id)}
                className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  selectedFolderId === folder.id
                    ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <span className="flex items-center gap-2 min-w-0">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${DOT_COLOR[folder.color || 'slate']}`} />
                  <span className="truncate">{folder.name}</span>
                </span>
                <span className="flex items-center gap-1 shrink-0">
                  <span className="text-[10px] text-slate-400 dark:text-slate-500">
                    {countsByFolder[folder.id] || 0}
                  </span>
                  {canManageFolders && (
                    <span
                      role="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpenId(menuOpenId === folder.id ? null : folder.id);
                      }}
                      className="p-0.5 opacity-0 group-hover:opacity-100 hover:text-slate-700 dark:hover:text-slate-200 rounded transition-opacity"
                    >
                      <MoreHorizontal className="w-3.5 h-3.5" />
                    </span>
                  )}
                </span>
              </button>
            )}

            {menuOpenId === folder.id && (
              <div
                className="absolute right-0 top-8 w-36 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg py-1 z-20 text-xs text-slate-700 dark:text-slate-200"
                onMouseLeave={() => setMenuOpenId(null)}
              >
                <button
                  onClick={() => {
                    setMenuOpenId(null);
                    setEditingId(folder.id);
                    setEditingName(folder.name);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2 cursor-pointer"
                >
                  <Pencil className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                  <span>Rename</span>
                </button>
                <button
                  onClick={() => {
                    setMenuOpenId(null);
                    onDeleteFolder(folder);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 flex items-center gap-2 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {creating && (
        <div className="flex items-center gap-1 px-1 pt-1">
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitCreate();
              if (e.key === 'Escape') {
                setCreating(false);
                setNewName('');
              }
            }}
            placeholder="Folder name"
            className="flex-1 min-w-0 text-xs px-2 py-1 rounded-md border border-blue-300 dark:border-blue-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none"
          />
          <button onClick={submitCreate} className="p-1 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-md cursor-pointer">
            <Check className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => {
              setCreating(false);
              setNewName('');
            }}
            className="p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {!canManageFolders && (
        <p className="text-[10px] text-slate-400 dark:text-slate-500 px-1 pt-2 leading-relaxed">
          Sign in to create folders and organize your flows.
        </p>
      )}
    </aside>
  );
}

export { UNFILED_ID };
