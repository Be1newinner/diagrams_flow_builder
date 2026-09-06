'use client';

import React, { memo } from 'react';
import { Handle, Position, NodeProps, NodeResizer } from '@xyflow/react';
import {
  Server,
  Database,
  Cloud,
  Globe,
  Cpu,
  Shield,
  Layers,
  Box,
  HardDrive,
  Radio,
  Smartphone,
  Terminal,
  ArrowLeftRight,
  Lock,
  Network,
  Activity,
  Zap,
  Mail,
  ShoppingCart,
  DollarSign,
  LucideIcon,
} from 'lucide-react';
import { SystemNodeData } from '@/types/diagram';
import { getNodeStyleOverrides } from '@/lib/nodeStyleOverrides';

const ICON_MAP: Record<string, LucideIcon> = {
  server: Server,
  database: Database,
  cloud: Cloud,
  globe: Globe,
  cpu: Cpu,
  shield: Shield,
  layers: Layers,
  box: Box,
  'hard-drive': HardDrive,
  radio: Radio,
  smartphone: Smartphone,
  terminal: Terminal,
  'arrow-left-right': ArrowLeftRight,
  lock: Lock,
  network: Network,
  activity: Activity,
  zap: Zap,
  mail: Mail,
  cart: ShoppingCart,
  dollar: DollarSign,
};

const COLOR_MAP: Record<string, { bg: string; border: string; text: string; badgeBg: string; badgeText: string; ring: string }> = {
  blue: {
    bg: 'bg-blue-50/60',
    border: 'border-blue-200',
    text: 'text-blue-700',
    badgeBg: 'bg-blue-100',
    badgeText: 'text-blue-800',
    ring: 'focus-within:ring-blue-400',
  },
  indigo: {
    bg: 'bg-indigo-50/60',
    border: 'border-indigo-200',
    text: 'text-indigo-700',
    badgeBg: 'bg-indigo-100',
    badgeText: 'text-indigo-800',
    ring: 'focus-within:ring-indigo-400',
  },
  emerald: {
    bg: 'bg-emerald-50/60',
    border: 'border-emerald-200',
    text: 'text-emerald-700',
    badgeBg: 'bg-emerald-100',
    badgeText: 'text-emerald-800',
    ring: 'focus-within:ring-emerald-400',
  },
  amber: {
    bg: 'bg-amber-50/60',
    border: 'border-amber-200',
    text: 'text-amber-700',
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-800',
    ring: 'focus-within:ring-amber-400',
  },
  rose: {
    bg: 'bg-rose-50/60',
    border: 'border-rose-200',
    text: 'text-rose-700',
    badgeBg: 'bg-rose-100',
    badgeText: 'text-rose-800',
    ring: 'focus-within:ring-rose-400',
  },
  purple: {
    bg: 'bg-purple-50/60',
    border: 'border-purple-200',
    text: 'text-purple-700',
    badgeBg: 'bg-purple-100',
    badgeText: 'text-purple-800',
    ring: 'focus-within:ring-purple-400',
  },
  cyan: {
    bg: 'bg-cyan-50/60',
    border: 'border-cyan-200',
    text: 'text-cyan-700',
    badgeBg: 'bg-cyan-100',
    badgeText: 'text-cyan-800',
    ring: 'focus-within:ring-cyan-400',
  },
  slate: {
    bg: 'bg-slate-50/60',
    border: 'border-slate-200',
    text: 'text-slate-700',
    badgeBg: 'bg-slate-100',
    badgeText: 'text-slate-800',
    ring: 'focus-within:ring-slate-400',
  },
};

function SystemNodeComponent({ data, selected }: NodeProps) {
  const nodeData = data as unknown as SystemNodeData;
  const theme = COLOR_MAP[nodeData.themeColor || 'blue'] || COLOR_MAP.blue;
  const IconComponent = ICON_MAP[nodeData.icon] || Server;
  const { wrapperStyle, textStyle } = getNodeStyleOverrides(nodeData);

  return (
    <div
      className={`relative w-full h-full min-w-[200px] min-h-[96px] bg-white rounded-xl border-2 transition-all duration-150 shadow-sm hover:shadow-md ${
        selected ? 'border-blue-500 shadow-md ring-2 ring-blue-400/30' : theme.border
      }`}
      style={{ backgroundColor: nodeData.bgColor, ...wrapperStyle }}
    >
      <NodeResizer
        minWidth={200}
        minHeight={96}
        isVisible={selected}
        lineClassName="border-blue-400"
        handleClassName="h-2.5 w-2.5 bg-white border-2 border-blue-500 rounded"
      />

      {/* Handles on 4 sides — each side gets BOTH a source and a target
          handle stacked at the same spot (same id, opposite type). React
          Flow's loose connectionMode only relaxes the TARGET-side lookup to
          also search the source bucket (@xyflow/system's getEdgePosition);
          the SOURCE-side lookup always searches the source bucket only. So
          an edge whose sourceHandle points at a handle that's only declared
          type="target" (e.g. "top"/"left" below) fails to resolve a
          position and never renders. Duplicating each side with both types
          means any id is always found in whichever bucket a given edge
          needs, regardless of which side is chosen as source vs target. */}
      <Handle
        type="target"
        position={Position.Top}
        id="top"
        className="!w-2.5 !h-2.5 !bg-blue-500 !border-2 !border-white"
      />
      <Handle
        type="source"
        position={Position.Top}
        id="top"
        className="!w-2.5 !h-2.5 !bg-blue-500 !border-2 !border-white"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        className="!w-2.5 !h-2.5 !bg-blue-500 !border-2 !border-white"
      />
      <Handle
        type="target"
        position={Position.Right}
        id="right"
        className="!w-2.5 !h-2.5 !bg-blue-500 !border-2 !border-white"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        className="!w-2.5 !h-2.5 !bg-blue-500 !border-2 !border-white"
      />
      <Handle
        type="target"
        position={Position.Bottom}
        id="bottom"
        className="!w-2.5 !h-2.5 !bg-blue-500 !border-2 !border-white"
      />
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        className="!w-2.5 !h-2.5 !bg-blue-500 !border-2 !border-white"
      />
      <Handle
        type="source"
        position={Position.Left}
        id="left"
        className="!w-2.5 !h-2.5 !bg-blue-500 !border-2 !border-white"
      />

      {/* Card Header & Content */}
      <div className="p-3">
        <div className="flex items-start gap-2.5">
          {/* Icon Box */}
          <div className={`p-2 rounded-lg ${theme.bg} ${theme.text} flex items-center justify-center shrink-0`}>
            <IconComponent className="w-5 h-5" />
          </div>

          {/* Titles & Meta */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-1 mb-0.5">
              <span className="text-xs font-semibold text-slate-800 truncate block" style={textStyle}>
                {nodeData.title || 'System Node'}
              </span>
            </div>
            {nodeData.subtitle && (
              <p className="text-[11px] text-slate-500 truncate leading-tight">
                {nodeData.subtitle}
              </p>
            )}
          </div>
        </div>

        {/* Footer info: Category & Status */}
        {(nodeData.status || nodeData.category) && (
          <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between gap-1 text-[10px]">
            {nodeData.category && (
              <span className="text-slate-400 font-medium uppercase tracking-wider text-[9px]">
                {nodeData.category}
              </span>
            )}
            {nodeData.status && (
              <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full font-medium ${theme.badgeBg} ${theme.badgeText}`}>
                <span className="w-1.5 h-1.5 rounded-full bg-current mr-1 opacity-70 animate-pulse" />
                {nodeData.status}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export const SystemNode = memo(SystemNodeComponent);
