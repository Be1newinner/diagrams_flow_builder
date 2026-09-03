'use client';

import React from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import { Diagram } from '@/types/diagram';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  diagram: Diagram | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteConfirmModal({
  isOpen,
  diagram,
  onClose,
  onConfirm,
}: DeleteConfirmModalProps) {
  if (!isOpen || !diagram) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-md overflow-hidden p-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-100 text-red-600 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-bold text-slate-900">Delete Diagram?</h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Are you sure you want to delete <span className="font-semibold text-slate-800">&quot;{diagram.title}&quot;</span>? This action cannot be undone.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2.5">
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors shadow-xs shadow-red-500/20"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete Diagram</span>
          </button>
        </div>
      </div>
    </div>
  );
}
