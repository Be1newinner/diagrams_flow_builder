'use client';

import React, { memo } from 'react';
import { NodeProps, Handle, Position, NodeResizer } from '@xyflow/react';
import { StickyNodeData } from '@/types/diagram';
import { getNodeStyleOverrides } from '@/lib/nodeStyleOverrides';

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
  const { wrapperStyle, textStyle } = getNodeStyleOverrides(nodeData);

  return (
    <div
      className={`relative w-full h-full min-w-[160px] min-h-[100px] p-3.5 rounded-lg border shadow-xs transition-all duration-150 overflow-auto ${
        theme.bg
      } ${theme.border} ${
        selected ? 'ring-2 ring-amber-400 border-amber-400 shadow-md' : ''
      }`}
      style={{ backgroundColor: nodeData.bgColor, ...wrapperStyle }}
    >
      <NodeResizer
        minWidth={160}
        minHeight={100}
        isVisible={selected}
        lineClassName="border-amber-400"
        handleClassName="h-2.5 w-2.5 bg-white border-2 border-amber-500 rounded"
      />
      {/* Both a source and target handle per side — see SystemNode.tsx for
          why a single handle per side isn't enough for any-side edges. */}
      <Handle type="target" position={Position.Top} id="top" className="!w-2 !h-2 !bg-amber-400 !border !border-white" />
      <Handle type="source" position={Position.Top} id="top" className="!w-2 !h-2 !bg-amber-400 !border !border-white" />
      <Handle type="source" position={Position.Right} id="right" className="!w-2 !h-2 !bg-amber-400 !border !border-white" />
      <Handle type="target" position={Position.Right} id="right" className="!w-2 !h-2 !bg-amber-400 !border !border-white" />
      <Handle type="source" position={Position.Bottom} id="bottom" className="!w-2 !h-2 !bg-amber-400 !border !border-white" />
      <Handle type="target" position={Position.Bottom} id="bottom" className="!w-2 !h-2 !bg-amber-400 !border !border-white" />
      <Handle type="target" position={Position.Left} id="left" className="!w-2 !h-2 !bg-amber-400 !border !border-white" />
      <Handle type="source" position={Position.Left} id="left" className="!w-2 !h-2 !bg-amber-400 !border !border-white" />

      {nodeData.title && (
        <div className={`text-xs ${theme.header} mb-1.5 border-b border-black/5 pb-1`}>
          {nodeData.title}
        </div>
      )}

      <div className={`text-xs ${theme.text} whitespace-pre-wrap leading-relaxed font-sans`} style={textStyle}>
        {nodeData.text || 'Write your architecture note here...'}
      </div>
    </div>
  );
}

export const StickyNode = memo(StickyNodeComponent);
