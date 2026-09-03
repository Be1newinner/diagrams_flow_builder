'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Network,
  GitFork,
  Database,
  Layers,
  MoreVertical,
  Copy,
  Download,
  Trash2,
  ExternalLink,
  Clock,
  Shapes,
  ArrowRight,
} from 'lucide-react';
import { Diagram } from '@/types/diagram';

interface DiagramCardProps {
  diagram: Diagram;
  viewMode: 'grid' | 'list';
  onDuplicate: (id: string) => void;
  onExport: (id: string) => void;
  onDelete: (diagram: Diagram) => void;
}

const CATEGORY_CONFIG: Record<
  string,
  { label: string; icon: React.ReactNode; badgeBg: string; badgeText: string; border: string; accent: string }
> = {
  'system-design': {
    label: 'System Design',
    icon: <Network className="w-3.5 h-3.5" />,
    badgeBg: 'bg-indigo-50',
    badgeText: 'text-indigo-700',
    border: 'border-indigo-100',
    accent: 'bg-indigo-500',
  },
  flowchart: {
    label: 'Flowchart',
    icon: <GitFork className="w-3.5 h-3.5" />,
    badgeBg: 'bg-amber-50',
    badgeText: 'text-amber-700',
    border: 'border-amber-100',
    accent: 'bg-amber-500',
  },
  'er-diagram': {
    label: 'ER Diagram',
    icon: <Database className="w-3.5 h-3.5" />,
    badgeBg: 'bg-emerald-50',
    badgeText: 'text-emerald-700',
    border: 'border-emerald-100',
    accent: 'bg-emerald-500',
  },
  general: {
    label: 'General Flow',
    icon: <Layers className="w-3.5 h-3.5" />,
    badgeBg: 'bg-slate-50',
    badgeText: 'text-slate-700',
    border: 'border-slate-200',
    accent: 'bg-slate-500',
  },
};

function formatRelativeTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  } catch {
    return 'Recently';
  }
}

