import { Node, Edge } from '@xyflow/react';
export type { Node, Edge };

export type DiagramCategory = 'system-design' | 'flowchart' | 'er-diagram' | 'general';

export interface CanvasSettings {
  gridType: 'dots' | 'lines' | 'cross' | 'none';
  snapToGrid: boolean;
  defaultEdgeType: 'smoothstep' | 'bezier' | 'straight';
  gridGap?: number;
  gridSize?: number;
}

export interface ERColumn {
  id: string;
  name: string;
  type: string;
  isPrimary?: boolean;
  isForeign?: boolean;
  isNullable?: boolean;
}

// Shared appearance overrides available on every node type from the
// Properties panel's common "Style" section — layered on top of each type's
// own theme/color system via inline style, not a replacement for it.
export interface NodeStyleOverrides {
  borderRadius?: number;
  strokeWidth?: number;
  strokeColor?: string;
  fontSize?: number;
  fontColor?: string;
  fontWeight?: 'normal' | 'medium' | 'semibold' | 'bold';
  fontFamily?: string;
  opacity?: number; // 0–1
  textAlign?: 'left' | 'center' | 'right';
}

export interface SystemNodeData extends NodeStyleOverrides {
  title: string;
  subtitle?: string;
  icon: string;
  category?: string;
  status?: string;
  themeColor?: 'blue' | 'indigo' | 'emerald' | 'amber' | 'purple' | 'rose' | 'cyan' | 'slate';
  port?: string;
  bgColor?: string;
  [key: string]: unknown;
}

export interface FlowchartNodeData extends NodeStyleOverrides {
  label: string;
  description?: string;
  shape: 'start-end' | 'process' | 'decision' | 'input-output' | 'document' | 'delay';
  themeColor?: 'blue' | 'emerald' | 'amber' | 'purple' | 'rose' | 'slate' | 'cyan';
  bgColor?: string;
  [key: string]: unknown;
}

export interface ERTableNodeData extends NodeStyleOverrides {
  tableName: string;
  columns: ERColumn[];
  headerColor?: 'blue' | 'indigo' | 'emerald' | 'amber' | 'purple' | 'rose' | 'slate';
  bgColor?: string;
  [key: string]: unknown;
}

export interface GroupNodeData extends NodeStyleOverrides {
  label: string;
  stylePreset?: 'slate' | 'blue' | 'emerald' | 'amber' | 'purple' | 'rose';
  bgColor?: string;
  width?: number;
  height?: number;
  [key: string]: unknown;
}

export interface StickyNodeData extends NodeStyleOverrides {
  title?: string;
  text: string;
  color: 'yellow' | 'blue' | 'green' | 'pink' | 'purple';
  bgColor?: string;
  [key: string]: unknown;
}

export interface ImageNodeData extends NodeStyleOverrides {
  src: string;
  alt?: string;
  bgColor?: string;
  fit?: 'contain' | 'cover' | 'fill';
  [key: string]: unknown;
}

export interface CustomEdgeData {
  label?: string;
  animated?: boolean;
  edgeType?: 'smoothstep' | 'bezier' | 'straight';
  strokeColor?: string;
  strokeWidth?: number;
  strokeStyle?: 'solid' | 'dashed' | 'dotted';
  // Arrowhead placement. Drives the edge's top-level markerStart/markerEnd
  // (recomputed whenever this or strokeColor changes — see
  // computeEdgeMarkers in app/flow/[id]/page.tsx) rather than being read
  // directly by CustomEdge, since React Flow builds its <marker> SVG defs
  // from every edge's top-level marker fields, not from `data`.
  lineType?: 'none' | 'end' | 'start' | 'both';
  [key: string]: unknown;
}

export type DiagramAccessType = 'ADMIN' | 'EDITOR' | 'VIEWER';

export interface DiagramUserAccess {
  userId: string;
  accesstype: DiagramAccessType;
}

// A pin dropped anywhere on the canvas, independent of the node/edge graph
// — never selectable as a node, never touched by node/edge CRUD, and never
// counted in nodeCount/edgeCount. Only `authorId` may edit `text`/colors;
// anyone with view access can read it and see who wrote it.
export interface DiagramComment {
  id: string;
  x: number;
  y: number;
  text: string;
  authorId: string;
  authorName: string;
  createdAt: string;
  updatedAt: string;
  bgColor?: string;
  borderColor?: string;
}

export interface Diagram {
  id: string;
  title: string;
  description: string;
  category: DiagramCategory;
  tags: string[];
  nodes: Node[];
  edges: Edge[];
  comments?: DiagramComment[];
  settings: CanvasSettings;
  createdAt: string;
  updatedAt: string;
  userId?: string;      // Owner user ID (or 'system' for templates)
  isTemplate?: boolean; // true for built-in sample templates
  users?: DiagramUserAccess[]; // Access control list: exactly one ADMIN, multiple EDITOR/VIEWER
  isPublic?: boolean;   // true = every signed-in user can view (never edit) this diagram
}
