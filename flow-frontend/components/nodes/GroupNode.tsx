'use client';

import React, { memo } from 'react';
import { NodeProps, NodeResizer } from '@xyflow/react';
import { GroupNodeData } from '@/types/diagram';

const PRESET_STYLES: Record<string, { bg: string; border: string; text: string; headerBg: string }> = {
  slate: { bg: 'bg-slate-50/50', border: 'border-slate-300', text: 'text-slate-700', headerBg: 'bg-slate-200/80' },
  blue: { bg: 'bg-blue-50/40', border: 'border-blue-300', text: 'text-blue-800', headerBg: 'bg-blue-100' },
  emerald: { bg: 'bg-emerald-50/40', border: 'border-emerald-300', text: 'text-emerald-800', headerBg: 'bg-emerald-100' },
  amber: { bg: 'bg-amber-50/40', border: 'border-amber-300', text: 'text-amber-800', headerBg: 'bg-amber-100' },
  purple: { bg: 'bg-purple-50/40', border: 'border-purple-300', text: 'text-purple-800', headerBg: 'bg-purple-100' },
  rose: { bg: 'bg-rose-50/40', border: 'border-rose-300', text: 'text-rose-800', headerBg: 'bg-rose-100' },
};

function GroupNodeComponent({ data, selected }: NodeProps) {
  const nodeData = data as unknown as GroupNodeData;
  const style = PRESET_STYLES[nodeData.stylePreset || 'slate'] || PRESET_STYLES.slate;

  return (
    <div
      className={`min-w-[280px] min-h-[180px] w-full h-full rounded-xl border-2 border-dashed ${style.border} ${style.bg} relative transition-all duration-150 ${
        selected ? 'ring-2 ring-blue-400 border-blue-500 border-solid shadow-md' : ''
      }`}
    >
      <NodeResizer
        minWidth={200}
        minHeight={140}
        isVisible={selected}
        lineClassName="border-blue-400"
        handleClassName="h-2.5 w-2.5 bg-white border-2 border-blue-500 rounded"
      />

      {/* Group Title Badge */}
      <div className="absolute top-2 left-2 flex items-center gap-1.5 z-10 pointer-events-auto">
        <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ${style.headerBg} ${style.text} shadow-xs border border-white/60`}>
          {nodeData.label || 'Group / Container'}
        </span>
      </div>
    </div>
  );
}

export const GroupNode = memo(GroupNodeComponent);
