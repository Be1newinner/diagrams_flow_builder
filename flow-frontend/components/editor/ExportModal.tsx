'use client';

import React, { useState } from 'react';
import { X, Download, FileImage, FileCode, FileText, Loader2, Maximize, ScanEye } from 'lucide-react';

export type ExportFormat = 'png' | 'svg' | 'pdf';
export type ExportMultiplier = 1 | 2 | 3 | 4 | 5;
export type ExportScope = 'all' | 'visible';

export interface ExportOptions {
  format: ExportFormat;
  multiplier: ExportMultiplier;
  scope: ExportScope;
}

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialFormat: ExportFormat;
  diagramTitle: string;
  onExport: (options: ExportOptions) => Promise<void> | void;
}

const FORMAT_OPTIONS: { id: ExportFormat; label: string; icon: typeof FileImage; hint: string }[] = [
  { id: 'png', label: 'PNG', icon: FileImage, hint: 'Raster image' },
  { id: 'svg', label: 'SVG', icon: FileCode, hint: 'Vector graphic' },
  { id: 'pdf', label: 'PDF', icon: FileText, hint: 'Print-ready document' },
];

const MULTIPLIERS: ExportMultiplier[] = [1, 2, 3, 4, 5];

export function ExportModal({ isOpen, onClose, initialFormat, diagramTitle, onExport }: ExportModalProps) {
  const [format, setFormat] = useState<ExportFormat>(initialFormat);
  const [multiplier, setMultiplier] = useState<ExportMultiplier>(1);
  const [scope, setScope] = useState<ExportScope>('all');
  const [isExporting, setIsExporting] = useState(false);

  // Keep the tab in sync with whichever menu item opened the modal, each
  // time it opens — but not while it's already open, so switching format
  // mid-flow via the tabs isn't clobbered by a parent re-render.
  const lastOpenRef = React.useRef(isOpen);
  if (isOpen && !lastOpenRef.current) {
    lastOpenRef.current = true;
    if (format !== initialFormat) setFormat(initialFormat);
  } else if (!isOpen) {
    lastOpenRef.current = false;
  }

  if (!isOpen) return null;

  const handleClose = () => {
    if (isExporting) return;
    setMultiplier(1);
    setScope('all');
    onClose();
  };

  const handleExportClick = async () => {
    setIsExporting(true);
    try {
      await onExport({ format, multiplier, scope });
      handleClose();
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-4" onClick={handleClose}>
      <div
        className="w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-slate-100 flex items-center justify-between shrink-0">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2 min-w-0">
            <Download className="w-4 h-4 text-blue-600 shrink-0" />
            <span className="truncate">Export &quot;{diagramTitle}&quot;</span>
          </h2>
          <button onClick={handleClose} className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-5 text-xs">
          {/* Format */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">Format</label>
            <div className="grid grid-cols-3 gap-2">
              {FORMAT_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setFormat(opt.id)}
                  className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border text-[11px] font-semibold transition-colors cursor-pointer ${
                    format === opt.id
                      ? 'border-blue-500 bg-blue-50 text-blue-700 ring-1 ring-blue-400/40'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <opt.icon className="w-4 h-4" />
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Size multiplier */}
          <div>
            <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">
              <Maximize className="w-3 h-3" />
              Size
            </label>
            <div className="grid grid-cols-5 gap-1.5">
              {MULTIPLIERS.map((m) => (
                <button
                  key={m}
                  onClick={() => setMultiplier(m)}
                  className={`py-2 rounded-lg border text-[11px] font-bold transition-colors cursor-pointer ${
                    multiplier === m
                      ? 'border-blue-500 bg-blue-50 text-blue-700 ring-1 ring-blue-400/40'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {m}x
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[10px] text-slate-400">1x &asymp; 720p baseline resolution</p>
          </div>

          {/* Scope toggle */}
          <div>
            <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">
              <ScanEye className="w-3 h-3" />
              Canvas area
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setScope('all')}
                className={`px-3 py-2.5 rounded-xl border text-left transition-colors cursor-pointer ${
                  scope === 'all'
                    ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-400/40'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className={`font-semibold ${scope === 'all' ? 'text-blue-700' : 'text-slate-800'}`}>All nodes</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Whole diagram, zoomed to fit</div>
              </button>
              <button
                onClick={() => setScope('visible')}
                className={`px-3 py-2.5 rounded-xl border text-left transition-colors cursor-pointer ${
                  scope === 'visible'
                    ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-400/40'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className={`font-semibold ${scope === 'visible' ? 'text-blue-700' : 'text-slate-800'}`}>Visible area</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Just what&apos;s on screen now</div>
              </button>
            </div>
          </div>

          <button
            onClick={handleExportClick}
            disabled={isExporting}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed rounded-xl shadow-xs shadow-blue-500/20 transition-colors cursor-pointer"
          >
            {isExporting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Exporting&hellip;
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Export {format.toUpperCase()}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
