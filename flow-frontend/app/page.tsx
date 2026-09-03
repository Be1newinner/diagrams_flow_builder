'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
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
import { Diagram, DiagramCategory } from '@/types/diagram';
import {
  getDiagrams,
  createDiagram,
  duplicateDiagram,
  deleteDiagram,
  exportDiagramJSON,
  importDiagramJSON,
} from '@/lib/storage';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { DiagramCard } from '@/components/dashboard/DiagramCard';
import { CreateFlowModal } from '@/components/dashboard/CreateFlowModal';
import { DeleteConfirmModal } from '@/components/dashboard/DeleteConfirmModal';

export default function DashboardPage() {
  const router = useRouter();
  const [diagrams, setDiagrams] = useState<Diagram[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
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

  const loadData = () => {
    const list = getDiagrams();
    setDiagrams(list);
    setIsLoaded(true);
  };

  useEffect(() => {
    loadData();

    const handleStorageUpdate = () => {
      loadData();
    };

    window.addEventListener('flowcraft:storage-update', handleStorageUpdate);
    return () => {
      window.removeEventListener('flowcraft:storage-update', handleStorageUpdate);
    };
  }, []);

  // Category counts
  const counts = useMemo(() => {
    return {
      total: diagrams.length,
      systemDesign: diagrams.filter((d) => d.category === 'system-design').length,
      flowchart: diagrams.filter((d) => d.category === 'flowchart').length,
      erDiagram: diagrams.filter((d) => d.category === 'er-diagram').length,
    };
  }, [diagrams]);

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

      return matchesCategory && matchesSearch;
    });
  }, [diagrams, selectedCategory, searchQuery]);

  // Handlers
  const handleCreateFlow = (params: {
    title: string;
    description: string;
    category: DiagramCategory;
    tags: string[];
    templateId?: string;
    gridType?: 'dots' | 'lines' | 'cross' | 'none';
    defaultEdgeType?: 'smoothstep' | 'bezier' | 'straight';
  }) => {
    const newDiagram = createDiagram(params);
    setCreateModalOpen(false);
    showToast(`Created "${newDiagram.title}"`);
    router.push(`/flow/${newDiagram.id}`);
  };

  const handleDuplicate = (id: string) => {
    const cloned = duplicateDiagram(id);
    if (cloned) {
      loadData();
      showToast(`Duplicated to "${cloned.title}"`);
    }
  };

  const handleExportJSON = (id: string) => {
    try {
      const json = exportDiagramJSON(id);
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
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const imported = importDiagramJSON(text);
        loadData();
        showToast(`Imported "${imported.title}"`);
        router.push(`/flow/${imported.id}`);
      } catch {
        alert('Invalid diagram JSON file. Please verify the format.');
      }
    };
    reader.readAsText(file);
  };

  const handleDeleteConfirm = () => {
    if (diagramToDelete) {
      deleteDiagram(diagramToDelete.id);
      setDiagramToDelete(null);
      loadData();
      showToast('Diagram deleted');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
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
        onOpenCreateModal={() => setCreateModalOpen(true)}
        onImportJSON={handleImportJSON}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        counts={counts}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Banner with stats & inspiration */}
        <div className="mb-8 p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-100">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Interactive Architecture Studio</span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              Design Systems, Workflows & Database Relational Schemas
            </h2>
            <p className="text-xs text-slate-500 max-w-2xl leading-relaxed">
              Drag and drop cloud components, flowchart nodes, and SQL entity tables. Click any diagram below to start editing or create a new flow.
            </p>
          </div>

          <button
            onClick={() => setCreateModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-sm shadow-blue-500/20 active:scale-95 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Flow</span>
          </button>
        </div>

        {/* Diagram Cards Grid / List */}
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
              />
            ))}
          </div>
        ) : (
          /* Empty State */
          <div className="text-center py-16 bg-white border border-dashed border-slate-300 rounded-2xl p-8">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <Search className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">No diagrams found</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {searchQuery
                ? `No diagrams matched "${searchQuery}". Try a different keyword or clear your filter.`
                : 'Get started by creating your very first diagram flow.'}
            </p>
            <div className="mt-5 flex items-center justify-center gap-2.5">
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCategory('all');
                  }}
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors"
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
      </main>

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
    </div>
  );
}
