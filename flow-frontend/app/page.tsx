'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Sparkles,
  Plus,
  Layers,
  Network,
  GitFork,
  Database,
  Search,
  FilterX,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Diagram, DiagramCategory } from '@/types/diagram';
import { Folder } from '@/types/folder';
import {
  getDiagrams,
  createDiagram,
  duplicateDiagram,
  deleteDiagram,
  exportDiagramJSON,
  importDiagramJSON,
  getFolders,
  createFolder,
  renameFolder,
  deleteFolder,
  moveDiagramToFolder,
} from '@/lib/storage';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { DiagramCard } from '@/components/dashboard/DiagramCard';
import { CreateFlowModal } from '@/components/dashboard/CreateFlowModal';
import { DeleteConfirmModal } from '@/components/dashboard/DeleteConfirmModal';
import { FolderSidebar, UNFILED_ID } from '@/components/dashboard/FolderSidebar';
import { CommandPalette } from '@/components/editor/CommandPalette';

export default function DashboardPage() {
  const router = useRouter();
  const { user, isLoading: isAuthLoading, openLoginModal } = useAuth();
  const [diagrams, setDiagrams] = useState<Diagram[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  // True only for a re-fetch after the first successful load (folder
  // create/rename/delete, move-to-folder, duplicate, import, delete all
  // call loadData() again) — the first load uses the full skeleton below
  // instead, and a re-fetch keeps showing the current list rather than
  // clearing it, so this only drives a small non-blocking indicator.
  const [isRefreshing, setIsRefreshing] = useState(false);
  const hasLoadedRef = useRef(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [diagramToDelete, setDiagramToDelete] = useState<Diagram | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  const loadData = useCallback(async () => {
    if (hasLoadedRef.current) setIsRefreshing(true);
    const [list, folderList] = await Promise.all([getDiagrams(user?.id), getFolders(user?.id)]);
    setDiagrams(list);
    setFolders(folderList);
    setIsLoaded(true);
    setIsRefreshing(false);
    hasLoadedRef.current = true;
  }, [user?.id]);

  useEffect(() => {
    // Wait for the auth cookie check to resolve before the first fetch —
    // otherwise `user` is briefly undefined on a hard reload of an already
    // signed-in session, loadData() fires once against the anonymous
    // (templates-only) path, and immediately re-fires once auth resolves —
    // a pointless double fetch that flashed the wrong (template) list first.
    if (isAuthLoading) return;
    loadData();
  }, [loadData, isAuthLoading]);

  // Category counts
  const counts = useMemo(() => {
    return {
      total: diagrams.length,
      systemDesign: diagrams.filter((d) => d.category === 'system-design').length,
      flowchart: diagrams.filter((d) => d.category === 'flowchart').length,
      erDiagram: diagrams.filter((d) => d.category === 'er-diagram').length,
    };
  }, [diagrams]);

  // Folder counts (only ever meaningful for the user's own diagrams, since
  // folders themselves are per-user — no need to exclude templates here as
  // templates never carry a folderId).
  const countsByFolder = useMemo(() => {
    const map: Record<string, number> = {};
    diagrams.forEach((d) => {
      if (d.folderId) map[d.folderId] = (map[d.folderId] || 0) + 1;
    });
    return map;
  }, [diagrams]);

  const unfiledCount = useMemo(
    () => diagrams.filter((d) => !d.folderId).length,
    [diagrams]
  );

  // Filtered diagrams
  const filteredDiagrams = useMemo(() => {
    return diagrams.filter((diagram) => {
      const matchesCategory =
        selectedCategory === 'all' || diagram.category === selectedCategory;
      const matchesSearch =
        searchQuery.trim() === '' ||
        diagram.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        diagram.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        diagram.tags?.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesFolder =
        selectedFolderId === null ||
        (selectedFolderId === UNFILED_ID ? !diagram.folderId : diagram.folderId === selectedFolderId);

      return matchesCategory && matchesSearch && matchesFolder;
    });
  }, [diagrams, selectedCategory, searchQuery, selectedFolderId]);

  // Count user-owned diagrams (excluding sample templates)
  const userOwnedCount = useMemo(() => {
    if (!user) return 0;
    return diagrams.filter((d) => !d.isTemplate && !d.id.startsWith('template-')).length;
  }, [diagrams, user]);

  const MAX_LIMIT = 30;

  // Handlers
  const handleOpenCreateModal = () => {
    if (!user) {
      openLoginModal();
      return;
    }
    if (userOwnedCount >= MAX_LIMIT) {
      showToast(`Diagram limit reached (${MAX_LIMIT}/${MAX_LIMIT}). Please delete older diagrams to create new ones.`);
      return;
    }
    setCreateModalOpen(true);
  };

  const handleCreateFlow = async (params: {
    title: string;
    description: string;
    category: DiagramCategory;
    tags: string[];
    templateId?: string;
    gridType?: 'dots' | 'lines' | 'cross' | 'none';
    defaultEdgeType?: 'smoothstep' | 'bezier' | 'straight';
    nodes?: any;
    edges?: any;
  }) => {
    if (userOwnedCount >= MAX_LIMIT) {
      showToast(`Diagram limit reached (${MAX_LIMIT}/${MAX_LIMIT}).`);
      return;
    }
    const newDiagram = await createDiagram(params, user?.id);
    setCreateModalOpen(false);
    if (!newDiagram) {
      showToast('Failed to create diagram');
      return;
    }
    showToast(`Created "${newDiagram.title}"`);
    router.push(`/flow/${newDiagram.id}`);
  };

  const handleDuplicate = async (id: string) => {
    if (!user) {
      openLoginModal();
      return;
    }
    if (userOwnedCount >= MAX_LIMIT) {
      showToast(`Diagram limit reached (${MAX_LIMIT}/${MAX_LIMIT}). Cannot duplicate.`);
      return;
    }
    const cloned = await duplicateDiagram(id, user?.id);
    if (cloned) {
      await loadData();
      showToast(`Duplicated to "${cloned.title}"`);
    } else {
      showToast('Failed to duplicate diagram');
    }
  };

  const handleExportJSON = async (id: string) => {
    try {
      const json = await exportDiagramJSON(id);
      const diagram = diagrams.find((d) => d.id === id);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(diagram?.title || 'diagram').toLowerCase().replace(/\s+/g, '_')}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Diagram exported to JSON file');
    } catch {
      showToast('Failed to export diagram');
    }
  };

  const handleImportJSON = (file: File) => {
    if (!user) {
      openLoginModal();
      return;
    }
    if (userOwnedCount >= MAX_LIMIT) {
      showToast(`Diagram limit reached (${MAX_LIMIT}/${MAX_LIMIT}). Cannot import.`);
      return;
    }
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const imported = await importDiagramJSON(text, user?.id);
        await loadData();
        showToast(`Imported "${imported.title}"`);
        router.push(`/flow/${imported.id}`);
      } catch {
        alert('Invalid diagram JSON file. Please verify the format.');
      }
    };
    reader.readAsText(file);
  };

  const handleDeleteConfirm = async () => {
    if (diagramToDelete) {
      const ok = await deleteDiagram(diagramToDelete.id);
      setDiagramToDelete(null);
      if (ok) {
        await loadData();
        showToast('Diagram deleted');
      } else {
        showToast('Failed to delete diagram');
      }
    }
  };

  const handleCreateFolder = async (name: string) => {
    if (!user) {
      openLoginModal();
      return;
    }
    const folder = await createFolder(name);
    if (folder) {
      await loadData();
      showToast(`Created folder "${folder.name}"`);
    } else {
      showToast('Failed to create folder');
    }
  };

  const handleRenameFolder = async (id: string, name: string) => {
    const folder = await renameFolder(id, name);
    if (folder) {
      await loadData();
      showToast(`Renamed folder to "${folder.name}"`);
    } else {
      showToast('Failed to rename folder');
    }
  };

  const handleDeleteFolder = async (folder: Folder) => {
    const diagramCount = countsByFolder[folder.id] || 0;
    const confirmed = window.confirm(
      diagramCount > 0
        ? `Delete folder "${folder.name}"? Its ${diagramCount} diagram${diagramCount === 1 ? '' : 's'} will become unfiled, not deleted.`
        : `Delete folder "${folder.name}"?`
    );
    if (!confirmed) return;

    const ok = await deleteFolder(folder.id);
    if (ok) {
      if (selectedFolderId === folder.id) setSelectedFolderId(null);
      await loadData();
      showToast(`Deleted folder "${folder.name}"`);
    } else {
      showToast('Failed to delete folder');
    }
  };

  const handleMoveToFolder = async (diagramId: string, folderId: string | null) => {
    const diagram = diagrams.find((d) => d.id === diagramId);
    if (!diagram) return;
    const result = await moveDiagramToFolder(diagramId, folderId, diagram.updatedAt);
    if (result.status === 'ok' || result.status === 'created') {
      await loadData();
      showToast(folderId ? 'Moved to folder' : 'Removed from folder');
    } else {
      showToast('Failed to move diagram');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-xl text-xs font-medium flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header with Search and Navigation */}
      <DashboardHeader
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedCategory={selectedCategory}
        onCategoryChange={setSelectedCategory}
        onOpenCreateModal={handleOpenCreateModal}
        onImportJSON={handleImportJSON}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        counts={counts}
        userDiagramCount={userOwnedCount}
        maxDiagramLimit={MAX_LIMIT}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Banner with stats & inspiration — richer copy for a brand-new
            user (0 diagrams of their own yet, so all they see below are the
            3 built-in starter templates) than for a returning one. */}
        <div className="mb-8 p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-800">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Interactive Architecture Studio</span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50 tracking-tight">
              {userOwnedCount === 0
                ? 'Welcome to FlowCraft — let’s build your first diagram'
                : 'Design Systems, Workflows & Database Relational Schemas'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-2xl leading-relaxed">
              {userOwnedCount === 0 ? (
                <>
                  Drag and drop cloud components, flowchart nodes, sticky notes, and SQL entity tables
                  onto a canvas — or start from one of the 3 sample templates below and duplicate it to
                  make it yours. Press{' '}
                  <kbd className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-[10px]">
                    Ctrl/⌘+K
                  </kbd>{' '}
                  any time to jump between diagrams.
                </>
              ) : (
                'Drag and drop cloud components, flowchart nodes, and SQL entity tables. Click any diagram below to start editing or create a new flow.'
              )}
            </p>
          </div>

          <button
            onClick={handleOpenCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-sm shadow-blue-500/20 active:scale-95 shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{userOwnedCount === 0 ? 'Create Your First Flow' : 'Create New Flow'}</span>
          </button>
        </div>

        {/* Sidebar + Diagram Cards */}
        {!isLoaded ? (
          // First load only: diagrams starts as [] before loadData()
          // resolves, which used to fall straight through to the "No
          // diagrams found" empty state below for a beat (or longer on a
          // slow connection) before flipping to the real list — a skeleton
          // instead of that false-empty flash.
          <div className="flex flex-col lg:flex-row gap-6" aria-busy="true" aria-label="Loading diagrams">
            <div className="w-full lg:w-56 shrink-0 space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-7 rounded-lg bg-slate-100 dark:bg-slate-800 animate-pulse" />
              ))}
            </div>
            <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-48 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 animate-pulse"
                />
              ))}
            </div>
          </div>
        ) : (
        <div className="flex flex-col lg:flex-row gap-6">
          <FolderSidebar
            folders={folders}
            selectedFolderId={selectedFolderId}
            onSelectFolder={setSelectedFolderId}
            onCreateFolder={handleCreateFolder}
            onRenameFolder={handleRenameFolder}
            onDeleteFolder={handleDeleteFolder}
            countsByFolder={countsByFolder}
            unfiledCount={unfiledCount}
            totalCount={diagrams.length}
            canManageFolders={!!user}
            onDropDiagram={handleMoveToFolder}
          />

          <div className="flex-1 min-w-0">
            {isRefreshing && (
              <div className="mb-3 flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500">
                <span className="w-3 h-3 border-2 border-slate-300 dark:border-slate-600 border-t-blue-500 rounded-full animate-spin" />
                <span>Refreshing…</span>
              </div>
            )}
            {filteredDiagrams.length > 0 ? (
              <div
                className={
                  viewMode === 'grid'
                    ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
                    : 'space-y-3'
                }
              >
                {filteredDiagrams.map((diagram) => (
                  <DiagramCard
                    key={diagram.id}
                    diagram={diagram}
                    viewMode={viewMode}
                    onDuplicate={handleDuplicate}
                    onExport={handleExportJSON}
                    onDelete={setDiagramToDelete}
                    currentUserId={user?.id}
                    folders={folders}
                    onMoveToFolder={handleMoveToFolder}
                  />
                ))}
              </div>
            ) : (
              /* Empty State */
              <div className="text-center py-16 bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-8">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 flex items-center justify-center mx-auto mb-3">
                  <Search className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">No diagrams found</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                  {searchQuery
                    ? `No diagrams matched "${searchQuery}". Try a different keyword or clear your filter.`
                    : selectedFolderId
                    ? 'No diagrams in this folder yet. Move one here from its card menu.'
                    : 'Get started by creating your very first diagram flow.'}
                </p>
                <div className="mt-5 flex items-center justify-center gap-2.5">
                  {(searchQuery || selectedFolderId) && (
                    <button
                      onClick={() => {
                        setSearchQuery('');
                        setSelectedCategory('all');
                        setSelectedFolderId(null);
                      }}
                      className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors"
                    >
                      Clear Filters
                    </button>
                  )}
                  <button
                    onClick={() => setCreateModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create New Diagram</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        )}
      </main>

      {/* Dashboard Footer */}
      <footer className="mt-auto border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-6 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700 dark:text-slate-300">FlowCraft</span>
            <span className="text-slate-300 dark:text-slate-600">•</span>
            <span>Visual Diagram & System Design Studio</span>
          </div>

          <p className="flex items-center gap-1.5">
            <span>a product built with love by</span>
            <Link
              href="https://www.shipsar.in"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-blue-600 hover:text-blue-700 hover:underline transition-colors"
            >
              Shipsar Developers
            </Link>
          </p>
        </div>
      </footer>

      {/* Creation Modal */}
      <CreateFlowModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreate={handleCreateFlow}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={!!diagramToDelete}
        diagram={diagramToDelete}
        onClose={() => setDiagramToDelete(null)}
        onConfirm={handleDeleteConfirm}
      />

      <CommandPalette />
    </div>
  );
}
