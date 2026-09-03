'use client';

import React, { memo } from 'react';
import { NodeProps, Handle, Position } from '@xyflow/react';
import { StickyNodeData } from '@/types/diagram';

const STICKY_COLORS: Record<string, { bg: string; border: string; text: string; header: string }> = {
  yellow: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-900', header: 'text-amber-950 font-bold' },
  blue: { bg: 'bg-sky-50', border: 'border-sky-200', text: 'text-sky-900', header: 'text-sky-950 font-bold' },
  green: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-900', header: 'text-emerald-950 font-bold' },
  pink: { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-900', header: 'text-rose-950 font-bold' },
  purple: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-900', header: 'text-purple-950 font-bold' },
};

function StickyNodeComponent({ data, selected }: NodeProps) {
  const nodeData = data as unknown as StickyNodeData;
  const theme = STICKY_COLORS[nodeData.color || 'yellow'] || STICKY_COLORS.yellow;

  return (
    <div
      className={`relative w-[220px] p-3.5 rounded-lg border shadow-xs transition-all duration-150 ${
        theme.bg
      } ${theme.border} ${
        selected ? 'ring-2 ring-amber-400 border-amber-400 shadow-md scale-[1.02]' : ''
      }`}
    >
      <Handle type="target" position={Position.Top} id="top" className="!w-2 !h-2 !bg-amber-400 !border !border-white" />
      <Handle type="source" position={Position.Right} id="right" className="!w-2 !h-2 !bg-amber-400 !border !border-white" />
      <Handle type="source" position={Position.Bottom} id="bottom" className="!w-2 !h-2 !bg-amber-400 !border !border-white" />
      <Handle type="target" position={Position.Left} id="left" className="!w-2 !h-2 !bg-amber-400 !border !border-white" />

      {nodeData.title && (
        <div className={`text-xs ${theme.header} mb-1.5 border-b border-black/5 pb-1`}>
          {nodeData.title}
        </div>
      )}

      <div className={`text-xs ${theme.text} whitespace-pre-wrap leading-relaxed font-sans`}>
        {nodeData.text || 'Write your architecture note here...'}
      </div>
    </div>
  );
}

export const StickyNode = memo(StickyNodeComponent);
