export type DiagramCategory = 'system-design' | 'flowchart' | 'er-diagram' | 'general';

export interface CanvasSettings {
  gridType: 'dots' | 'lines' | 'cross' | 'none';
  snapToGrid: boolean;
  defaultEdgeType: 'smoothstep' | 'bezier' | 'straight';
  gridGap?: number;
  gridSize?: number;
}

// Shared appearance overrides available on every node type from the
// Properties panel's "Style" section, layered on top of each type's own
// theme/color system.
export interface NodeStyleOverrides {
  borderRadius?: number;
  strokeWidth?: number;
  strokeColor?: string;
  fontSize?: number;
  fontColor?: string;
  fontWeight?: 'normal' | 'medium' | 'semibold' | 'bold';
  fontFamily?: string;
  opacity?: number;
  textAlign?: 'left' | 'center' | 'right';
  bgColor?: string;
}

export interface EdgeMarker {
  type: 'arrow' | 'arrowclosed';
  color?: string;
  width?: number;
  height?: number;
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
  type: 'systemNode' | 'flowchartNode' | 'erTableNode' | 'groupNode' | 'stickyNode' | 'imageNode' | string;
  position: NodePosition;
  data: Record<string, any>;
  width?: number;
  height?: number;
}

export interface DiagramEdge {
  id: string;
  source: string;
  target: string;
  type?: string;
  sourceHandle?: string;
  targetHandle?: string;
  markerStart?: EdgeMarker;
  markerEnd?: EdgeMarker;
  data?: {
    label?: string;
    animated?: boolean;
    edgeType?: 'smoothstep' | 'bezier' | 'straight';
    strokeColor?: string;
    strokeWidth?: number;
    strokeStyle?: 'solid' | 'dashed' | 'dotted';
    lineType?: 'none' | 'end' | 'start' | 'both';
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
