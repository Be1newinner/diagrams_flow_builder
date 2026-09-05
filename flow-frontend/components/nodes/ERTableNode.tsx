'use client';

import React, { memo } from 'react';
import { Handle, Position, NodeProps, NodeResizer } from '@xyflow/react';
import { Table, Key, Hash } from 'lucide-react';
import { ERTableNodeData } from '@/types/diagram';

const HEADER_THEMES: Record<string, { bg: string; text: string; border: string }> = {
  blue: { bg: 'bg-blue-600', text: 'text-white', border: 'border-blue-200' },
  indigo: { bg: 'bg-indigo-600', text: 'text-white', border: 'border-indigo-200' },
  emerald: { bg: 'bg-emerald-600', text: 'text-white', border: 'border-emerald-200' },
  amber: { bg: 'bg-amber-600', text: 'text-white', border: 'border-amber-200' },
  rose: { bg: 'bg-rose-600', text: 'text-white', border: 'border-rose-200' },
  purple: { bg: 'bg-purple-600', text: 'text-white', border: 'border-purple-200' },
  slate: { bg: 'bg-slate-700', text: 'text-white', border: 'border-slate-300' },
};

function ERTableNodeComponent({ data, selected }: NodeProps) {
  const nodeData = data as unknown as ERTableNodeData;
  const headerTheme = HEADER_THEMES[nodeData.headerColor || 'blue'] || HEADER_THEMES.blue;
  const columns = nodeData.columns || [];

  return (
    <div
      className={`relative w-full h-full min-w-[240px] min-h-[100px] bg-white rounded-lg border-2 shadow-sm transition-all duration-150 overflow-hidden flex flex-col ${
        selected ? 'border-blue-500 shadow-md ring-2 ring-blue-400/40' : 'border-slate-200'
      }`}
      style={{ backgroundColor: nodeData.bgColor }}
    >
      <NodeResizer
        minWidth={240}
        minHeight={100}
        isVisible={selected}
        lineClassName="border-blue-400"
        handleClassName="h-2.5 w-2.5 bg-white border-2 border-blue-500 rounded"
      />

      {/* General Table Handles */}
      <Handle type="target" position={Position.Top} id="top" className="!w-2.5 !h-2.5 !bg-blue-500 !border-2 !border-white" />
      <Handle type="source" position={Position.Right} id="right" className="!w-2.5 !h-2.5 !bg-blue-500 !border-2 !border-white" />
      <Handle type="source" position={Position.Bottom} id="bottom" className="!w-2.5 !h-2.5 !bg-blue-500 !border-2 !border-white" />
      <Handle type="target" position={Position.Left} id="left" className="!w-2.5 !h-2.5 !bg-blue-500 !border-2 !border-white" />

      {/* Table Header */}
      <div className={`${headerTheme.bg} ${headerTheme.text} shrink-0 px-3 py-2 flex items-center justify-between`}>
        <div className="flex items-center gap-1.5 min-w-0">
          <Table className="w-3.5 h-3.5 shrink-0 opacity-85" />
          <span className="font-semibold text-xs tracking-wide truncate">
            {nodeData.tableName || 'table_name'}
          </span>
        </div>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/20 font-mono font-medium">
          {columns.length} cols
        </span>
      </div>

      {/* Table Columns List */}
      <div className="divide-y divide-slate-100 flex-1 overflow-y-auto">
        {columns.map((col, index) => (
          <div
            key={col.id || index}
            className="px-3 py-1.5 flex items-center justify-between gap-2 text-[11px] hover:bg-slate-50/80 transition-colors relative group"
          >
            {/* Left side: Key badge & column name */}
            <div className="flex items-center gap-1.5 min-w-0">
              {col.isPrimary ? (
                <span className="inline-flex items-center px-1 py-0.2 rounded text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                  <Key className="w-2.5 h-2.5 mr-0.5" />
                  PK
                </span>
              ) : col.isForeign ? (
                <span className="inline-flex items-center px-1 py-0.2 rounded text-[9px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-300">
                  <Hash className="w-2.5 h-2.5 mr-0.5" />
                  FK
                </span>
              ) : (
                <span className="w-6 inline-block" />
              )}
              <span className={`truncate font-mono ${col.isPrimary ? 'font-bold text-slate-900' : 'text-slate-700'}`}>
                {col.name}
              </span>
            </div>

            {/* Right side: Data type & nullable */}
            <div className="flex items-center gap-1 shrink-0 font-mono text-[10px] text-slate-500">
              <span>{col.type}</span>
              {col.isNullable && <span className="text-slate-400 text-[9px]">NULL</span>}
            </div>
          </div>
        ))}

        {columns.length === 0 && (
          <div className="p-3 text-center text-xs text-slate-400 italic">
            No columns defined yet
          </div>
        )}
      </div>
    </div>
  );
}

export const ERTableNode = memo(ERTableNodeComponent);
