'use client';

import React from 'react';
import { useViewport } from '@xyflow/react';

interface AlignmentGuidesProps {
  vertical: number[];
  horizontal: number[];
}

// Renders the snap-guide lines computed in page.tsx's onNodeDrag handler.
// Guide positions are in flow coordinates (so they're correct regardless of
// which node pair triggered them); converted to screen coordinates here via
// the live viewport transform, same approach as CollaboratorCursors.
export function AlignmentGuides({ vertical, horizontal }: AlignmentGuidesProps) {
  const { x: viewX, y: viewY, zoom } = useViewport();

  if (vertical.length === 0 && horizontal.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden">
      {vertical.map((flowX, i) => (
        <div
          key={`v-${i}`}
          className="absolute top-0 bottom-0 w-px bg-rose-400"
          style={{ left: flowX * zoom + viewX }}
        />
      ))}
      {horizontal.map((flowY, i) => (
        <div
          key={`h-${i}`}
          className="absolute left-0 right-0 h-px bg-rose-400"
          style={{ top: flowY * zoom + viewY }}
        />
      ))}
    </div>
  );
}
