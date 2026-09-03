'use client';

import React, { memo } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  EdgeProps,
  getSmoothStepPath,
  getBezierPath,
  getStraightPath,
  useReactFlow,
} from '@xyflow/react';
import { X } from 'lucide-react';
import { CustomEdgeData } from '@/types/diagram';

function CustomEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
  selected,
}: EdgeProps) {
  const { setEdges } = useReactFlow();
  const edgeData = (data || {}) as CustomEdgeData;

  const edgeType = edgeData.edgeType || 'smoothstep';

  let edgePath = '';
  let labelX = 0;
  let labelY = 0;

  if (edgeType === 'bezier') {
    [edgePath, labelX, labelY] = getBezierPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
    });
  } else if (edgeType === 'straight') {
    [edgePath, labelX, labelY] = getStraightPath({
      sourceX,
      sourceY,
      targetX,
      targetY,
    });
  } else {
    [edgePath, labelX, labelY] = getSmoothStepPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
      borderRadius: 8,
    });
  }

  const strokeColor = edgeData.strokeColor || (selected ? '#2563eb' : '#94a3b8');
  const strokeWidth = edgeData.strokeWidth || (selected ? 2.5 : 2);
  const isAnimated = edgeData.animated ?? false;

  const customStyle: React.CSSProperties = {
    ...style,
    stroke: strokeColor,
    strokeWidth,
    ...(edgeData.strokeStyle === 'dashed' ? { strokeDasharray: '6 4' } : {}),
    ...(edgeData.strokeStyle === 'dotted' ? { strokeDasharray: '2 3' } : {}),
    ...(isAnimated ? { strokeDasharray: '6 4', animation: 'flowEdge 1s linear infinite' } : {}),
  };

  const onDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEdges((edges) => edges.filter((edge) => edge.id !== id));
  };

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={customStyle} />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
          }}
          className="group flex items-center gap-1 z-20"
        >
          {edgeData.label && (
            <div
              className={`px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/95 border shadow-xs transition-all ${
                selected
                  ? 'border-blue-500 text-blue-700 ring-2 ring-blue-400/30'
                  : 'border-slate-200 text-slate-700 hover:border-slate-300'
              }`}
            >
              {edgeData.label}
            </div>
          )}

          {/* Quick delete button visible when edge is selected or on group hover */}
          <button
            onClick={onDelete}
            className={`w-4 h-4 rounded-full bg-white border border-slate-300 text-slate-400 hover:text-red-600 hover:border-red-400 hover:bg-red-50 flex items-center justify-center transition-all shadow-xs ${
              selected ? 'opacity-100 scale-100' : 'opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100'
            }`}
            title="Delete connection"
          >
            <X className="w-2.5 h-2.5" />
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

export const CustomEdge = memo(CustomEdgeComponent);