export function DiagramCard({
  diagram,
  viewMode,
  onDuplicate,
  onExport,
  onDelete,
}: DiagramCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const config = CATEGORY_CONFIG[diagram.category] || CATEGORY_CONFIG.general;
  const nodeCount = diagram.nodes?.length || 0;
  const edgeCount = diagram.edges?.length || 0;

  if (viewMode === 'list') {
    return (
      <div className="group bg-white border border-slate-200 rounded-xl p-3.5 hover:border-blue-400 hover:shadow-xs transition-all flex items-center justify-between gap-4">
        {/* Left: Type icon & Info */}
        <Link href={`/flow/${diagram.id}`} className="flex items-center gap-3.5 min-w-0 flex-1">
          <div className={`p-2.5 rounded-lg ${config.badgeBg} ${config.badgeText} shrink-0`}>
            {config.icon}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-800 group-hover:text-blue-600 truncate transition-colors">
                {diagram.title}
              </h3>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${config.badgeBg} ${config.badgeText}`}>
                {config.label}
              </span>
            </div>
            {diagram.description && (
              <p className="text-xs text-slate-500 truncate mt-0.5 max-w-xl">
                {diagram.description}
              </p>
            )}
          </div>
        </Link>

        {/* Stats */}
        <div className="hidden sm:flex items-center gap-4 text-xs text-slate-400 shrink-0">
          <div className="flex items-center gap-1.5 font-mono">
            <Shapes className="w-3.5 h-3.5 text-slate-400" />
            <span>{nodeCount} nodes</span>
            <span>•</span>
            <span>{edgeCount} edges</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            <span>{formatRelativeTime(diagram.updatedAt)}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0 relative">
          <Link
            href={`/flow/${diagram.id}`}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
          >
            <span>Edit</span>
            <ArrowRight className="w-3 h-3" />
          </Link>

          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {menuOpen && (
            <div
              className="absolute right-0 top-8 w-44 bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-20 text-xs text-slate-700 animate-in fade-in zoom-in-95"
              onMouseLeave={() => setMenuOpen(false)}
            >
              <button
                onClick={() => {
                  setMenuOpen(false);
                  onDuplicate(diagram.id);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center gap-2"
              >
                <Copy className="w-3.5 h-3.5 text-slate-500" />
                <span>Duplicate Flow</span>
              </button>
              <button
                onClick={() => {
                  setMenuOpen(false);
                  onExport(diagram.id);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center gap-2"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span>Export JSON</span>
              </button>
              <div className="my-1 border-t border-slate-100" />
              <button
                onClick={() => {
                  setMenuOpen(false);
                  onDelete(diagram);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-red-50 text-red-600 flex items-center gap-2"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Grid Mode Card
  return (
    <div className="group bg-white border border-slate-200 rounded-2xl overflow-hidden hover:border-blue-400 hover:shadow-md transition-all duration-200 flex flex-col justify-between">
      {/* Top Banner / Canvas Preview Area */}
      <Link
        href={`/flow/${diagram.id}`}
        className="block relative bg-gradient-to-b from-slate-50 to-slate-100/60 p-5 border-b border-slate-100 overflow-hidden cursor-pointer"
      >
        {/* Subtle grid pattern background */}
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage: 'radial-gradient(#94a3b8 0.75px, transparent 0.75px)',
            backgroundSize: '12px 12px',
          }}
        />

        <div className="relative flex items-center justify-between z-10">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${config.badgeBg} ${config.badgeText} border border-white shadow-2xs`}
          >
            {config.icon}
            <span>{config.label}</span>
          </span>

          <span className="text-[11px] font-mono text-slate-500 bg-white/90 px-2 py-0.5 rounded-md border border-slate-200/80 shadow-2xs">
            {nodeCount} nodes • {edgeCount} edges
          </span>
        </div>

        {/* Visual Miniature Abstract Representation */}
        <div className="relative mt-5 mb-2 h-20 flex items-center justify-center">
          <div className="flex items-center gap-3">
            <div className="w-12 h-10 rounded-lg bg-white border border-slate-200 shadow-2xs flex items-center justify-center group-hover:scale-105 transition-transform">
              <div className={`w-3 h-3 rounded-full ${config.accent} opacity-80`} />
            </div>
            <div className="w-8 border-t-2 border-dashed border-slate-300" />
            <div className="w-14 h-12 rounded-lg bg-white border-2 border-blue-400/60 shadow-xs flex items-center justify-center group-hover:scale-110 transition-transform">
              <div className="w-6 h-1.5 rounded bg-blue-500/70" />
            </div>
            <div className="w-8 border-t-2 border-dashed border-slate-300" />
            <div className="w-12 h-10 rounded-lg bg-white border border-slate-200 shadow-2xs flex items-center justify-center group-hover:scale-105 transition-transform">
              <div className="w-3 h-3 rounded bg-emerald-500/80" />
            </div>
          </div>
        </div>
      </Link>

      {/* Card Body */}
      <div className="p-4 flex-1 flex flex-col justify-between">
        <div>
          <div className="flex items-start justify-between gap-2">
            <Link href={`/flow/${diagram.id}`}>
              <h3 className="font-semibold text-sm text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-1">
                {diagram.title}
              </h3>
            </Link>

            {/* Quick Menu */}
            <div className="relative shrink-0">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(!menuOpen);
                }}
                className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              {menuOpen && (
                <div
                  className="absolute right-0 top-7 w-44 bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-20 text-xs text-slate-700 animate-in fade-in zoom-in-95"
                  onMouseLeave={() => setMenuOpen(false)}
                >
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      onDuplicate(diagram.id);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center gap-2"
                  >
                    <Copy className="w-3.5 h-3.5 text-slate-500" />
                    <span>Duplicate Flow</span>
                  </button>
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      onExport(diagram.id);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center gap-2"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-500" />
                    <span>Export JSON</span>
                  </button>
                  <div className="my-1 border-t border-slate-100" />
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      onDelete(diagram);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-red-50 text-red-600 flex items-center gap-2"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          <p className="text-xs text-slate-500 mt-1.5 line-clamp-2 leading-relaxed">
            {diagram.description || 'No description provided.'}
          </p>

          {/* Tags */}
          {diagram.tags && diagram.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1">
              {diagram.tags.slice(0, 3).map((tag, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600"
                >
                  #{tag}
                </span>
              ))}
              {diagram.tags.length > 3 && (
                <span className="text-[10px] text-slate-400 py-0.5">+{diagram.tags.length - 3}</span>
              )}
            </div>
          )}
        </div>

        {/* Card Footer */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1 text-slate-400 text-[11px]">
            <Clock className="w-3 h-3" />
            <span>{formatRelativeTime(diagram.updatedAt)}</span>
          </div>

          <Link
            href={`/flow/${diagram.id}`}
            className="inline-flex items-center gap-1 font-semibold text-xs text-blue-600 hover:text-blue-700 group/link"
          >
            <span>Open Canvas</span>
            <ExternalLink className="w-3 h-3 transition-transform group-hover/link:translate-x-0.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
