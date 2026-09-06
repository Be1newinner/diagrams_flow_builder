'use client';

import React, { useMemo } from 'react';
import { useViewport, Node, Edge } from '@xyflow/react';
import { colorForId } from './CollaboratorCursors';

interface Collaborator {
  name: string;
  x?: number;
  y?: number;
  selectedId?: string | null;
  selectedType?: 'node' | 'edge' | null;
}

interface CollaboratorSelectionsProps {
  collaborators: Record<string, Collaborator>;
  nodes: Node[];
  edges: Edge[];
}

const DEFAULT_WIDTH = 160;
const DEFAULT_HEIGHT = 80;

// Renders a colored outline (nodes) or a colored pin (edges, at their
// midpoint) plus a floating name badge for whatever every other
// collaborator currently has selected, so a clash is visible before it
// happens — same broadcast-then-overlay pattern as CollaboratorCursors,
// just keyed off `selectedId`/`selectedType` in presence data instead of
// cursor position. See onSelectionChange in page.tsx for the broadcast side
// and the lock effect there for what happens if you try to select the same
// thing.
export function CollaboratorSelections({ collaborators, nodes, edges }: CollaboratorSelectionsProps) {
  const { x: viewX, y: viewY, zoom } = useViewport();
  const nodesById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  const entries = Object.entries(collaborators).filter(([, c]) => !!c.selectedId);
  if (entries.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden">
      {entries.map(([id, c]) => {
        const color = colorForId(id);

        if (c.selectedType === 'node') {
          const node = nodesById.get(c.selectedId as string);
          if (!node) return null;
          const width = (node.width ?? node.measured?.width ?? DEFAULT_WIDTH) * zoom;
          const height = (node.height ?? node.measured?.height ?? DEFAULT_HEIGHT) * zoom;
          const screenX = node.position.x * zoom + viewX;
          const screenY = node.position.y * zoom + viewY;
          return (
            <div
              key={id}
              className="absolute"
              style={{ transform: `translate(${screenX}px, ${screenY}px)`, width, height }}
            >
              <div
                className="absolute inset-0 rounded-lg"
                style={{ border: `2.5px solid ${color}`, boxShadow: `0 0 0 3px ${color}33` }}
              />
              <span
                className="absolute -top-6 left-0 px-1.5 py-0.5 rounded-md text-[10px] font-semibold text-white whitespace-nowrap shadow-sm"
                style={{ backgroundColor: color }}
              >
                {c.name}
              </span>
            </div>
          );
        }

        // Edge selection: no single "position" of its own, so pin the badge
        // at the midpoint between its two connected nodes' centers.
        const edge = edges.find((e) => e.id === c.selectedId);
        if (!edge) return null;
        const sourceNode = nodesById.get(edge.source);
        const targetNode = nodesById.get(edge.target);
        if (!sourceNode || !targetNode) return null;
        const sourceCx = sourceNode.position.x + (sourceNode.width ?? sourceNode.measured?.width ?? DEFAULT_WIDTH) / 2;
        const sourceCy = sourceNode.position.y + (sourceNode.height ?? sourceNode.measured?.height ?? DEFAULT_HEIGHT) / 2;
        const targetCx = targetNode.position.x + (targetNode.width ?? targetNode.measured?.width ?? DEFAULT_WIDTH) / 2;
        const targetCy = targetNode.position.y + (targetNode.height ?? targetNode.measured?.height ?? DEFAULT_HEIGHT) / 2;
        const midX = (sourceCx + targetCx) / 2;
        const midY = (sourceCy + targetCy) / 2;
        const screenX = midX * zoom + viewX;
        const screenY = midY * zoom + viewY;
        return (
          <div
            key={id}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ transform: `translate(${screenX}px, ${screenY}px)` }}
          >
            <div
              className="w-3.5 h-3.5 rounded-full ring-2 ring-white shadow-sm"
              style={{ backgroundColor: color }}
            />
            <span
              className="absolute left-4 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded-md text-[10px] font-semibold text-white whitespace-nowrap shadow-sm"
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
