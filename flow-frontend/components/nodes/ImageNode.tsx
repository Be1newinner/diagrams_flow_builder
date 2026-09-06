'use client';

import React, { memo, useState } from 'react';
import { Handle, Position, NodeProps, NodeResizer } from '@xyflow/react';
import { ImageIcon, AlertTriangle } from 'lucide-react';
import { ImageNodeData } from '@/types/diagram';
import { getNodeStyleOverrides } from '@/lib/nodeStyleOverrides';

// Only allow schemes an <img src> can legitimately need. This is defense in
// depth rather than a response to a real exploit — a browser won't execute
// script via an <img> src regardless of scheme — but it stops e.g. a
// javascript: URI from ever being handed to the DOM at all, and keeps the
// accepted format list honest with what the Properties panel documents.
function isSafeImageSrc(src: string): boolean {
  const trimmed = src.trim();
  return /^https?:\/\//i.test(trimmed) || /^data:image\//i.test(trimmed);
}

function ImageNodeComponent({ data, selected }: NodeProps) {
  const nodeData = data as unknown as ImageNodeData;
  const fit = nodeData.fit || 'contain';
  const src = nodeData.src?.trim() || '';
  const safe = src.length > 0 && isSafeImageSrc(src);

  // Tracks which src actually failed, not just a bare boolean — so it
  // naturally "re-arms" the moment the user changes the URL (the comparison
  // just stops matching) without an effect to reset it on prop change.
  const [brokenSrc, setBrokenSrc] = useState<string | null>(null);
  const broken = safe && brokenSrc === src;
  const { wrapperStyle } = getNodeStyleOverrides(nodeData);

  return (
    <div
      className="relative w-full h-full min-w-[60px] min-h-[60px]"
      style={{ backgroundColor: nodeData.bgColor || 'transparent' }}
    >
      <NodeResizer
        minWidth={40}
        minHeight={40}
        isVisible={selected}
        keepAspectRatio
        lineClassName="border-blue-400"
        handleClassName="h-2.5 w-2.5 bg-white border-2 border-blue-500 rounded"
      />

      {/* Both a source and target handle per side — see SystemNode.tsx for
          why a single handle per side isn't enough for any-side edges. */}
      <Handle type="target" position={Position.Top} id="top" className="!w-2.5 !h-2.5 !bg-blue-500 !border-2 !border-white" />
      <Handle type="source" position={Position.Top} id="top" className="!w-2.5 !h-2.5 !bg-blue-500 !border-2 !border-white" />
      <Handle type="source" position={Position.Right} id="right" className="!w-2.5 !h-2.5 !bg-blue-500 !border-2 !border-white" />
      <Handle type="target" position={Position.Right} id="right" className="!w-2.5 !h-2.5 !bg-blue-500 !border-2 !border-white" />
      <Handle type="source" position={Position.Bottom} id="bottom" className="!w-2.5 !h-2.5 !bg-blue-500 !border-2 !border-white" />
      <Handle type="target" position={Position.Bottom} id="bottom" className="!w-2.5 !h-2.5 !bg-blue-500 !border-2 !border-white" />
      <Handle type="target" position={Position.Left} id="left" className="!w-2.5 !h-2.5 !bg-blue-500 !border-2 !border-white" />
      <Handle type="source" position={Position.Left} id="left" className="!w-2.5 !h-2.5 !bg-blue-500 !border-2 !border-white" />

      <div
        className={`w-full h-full rounded-md transition-all ${
          selected ? 'ring-2 ring-blue-400/60' : ''
        }`}
        style={wrapperStyle}
      >
        {!src ? (
          <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 rounded-md border-2 border-dashed border-slate-300 bg-slate-50 text-slate-400">
            <ImageIcon className="w-6 h-6" />
            <span className="text-[10px] font-medium text-center px-2">Set an image URL in Properties</span>
          </div>
        ) : !safe ? (
          <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 rounded-md border-2 border-dashed border-amber-300 bg-amber-50 text-amber-600">
            <AlertTriangle className="w-6 h-6" />
            <span className="text-[10px] font-medium text-center px-2">
              Unsupported URL — use http(s):// or a data:image/ URI
            </span>
          </div>
        ) : broken ? (
          <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 rounded-md border-2 border-dashed border-rose-300 bg-rose-50 text-rose-500">
            <AlertTriangle className="w-6 h-6" />
            <span className="text-[10px] font-medium text-center px-2">Image failed to load</span>
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- arbitrary user-supplied URLs (including data: URIs) aren't compatible with next/image's optimizer
          <img
            src={src}
            alt={nodeData.alt || ''}
            className="w-full h-full pointer-events-none select-none"
            style={{ objectFit: fit }}
            draggable={false}
            onError={() => setBrokenSrc(src)}
          />
        )}
      </div>
    </div>
  );
}

export const ImageNode = memo(ImageNodeComponent);
