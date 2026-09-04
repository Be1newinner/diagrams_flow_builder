'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Save,
  Check,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Download,
  UploadCloud,
  Sparkles,
  Grid,
  Settings2,
  FileImage,
  FileCode,
  FileJson,
  Layers,
  Network,
  GitFork,
  Database,
  ExternalLink,
  LogIn,
  LogOut,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Diagram, DiagramCategory } from '@/types/diagram';
import { FlowCraftLogo } from '@/components/brand/FlowCraftLogo';

interface EditorHeaderProps {
  diagram: Diagram;
  onUpdateTitle: (title: string) => void;
  onUpdateCategory: (category: DiagramCategory) => void;
  isSaving: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitView: () => void;
  onAutoLayout: () => void;
  gridType: 'dots' | 'lines' | 'cross' | 'none';
  onChangeGridType: (type: 'dots' | 'lines' | 'cross' | 'none') => void;
  defaultEdgeType: 'smoothstep' | 'bezier' | 'straight';
  onChangeDefaultEdgeType: (type: 'smoothstep' | 'bezier' | 'straight') => void;
  onExportPNG: () => void;
  onExportSVG: () => void;
  onExportJSON: () => void;
  onImportJSON: (file: File) => void;
  onOpenAiModal?: () => void;
  userAccessType?: 'ADMIN' | 'VIEWER' | 'TEMPLATE' | 'GUEST';
}

