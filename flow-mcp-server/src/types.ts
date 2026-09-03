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

export interface NodePosition {
  x: number;
  y: number;
}

export interface DiagramNode {
  id: string;
  type: 'systemNode' | 'flowchartNode' | 'erTableNode' | 'groupNode' | 'stickyNode' | string;
  position: NodePosition;
  data: Record<string, any>;
}

export interface DiagramEdge {
  id: string;
  source: string;
  target: string;
  type?: string;
  sourceHandle?: string;
  targetHandle?: string;
  data?: {
    label?: string;
    animated?: boolean;
    edgeType?: 'smoothstep' | 'bezier' | 'straight';
    strokeColor?: string;
    strokeWidth?: number;
    strokeStyle?: 'solid' | 'dashed' | 'dotted';
    [key: string]: any;
  };
}

export interface Diagram {
  id: string;
  title: string;
  description: string;
  category: DiagramCategory;
  tags: string[];
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  settings: CanvasSettings;
  createdAt: string;
  updatedAt: string;
}
