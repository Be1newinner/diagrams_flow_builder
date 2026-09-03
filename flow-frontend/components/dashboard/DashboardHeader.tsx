'use client';

import React, { useRef } from 'react';
import {
  Plus,
  Search,
  UploadCloud,
  Network,
  GitFork,
  Database,
  Layers,
  Sparkles,
  LayoutGrid,
  List,
} from 'lucide-react';
import { DiagramCategory } from '@/types/diagram';

interface DashboardHeaderProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedCategory: string;
  onCategoryChange: (cat: string) => void;
  onOpenCreateModal: () => void;
  onImportJSON: (file: File) => void;
  viewMode: 'grid' | 'list';
  onViewModeChange: (mode: 'grid' | 'list') => void;
  counts: {
    total: number;
    systemDesign: number;
    flowchart: number;
    erDiagram: number;
  };
}

export function DashboardHeader({
  searchQuery,
  onSearchChange,
  selectedCategory,
  onCategoryChange,
  onOpenCreateModal,
  onImportJSON,
  viewMode,
  onViewModeChange,
  counts,
}: DashboardHeaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const categories: { id: string; label: string; icon: React.ReactNode; count: number }[] = [
    { id: 'all', label: 'All Diagrams', icon: <Layers className="w-3.5 h-3.5" />, count: counts.total },
    { id: 'system-design', label: 'System Design', icon: <Network className="w-3.5 h-3.5" />, count: counts.systemDesign },
    { id: 'flowchart', label: 'Flowcharts', icon: <GitFork className="w-3.5 h-3.5" />, count: counts.flowchart },
    { id: 'er-diagram', label: 'ER Diagrams', icon: <Database className="w-3.5 h-3.5" />, count: counts.erDiagram },
  ];

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImportJSON(file);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <header className="border-b border-slate-200 bg-white sticky top-0 z-30 shadow-xs">
      {/* Top Navbar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-sm ring-4 ring-blue-50">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">FlowCraft</h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                  Light Studio
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Visual diagramming for System Design, Flowcharts & ER Schemas
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelected}
              accept=".json"
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-xs"
              title="Import diagram from JSON file"
            >
              <UploadCloud className="w-4 h-4 text-slate-500" />
              <span>Import JSON</span>
            </button>

            <button
              onClick={onOpenCreateModal}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-lg transition-colors shadow-xs shadow-blue-500/20"
            >
              <Plus className="w-4 h-4" />
              <span>New Flow</span>
            </button>
          </div>
        </div>

        {/* Sub-bar: Search, Filter Tabs, and View Toggle */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Category Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
            {categories.map((cat) => {
              const active = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => onCategoryChange(cat.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                    active
                      ? 'bg-blue-50 text-blue-700 border border-blue-200 font-semibold shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-transparent'
                  }`}
                >
                  {cat.icon}
                  <span>{cat.label}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                      active ? 'bg-blue-200/60 text-blue-800' : 'bg-slate-200/70 text-slate-600'
                    }`}
                  >
                    {cat.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search Bar & View Mode */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 md:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search diagrams or tags..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-slate-800 placeholder-slate-400"
              />
            </div>

            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
              <button
                onClick={() => onViewModeChange('grid')}
                className={`p-1.5 rounded-md transition-colors ${
                  viewMode === 'grid' ? 'bg-white text-blue-600 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Grid View"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onViewModeChange('list')}
                className={`p-1.5 rounded-md transition-colors ${
                  viewMode === 'list' ? 'bg-white text-blue-600 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                }`}
                title="List View"
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
