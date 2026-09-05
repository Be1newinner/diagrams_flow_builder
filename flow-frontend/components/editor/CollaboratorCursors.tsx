'use client';

import React from 'react';
import { useViewport } from '@xyflow/react';
import { MousePointer2 } from 'lucide-react';

interface Collaborator {
  name: string;
  x?: number;
  y?: number;
}

interface CollaboratorCursorsProps {
  collaborators: Record<string, Collaborator>;
}

// Deterministic color per id so the same person's cursor and header avatar
// always match, without needing to coordinate a palette assignment anywhere.
const CURSOR_COLORS = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4'];
function colorForId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return CURSOR_COLORS[hash % CURSOR_COLORS.length];
}

// Renders everyone else's last-known cursor position as an absolutely
// positioned overlay on top of the canvas. Positions are broadcast in flow
// coordinates (see handleCanvasMouseMove in page.tsx) and converted back to
// screen coordinates here via the live viewport transform, so a
// collaborator's cursor stays correctly placed as you pan/zoom your own
// view independently of theirs.
export function CollaboratorCursors({ collaborators }: CollaboratorCursorsProps) {
  const { x: viewX, y: viewY, zoom } = useViewport();

  const entries = Object.entries(collaborators).filter(([, c]) => c.x !== undefined && c.y !== undefined);
  if (entries.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-40 overflow-hidden">
      {entries.map(([id, c]) => {
        const screenX = (c.x as number) * zoom + viewX;
        const screenY = (c.y as number) * zoom + viewY;
        const color = colorForId(id);
        return (
          <div
            key={id}
            className="absolute transition-transform duration-100 ease-linear"
            style={{ transform: `translate(${screenX}px, ${screenY}px)` }}
          >
            <MousePointer2 className="w-4 h-4 -translate-x-0.5 -translate-y-0.5" style={{ color, fill: color }} />
            <span
              className="ml-3 -mt-1 inline-block px-1.5 py-0.5 rounded-md text-[10px] font-semibold text-white whitespace-nowrap shadow-sm"
              style={{ backgroundColor: color }}
            >
              {c.name}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export { colorForId };
