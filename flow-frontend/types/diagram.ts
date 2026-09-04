import { Node, Edge } from '@xyflow/react';
export type { Node, Edge };

export type DiagramCategory = 'system-design' | 'flowchart' | 'er-diagram' | 'general';

export interface CanvasSettings {
  gridType: 'dots' | 'lines' | 'cross' | 'none';
  snapToGrid: boolean;
  defaultEdgeType: 'smoothstep' | 'bezier' | 'straight';
  gridGap?: number;
}

export interface ERColumn {
  id: string;
  name: string;
  type: string;
  isPrimary?: boolean;
  isForeign?: boolean;
  isNullable?: boolean;
}

export interface SystemNodeData {
  title: string;
  subtitle?: string;
  icon: string;
  category?: string;
  status?: string;
  themeColor?: 'blue' | 'indigo' | 'emerald' | 'amber' | 'purple' | 'rose' | 'cyan' | 'slate';
  port?: string;
  [key: string]: unknown;
}

export interface FlowchartNodeData {
  label: string;
  description?: string;
  shape: 'start-end' | 'process' | 'decision' | 'input-output' | 'document' | 'delay';
  themeColor?: 'blue' | 'emerald' | 'amber' | 'purple' | 'rose' | 'slate' | 'cyan';
  [key: string]: unknown;
}

export interface ERTableNodeData {
  tableName: string;
  columns: ERColumn[];
  headerColor?: 'blue' | 'indigo' | 'emerald' | 'amber' | 'purple' | 'rose' | 'slate';
  [key: string]: unknown;
}

export interface GroupNodeData {
  label: string;
  stylePreset?: 'slate' | 'blue' | 'emerald' | 'amber' | 'purple' | 'rose';
  width?: number;
  height?: number;
  [key: string]: unknown;
}

export interface StickyNodeData {
  title?: string;
  text: string;
  color: 'yellow' | 'blue' | 'green' | 'pink' | 'purple';
  [key: string]: unknown;
}

export interface CustomEdgeData {
  label?: string;
  animated?: boolean;
  edgeType?: 'smoothstep' | 'bezier' | 'straight';
  strokeColor?: string;
  strokeWidth?: number;
  strokeStyle?: 'solid' | 'dashed' | 'dotted';
  [key: string]: unknown;
}

export type DiagramAccessType = 'ADMIN' | 'VIEWER';

export interface DiagramUserAccess {
  userId: string;
  accesstype: DiagramAccessType;
}

export interface Diagram {
  id: string;
  title: string;
  description: string;
  category: DiagramCategory;
  tags: string[];
  nodes: Node[];
  edges: Edge[];
  settings: CanvasSettings;
  createdAt: string;
  updatedAt: string;
  userId?: string;      // Owner user ID (or 'system' for templates)
  isTemplate?: boolean; // true for built-in sample templates
  users?: DiagramUserAccess[]; // Access control list: exactly one ADMIN, multiple VIEWERS
}
