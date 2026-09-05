'use client';

import React from 'react';
import {
  AlignHorizontalJustifyStart,
  AlignHorizontalJustifyCenter,
  AlignHorizontalJustifyEnd,
  AlignVerticalJustifyStart,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignHorizontalDistributeCenter,
  AlignVerticalDistributeCenter,
  StretchHorizontal,
  StretchVertical,
} from 'lucide-react';

interface AlignmentToolbarProps {
  count: number;
  onAlign: (mode: 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom') => void;
  onDistribute: (axis: 'horizontal' | 'vertical') => void;
  onMatchSize: (dimension: 'width' | 'height') => void;
}

// Floating toolbar shown over the canvas once 2+ nodes are selected —
// standard diagram-tool behavior (Figma, draw.io, etc.) that was entirely
// missing here: previously the only way to line nodes up was dragging by
// eye against the grid.
export function AlignmentToolbar({ count, onAlign, onDistribute, onMatchSize }: AlignmentToolbarProps) {
  if (count < 2) return null;

  const canDistribute = count >= 3;

  const btnClass =
    'p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer disabled:cursor-not-allowed';

  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1 bg-white border border-slate-200 rounded-xl shadow-lg px-2 py-1.5">
      <span className="text-[11px] font-semibold text-slate-500 px-1.5 whitespace-nowrap">
        {count} selected
      </span>
      <div className="h-4 w-px bg-slate-200 mx-0.5" />

      <button onClick={() => onAlign('left')} className={btnClass} title="Align left">
        <AlignHorizontalJustifyStart className="w-4 h-4" />
      </button>
      <button onClick={() => onAlign('hcenter')} className={btnClass} title="Align horizontal center">
        <AlignHorizontalJustifyCenter className="w-4 h-4" />
      </button>
      <button onClick={() => onAlign('right')} className={btnClass} title="Align right">
        <AlignHorizontalJustifyEnd className="w-4 h-4" />
      </button>

      <div className="h-4 w-px bg-slate-200 mx-0.5" />

      <button onClick={() => onAlign('top')} className={btnClass} title="Align top">
        <AlignVerticalJustifyStart className="w-4 h-4" />
      </button>
      <button onClick={() => onAlign('vcenter')} className={btnClass} title="Align vertical center">
        <AlignVerticalJustifyCenter className="w-4 h-4" />
      </button>
      <button onClick={() => onAlign('bottom')} className={btnClass} title="Align bottom">
        <AlignVerticalJustifyEnd className="w-4 h-4" />
      </button>

      <div className="h-4 w-px bg-slate-200 mx-0.5" />

      <button
        onClick={() => onDistribute('horizontal')}
        disabled={!canDistribute}
        className={btnClass}
        title={canDistribute ? 'Distribute horizontally' : 'Select 3+ nodes to distribute'}
      >
        <AlignHorizontalDistributeCenter className="w-4 h-4" />
      </button>
      <button
        onClick={() => onDistribute('vertical')}
        disabled={!canDistribute}
        className={btnClass}
        title={canDistribute ? 'Distribute vertically' : 'Select 3+ nodes to distribute'}
      >
        <AlignVerticalDistributeCenter className="w-4 h-4" />
      </button>

      <div className="h-4 w-px bg-slate-200 mx-0.5" />

      <button onClick={() => onMatchSize('width')} className={btnClass} title="Match width (to first selected)">
        <StretchHorizontal className="w-4 h-4" />
      </button>
      <button onClick={() => onMatchSize('height')} className={btnClass} title="Match height (to first selected)">
        <StretchVertical className="w-4 h-4" />
      </button>
    </div>
  );
}
