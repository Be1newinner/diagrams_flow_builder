'use client';

import React, { useRef, useState } from 'react';
import Link from 'next/link';
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
  LogIn,
  LogOut,
  User as UserIcon,
  Terminal,
  ShieldCheck,
  Sun,
  Moon,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { DiagramCategory } from '@/types/diagram';
import { FlowCraftLogo } from '@/components/brand/FlowCraftLogo';
import { SecuritySettingsModal } from '@/components/auth/SecuritySettingsModal';

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
  userDiagramCount?: number;
  maxDiagramLimit?: number;
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
  userDiagramCount = 0,
  maxDiagramLimit = 30,
}: DashboardHeaderProps) {
  const { user, logout, openLoginModal, openRegisterModal } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [securityModalOpen, setSecurityModalOpen] = useState(false);

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

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  return (
    <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 sticky top-0 z-30 shadow-xs">
      {/* Top Navbar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <FlowCraftLogo size="md" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50 tracking-tight">FlowCraft</h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  {theme === 'dark' ? 'Dark Studio' : 'Light Studio'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Visual diagramming for System Design, Flowcharts & ER Schemas
              </p>
            </div>
          </div>

          {/* Action Buttons & Auth */}
          <div className="flex items-center gap-2.5">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelected}
              accept=".json"
              className="hidden"
            />
            <button
              onClick={toggleTheme}
              className="p-2 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-xs cursor-pointer"
              title="Import diagram from JSON file"
            >
              <UploadCloud className="w-4 h-4 text-slate-500 dark:text-slate-400" />
              <span>Import</span>
            </button>

            <Link
              href="/mcp-config"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg transition-colors shadow-xs cursor-pointer"
              title="MCP Server Configuration & AI Connection"
            >
              <Terminal className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>MCP Config</span>
            </Link>

            {/* Diagram Limit Indicator: '20/30 diagrams' */}
            <div
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border shadow-xs transition-colors ${
                userDiagramCount >= maxDiagramLimit
                  ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                  : userDiagramCount >= 25
                  ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                  : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
              }`}
              title={
                userDiagramCount >= maxDiagramLimit
                  ? `Storage limit reached (${userDiagramCount}/${maxDiagramLimit}). Delete older diagrams to create new ones.`
                  : `${maxDiagramLimit - userDiagramCount} diagram slots remaining`
              }
            >
              <div
                className={`w-2 h-2 rounded-full ${
                  userDiagramCount >= maxDiagramLimit
                    ? 'bg-rose-500'
                    : userDiagramCount >= 25
                    ? 'bg-amber-500'
                    : 'bg-emerald-500'
                }`}
              />
              <span>{userDiagramCount}/{maxDiagramLimit} diagrams</span>
            </div>

            <button
              onClick={onOpenCreateModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-lg transition-colors shadow-xs shadow-blue-500/20 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>New Flow</span>
            </button>

            {/* Divider */}
            <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-1 hidden sm:block" />

            {/* Authentication State */}
            {user ? (
              <div className="flex items-center gap-2 pl-1">
                <div className="flex items-center gap-2 px-2.5 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg">
                  <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold">
                    {getInitials(user.name)}
                  </div>
                  <div className="flex flex-col text-left">
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-100 leading-tight max-w-[110px] truncate">
                      {user.name}
                    </span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 leading-tight max-w-[110px] truncate">
                      {user.email}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => setSecurityModalOpen(true)}
                  className="p-2 text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg transition-colors cursor-pointer"
                  title="Security settings"
                >
                  <ShieldCheck className="w-4 h-4" />
                </button>

                <button
                  onClick={logout}
                  className="p-2 text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                  title="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 pl-1">
                <button
                  onClick={openLoginModal}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-950/30 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors cursor-pointer"
                >
                  <LogIn className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                  <span>Sign In</span>
                </button>
                <button
                  onClick={openRegisterModal}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100/70 dark:hover:bg-blue-900/50 border border-blue-200 dark:border-blue-800 rounded-lg transition-colors cursor-pointer"
                >
                  <span>Register</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Sub-bar: Search, Filter Tabs, and View Toggle */}
        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
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
                      ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 font-semibold shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 border border-transparent'
                  }`}
                >
                  {cat.icon}
                  <span>{cat.label}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                      active
                        ? 'bg-blue-200/60 dark:bg-blue-800/50 text-blue-800 dark:text-blue-200'
                        : 'bg-slate-200/70 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
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
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search diagrams or tags..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500"
              />
            </div>

            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
              <button
                onClick={() => onViewModeChange('grid')}
                className={`p-1.5 rounded-md transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-2xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
                title="Grid View"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onViewModeChange('list')}
                className={`p-1.5 rounded-md transition-colors ${
                  viewMode === 'list'
                    ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-2xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
                title="List View"
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <SecuritySettingsModal isOpen={securityModalOpen} onClose={() => setSecurityModalOpen(false)} />
    </header>
  );
}
