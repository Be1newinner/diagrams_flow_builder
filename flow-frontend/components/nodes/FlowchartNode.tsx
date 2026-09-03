'use client';

import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { FlowchartNodeData } from '@/types/diagram';

const THEME_COLORS: Record<string, { border: string; bg: string; text: string; ring: string }> = {
  blue: { border: 'border-blue-400', bg: 'bg-blue-50/40', text: 'text-blue-900', ring: 'ring-blue-400' },
  emerald: { border: 'border-emerald-400', bg: 'bg-emerald-50/40', text: 'text-emerald-900', ring: 'ring-emerald-400' },
  amber: { border: 'border-amber-400', bg: 'bg-amber-50/40', text: 'text-amber-900', ring: 'ring-amber-400' },
  rose: { border: 'border-rose-400', bg: 'bg-rose-50/40', text: 'text-rose-900', ring: 'ring-rose-400' },
  purple: { border: 'border-purple-400', bg: 'bg-purple-50/40', text: 'text-purple-900', ring: 'ring-purple-400' },
  cyan: { border: 'border-cyan-400', bg: 'bg-cyan-50/40', text: 'text-cyan-900', ring: 'ring-cyan-400' },
  slate: { border: 'border-slate-300', bg: 'bg-slate-50/40', text: 'text-slate-800', ring: 'ring-slate-400' },
};

function FlowchartNodeComponent({ data, selected }: NodeProps) {
  const nodeData = data as unknown as FlowchartNodeData;
  const theme = THEME_COLORS[nodeData.themeColor || 'slate'] || THEME_COLORS.slate;
  const shape = nodeData.shape || 'process';

  if (shape === 'decision') {
    return (
      <div className="relative w-36 h-36 flex items-center justify-center">
        {/* Handles on the diamond points */}
        <Handle
          type="target"
          position={Position.Top}
          id="top"
          className="!w-2.5 !h-2.5 !bg-amber-500 !border-2 !border-white"
        />
        <Handle
          type="source"
          position={Position.Right}
          id="right"
          className="!w-2.5 !h-2.5 !bg-amber-500 !border-2 !border-white"
        />
        <Handle
          type="source"
          position={Position.Bottom}
          id="bottom"
          className="!w-2.5 !h-2.5 !bg-amber-500 !border-2 !border-white"
        />
        <Handle
          type="target"
          position={Position.Left}
          id="left"
          className="!w-2.5 !h-2.5 !bg-amber-500 !border-2 !border-white"
        />

        {/* Rotated Diamond Background */}
        <div
          className={`absolute inset-3 rotate-45 bg-white ${theme.border} border-2 rounded-md shadow-sm transition-all duration-150 ${
            selected ? 'border-amber-500 shadow-md ring-2 ring-amber-400/40' : ''
          }`}
        />

        {/* Content Container (un-rotated) */}
        <div className="relative z-10 p-3 text-center max-w-[100px]">
          <p className="text-xs font-semibold text-slate-800 leading-tight">
            {nodeData.label || 'Decision?'}
          </p>
          {nodeData.description && (
            <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-2 leading-tight">
              {nodeData.description}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (shape === 'start-end') {
    return (
      <div
        className={`relative min-w-[170px] px-5 py-2.5 bg-white rounded-full border-2 text-center transition-all duration-150 shadow-sm ${
          theme.border
        } ${selected ? 'border-blue-500 shadow-md ring-2 ring-blue-400/40' : ''}`}
      >
        <Handle type="target" position={Position.Top} id="top" className="!w-2.5 !h-2.5 !bg-blue-500 !border-2 !border-white" />
        <Handle type="source" position={Position.Right} id="right" className="!w-2.5 !h-2.5 !bg-blue-500 !border-2 !border-white" />
        <Handle type="source" position={Position.Bottom} id="bottom" className="!w-2.5 !h-2.5 !bg-blue-500 !border-2 !border-white" />
        <Handle type="target" position={Position.Left} id="left" className="!w-2.5 !h-2.5 !bg-blue-500 !border-2 !border-white" />

        <div className="font-semibold text-xs text-slate-800 truncate">
          {nodeData.label || 'Start / End'}
        </div>
        {nodeData.description && (
          <div className="text-[10px] text-slate-500 truncate mt-0.5">
            {nodeData.description}
          </div>
        )}
      </div>
    );
  }

  if (shape === 'input-output') {
    return (
      <div className="relative">
        <Handle type="target" position={Position.Top} id="top" className="!w-2.5 !h-2.5 !bg-cyan-500 !border-2 !border-white" />
        <Handle type="source" position={Position.Right} id="right" className="!w-2.5 !h-2.5 !bg-cyan-500 !border-2 !border-white" />
        <Handle type="source" position={Position.Bottom} id="bottom" className="!w-2.5 !h-2.5 !bg-cyan-500 !border-2 !border-white" />
        <Handle type="target" position={Position.Left} id="left" className="!w-2.5 !h-2.5 !bg-cyan-500 !border-2 !border-white" />

        <div
          className={`-skew-x-12 min-w-[180px] bg-white rounded-md border-2 px-5 py-3 transition-all duration-150 shadow-sm ${
            theme.border
          } ${selected ? 'border-cyan-500 shadow-md ring-2 ring-cyan-400/40' : ''}`}
        >
          <div className="skew-x-12 text-center">
            <div className="font-semibold text-xs text-slate-800 truncate">
              {nodeData.label || 'Input / Output'}
            </div>
            {nodeData.description && (
              <div className="text-[10px] text-slate-500 truncate mt-0.5">
                {nodeData.description}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Default: Process (Rectangle)
  return (
    <div
      className={`relative min-w-[190px] max-w-[240px] bg-white rounded-lg border-2 p-3 text-center transition-all duration-150 shadow-sm ${
        theme.border
      } ${selected ? 'border-blue-500 shadow-md ring-2 ring-blue-400/40' : ''}`}
    >
      <Handle type="target" position={Position.Top} id="top" className="!w-2.5 !h-2.5 !bg-blue-500 !border-2 !border-white" />
      <Handle type="source" position={Position.Right} id="right" className="!w-2.5 !h-2.5 !bg-blue-500 !border-2 !border-white" />
      <Handle type="source" position={Position.Bottom} id="bottom" className="!w-2.5 !h-2.5 !bg-blue-500 !border-2 !border-white" />
      <Handle type="target" position={Position.Left} id="left" className="!w-2.5 !h-2.5 !bg-blue-500 !border-2 !border-white" />

      <div className="font-semibold text-xs text-slate-800 leading-snug">
        {nodeData.label || 'Process Step'}
      </div>
      {nodeData.description && (
        <div className="text-[11px] text-slate-500 mt-1 leading-snug">
          {nodeData.description}
        </div>
      )}
    </div>
  );
}

export const FlowchartNode = memo(FlowchartNodeComponent);