export function EditorHeader({
  diagram,
  onUpdateTitle,
  onUpdateCategory,
  isSaving,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onZoomIn,
  onZoomOut,
  onFitView,
  onAutoLayout,
  gridType,
  onChangeGridType,
  defaultEdgeType,
  onChangeDefaultEdgeType,
  onExportPNG,
  onExportSVG,
  onExportJSON,
  onImportJSON,
  onOpenAiModal,
  userAccessType,
}: EditorHeaderProps) {
  const { user, openLoginModal, logout } = useAuth();
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(diagram.title);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [canvasSettingsOpen, setCanvasSettingsOpen] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleTitleBlur = () => {
    setIsEditingTitle(false);
    if (titleValue.trim() && titleValue !== diagram.title) {
      onUpdateTitle(titleValue.trim());
    } else {
      setTitleValue(diagram.title);
    }
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleTitleBlur();
    } else if (e.key === 'Escape') {
      setTitleValue(diagram.title);
      setIsEditingTitle(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImportJSON(file);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <header className="h-14 bg-white border-b border-slate-200 px-4 flex items-center justify-between z-30 shadow-2xs relative">
      {/* Left: Back button & Title */}
      <div className="flex items-center gap-3 min-w-0">
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
          title="Back to Dashboard"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <FlowCraftLogo size="xs" showGlow={false} />
          <span className="hidden sm:inline font-semibold text-slate-800">FlowCraft</span>
        </Link>

        <div className="h-4 w-px bg-slate-200 hidden sm:block" />

        {/* Inline editable diagram title */}
        <div className="flex items-center gap-2 min-w-0">
          {isEditingTitle ? (
            <input
              type="text"
              value={titleValue}
              onChange={(e) => setTitleValue(e.target.value)}
              onBlur={handleTitleBlur}
              onKeyDown={handleTitleKeyDown}
              className="text-sm font-bold text-slate-900 border border-blue-400 rounded px-2 py-0.5 outline-none focus:ring-2 focus:ring-blue-400/30"
              autoFocus
            />
          ) : (
            <button
              onClick={() => {
                if (userAccessType !== 'VIEWER') setIsEditingTitle(true);
              }}
              className={`text-sm font-bold text-slate-800 px-2 py-0.5 rounded transition-colors truncate max-w-[200px] md:max-w-xs text-left ${
                userAccessType === 'VIEWER' ? 'cursor-default' : 'hover:text-blue-600 hover:bg-slate-50 cursor-pointer'
              }`}
              title={userAccessType === 'VIEWER' ? diagram.title : 'Click to rename'}
            >
              {diagram.title}
            </button>
          )}

          {/* Auto-save indicator */}
          <div className="hidden sm:flex items-center gap-1 text-[11px] text-slate-400 font-medium">
            {isSaving ? (
              <>
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-slate-500">Saved</span>
              </>
            )}
          </div>

          {/* User Access Badge */}
          {userAccessType === 'ADMIN' && (
            <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
              Admin
            </span>
          )}
          {userAccessType === 'VIEWER' && (
            <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200/60">
              Viewer
            </span>
          )}
        </div>
      </div>

      {/* Center: Undo/Redo & Zoom & Auto-Layout Toolbar */}
      <div className="hidden lg:flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200">
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white disabled:opacity-40 disabled:hover:bg-transparent transition-all"
          title="Undo (Ctrl+Z)"
        >
          <Undo2 className="w-4 h-4" />
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white disabled:opacity-40 disabled:hover:bg-transparent transition-all"
          title="Redo (Ctrl+Y)"
        >
          <Redo2 className="w-4 h-4" />
        </button>

        <div className="h-4 w-px bg-slate-200 mx-0.5" />

        <button
          onClick={onZoomOut}
          className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white transition-all"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={onZoomIn}
          className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white transition-all"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={onFitView}
          className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white transition-all"
          title="Fit to Screen"
        >
          <Maximize2 className="w-4 h-4" />
        </button>

        {userAccessType !== 'VIEWER' && (
          <>
            <div className="h-4 w-px bg-slate-200 mx-0.5" />

            <button
              onClick={onAutoLayout}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              title="Auto-arrange nodes hierarchically"
            >
              <Sparkles className="w-3.5 h-3.5 text-slate-500" />
              <span>Tidy</span>
            </button>

            {onOpenAiModal && (
              <button
                onClick={onOpenAiModal}
                className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-white bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 rounded-lg shadow-xs shadow-indigo-500/20 transition-all cursor-pointer"
                title="Ask Gemini AI to build, modify, or enhance this diagram"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Ask AI</span>
              </button>
            )}
          </>
        )}
      </div>

      {/* Right: Canvas Settings & Export Buttons */}
      <div className="flex items-center gap-2">
        {/* Canvas Background Settings Dropdown */}
        <div className="relative">
          <button
            onClick={() => setCanvasSettingsOpen(!canvasSettingsOpen)}
            className={`p-2 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1.5 ${
              canvasSettingsOpen
                ? 'bg-blue-50 text-blue-700 border-blue-300'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
            title="Canvas & Grid Settings"
          >
            <Grid className="w-4 h-4 text-slate-500" />
            <span className="hidden md:inline capitalize">{gridType}</span>
          </button>

          {canvasSettingsOpen && (
            <div
              className="absolute right-0 top-11 w-56 bg-white border border-slate-200 rounded-xl shadow-xl p-3 z-50 text-xs text-slate-700 animate-in fade-in"
              onMouseLeave={() => setCanvasSettingsOpen(false)}
            >
              <div className="font-semibold text-slate-800 mb-2">Canvas Background</div>
              <div className="grid grid-cols-2 gap-1.5 mb-3">
                {[
                  { id: 'dots', label: 'Dots' },
                  { id: 'lines', label: 'Lines' },
                  { id: 'cross', label: 'Cross' },
                  { id: 'none', label: 'Plain' },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      onChangeGridType(item.id as any);
                      setCanvasSettingsOpen(false);
                    }}
                    className={`py-1.5 px-2 rounded-lg text-center font-medium border transition-all ${
                      gridType === item.id
                        ? 'bg-blue-50 border-blue-300 text-blue-700'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="font-semibold text-slate-800 mb-1.5 pt-2 border-t border-slate-100">
                Default Edge Style
              </div>
              <div className="space-y-1">
                {[
                  { id: 'smoothstep', label: 'SmoothStep (Orthogonal)' },
                  { id: 'bezier', label: 'Bezier (Curved)' },
                  { id: 'straight', label: 'Straight Line' },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      onChangeDefaultEdgeType(item.id as any);
                      setCanvasSettingsOpen(false);
                    }}
                    className={`w-full text-left py-1 px-2 rounded font-medium flex items-center justify-between ${
                      defaultEdgeType === item.id
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span>{item.label}</span>
                    {defaultEdgeType === item.id && <Check className="w-3.5 h-3.5 text-blue-600" />}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Hidden JSON file input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".json"
          className="hidden"
        />

        {/* Export Menu Dropdown */}
        <div className="relative">
          <button
            onClick={() => setExportMenuOpen(!exportMenuOpen)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-xs shadow-blue-500/20"
          >
            <Download className="w-4 h-4" />
            <span>Export</span>
          </button>

          {exportMenuOpen && (
            <div
              className="absolute right-0 top-11 w-48 bg-white border border-slate-200 rounded-xl shadow-xl py-1.5 z-50 text-xs text-slate-700 animate-in fade-in"
              onMouseLeave={() => setExportMenuOpen(false)}
            >
              <button
                onClick={() => {
                  setExportMenuOpen(false);
                  onExportPNG();
                }}
                className="w-full text-left px-3.5 py-2 hover:bg-slate-50 flex items-center gap-2.5"
              >
                <FileImage className="w-4 h-4 text-blue-600" />
                <div>
                  <div className="font-semibold text-slate-800">Export as PNG</div>
                  <div className="text-[10px] text-slate-400">High-res canvas image</div>
                </div>
              </button>

              <button
                onClick={() => {
                  setExportMenuOpen(false);
                  onExportSVG();
                }}
                className="w-full text-left px-3.5 py-2 hover:bg-slate-50 flex items-center gap-2.5"
              >
                <FileCode className="w-4 h-4 text-emerald-600" />
                <div>
                  <div className="font-semibold text-slate-800">Export as SVG</div>
                  <div className="text-[10px] text-slate-400">Scalable vector graphic</div>
                </div>
              </button>

              <button
                onClick={() => {
                  setExportMenuOpen(false);
                  onExportJSON();
                }}
                className="w-full text-left px-3.5 py-2 hover:bg-slate-50 flex items-center gap-2.5"
              >
                <FileJson className="w-4 h-4 text-amber-600" />
                <div>
                  <div className="font-semibold text-slate-800">Export as JSON</div>
                  <div className="text-[10px] text-slate-400">Reusable schema file</div>
                </div>
              </button>

              <div className="my-1 border-t border-slate-100" />

              <button
                onClick={() => {
                  setExportMenuOpen(false);
                  fileInputRef.current?.click();
                }}
                className="w-full text-left px-3.5 py-2 hover:bg-slate-50 flex items-center gap-2.5"
              >
                <UploadCloud className="w-4 h-4 text-slate-500" />
                <div>
                  <div className="font-semibold text-slate-800">Import JSON</div>
                  <div className="text-[10px] text-slate-400">Load diagram data</div>
                </div>
              </button>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="h-6 w-px bg-slate-200 hidden sm:block" />

        {/* Auth State Button */}
        {user ? (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg">
              <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <span className="text-xs font-medium text-slate-800 max-w-[90px] truncate hidden md:inline">
                {user.name}
              </span>
            </div>
            <button
              onClick={logout}
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={openLoginModal}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-xs cursor-pointer"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Sign In</span>
          </button>
        )}
      </div>
    </header>
  );
}
