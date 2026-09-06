'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Node, Edge } from '@xyflow/react';
import {
  Sliders,
  Trash2,
  Copy,
  Plus,
  Table,
  Key,
  Hash,
  Sparkles,
  Info,
  Layers,
  Palette,
  Eye,
  Type,
  Maximize,
  GitBranch,
  Box,
  ChevronRight,
  ChevronDown,
  ChevronsDownUp,
  ChevronsUpDown,
  Ungroup,
  Unlink,
  History,
  Move,
  ArrowUp,
  ArrowRight,
  ArrowDown,
  ArrowLeft,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Droplet,
  MessageCircle,
  CheckCircle2,
  Send,
  Bot,
  RotateCcw,
} from 'lucide-react';
import {
  SystemNodeData,
  FlowchartNodeData,
  ERTableNodeData,
  GroupNodeData,
  StickyNodeData,
  CustomEdgeData,
  ERColumn,
  DiagramComment,
  CommentReply,
} from '@/types/diagram';
import { formatRelativeTime } from '@/lib/timeFormat';

interface PropertiesPanelProps {
  selectedNode: Node | null;
  selectedEdge: Edge | null;
  nodes: Node[];
  edges: Edge[];
  onUpdateNodeData: (id: string, newData: Record<string, any>) => void;
  onUpdateNodeGeometry: (id: string, geometry: { width?: number; height?: number; x?: number; y?: number }) => void;
  onUpdateEdgeData: (id: string, newData: Record<string, any>) => void;
  onMoveEdgeEndpoint: (id: string, end: 'source' | 'target', handleId: 'top' | 'bottom' | 'left' | 'right') => void;
  onDuplicateNode: (id: string) => void;
  onDeleteNode: (id: string) => void;
  onDeleteEdge: (id: string) => void;
  onSelectNode: (id: string) => void;
  onSelectEdge: (id: string) => void;
  onEjectGroupNodes: (groupId: string) => void;
  onDisconnectNodeEdges: (nodeId: string) => void;
  selectedNodes: Node[];
  selectedEdges: Edge[];
  onBulkSetBgColor: (ids: string[], hex: string | undefined) => void;
  onBulkUpdateNodeData: (ids: string[], patch: Record<string, any>) => void;
  onBulkUpdateEdgeData: (ids: string[], patch: Record<string, any>) => void;
  onBulkMoveEdgeEndpoint: (ids: string[], end: 'source' | 'target', handleId: 'top' | 'bottom' | 'left' | 'right') => void;
  onBulkDeleteEdges: (ids: string[]) => void;
  onBulkDelete: (ids: string[]) => void;
  onBulkDisconnectEdges: (ids: string[]) => void;
  nodeCount: number;
  edgeCount: number;
  readOnly?: boolean;
  diagramId?: string;
  selectedComment: DiagramComment | null;
  currentUserId?: string;
  isDiagramAdmin?: boolean;
  onUpdateComment: (id: string, patch: Partial<Pick<DiagramComment, 'text' | 'bgColor' | 'borderColor'>>) => void;
  onDeleteComment: (id: string) => void;
  onToggleCommentResolved: (id: string) => void;
  canComment?: boolean;
  onAddCommentReply: (commentId: string, text: string) => void;
  onDeleteCommentReply: (commentId: string, replyId: string) => void;
  // Called after the Activity tab restores an earlier version, so the
  // caller can refetch the diagram and swap it into the live canvas state
  // immediately instead of waiting for the Ably round trip.
  onRestored?: () => void;
}

// Best-effort human label across every node type's differently-shaped data.
function nodeLabel(node: Node): string {
  const d = (node.data || {}) as Record<string, unknown>;
  const candidates = [d.title, d.label, d.tableName, d.noteTitle, d.groupLabel];
  return (candidates.find((c) => typeof c === 'string' && c.length > 0) as string | undefined) || node.id;
}

function nodeTypeLabel(node: Node): string {
  switch (node.type) {
    case 'systemNode':
      return 'System';
    case 'erTableNode':
      return 'ER Table';
    case 'flowchartNode':
      return 'Flowchart';
    case 'stickyNode':
      return 'Note';
    case 'groupNode':
      return 'Group';
    default:
      return node.type || 'Node';
  }
}

// A constrained set of common column types for the ER editor, to catch
// typos ("VARHCAR", "interger") instead of accepting any free text. "Custom…"
// escapes back to a plain text field for anything not on this list (sized
// varchars aside from the default, composite types, enums, etc.) — a column
// whose current value isn't one of these renders as that text field
// automatically, no extra state needed to track "which mode is this row in."
const COLUMN_TYPE_OPTIONS = [
  'UUID',
  'VARCHAR(255)',
  'TEXT',
  'INTEGER',
  'BIGINT',
  'SMALLINT',
  'BOOLEAN',
  'TIMESTAMPTZ',
  'DATE',
  'DECIMAL(10,2)',
  'FLOAT',
  'JSONB',
];
const CUSTOM_TYPE_SENTINEL = '__custom__';

const COLOR_OPTIONS = [
  { id: 'blue', label: 'Blue', hex: '#3b82f6' },
  { id: 'indigo', label: 'Indigo', hex: '#6366f1' },
  { id: 'emerald', label: 'Emerald', hex: '#10b981' },
  { id: 'amber', label: 'Amber', hex: '#f59e0b' },
  { id: 'rose', label: 'Rose', hex: '#f43f5e' },
  { id: 'purple', label: 'Purple', hex: '#a855f7' },
  { id: 'cyan', label: 'Cyan', hex: '#06b6d4' },
  { id: 'slate', label: 'Slate', hex: '#64748b' },
];

const ICONS_LIST = [
  { id: 'server', label: 'Server' },
  { id: 'database', label: 'Database' },
  { id: 'cloud', label: 'Cloud' },
  { id: 'globe', label: 'Globe' },
  { id: 'cpu', label: 'CPU' },
  { id: 'shield', label: 'Shield' },
  { id: 'layers', label: 'Cache / Layers' },
  { id: 'radio', label: 'Queue / Radio' },
  { id: 'smartphone', label: 'Mobile' },
  { id: 'terminal', label: 'Terminal' },
  { id: 'arrow-left-right', label: 'Gateway' },
  { id: 'lock', label: 'Auth / Lock' },
  { id: 'network', label: 'Network' },
  { id: 'zap', label: 'Worker / Zap' },
  { id: 'cart', label: 'Cart' },
  { id: 'dollar', label: 'Payment' },
];

export function PropertiesPanel({
  selectedNode,
  selectedEdge,
  nodes,
  edges,
  onUpdateNodeData,
  onUpdateNodeGeometry,
  onUpdateEdgeData,
  onMoveEdgeEndpoint,
  onDuplicateNode,
  onDeleteNode,
  onDeleteEdge,
  onSelectNode,
  onSelectEdge,
  onEjectGroupNodes,
  onDisconnectNodeEdges,
  selectedNodes,
  selectedEdges,
  onBulkSetBgColor,
  onBulkUpdateNodeData,
  onBulkUpdateEdgeData,
  onBulkMoveEdgeEndpoint,
  onBulkDeleteEdges,
  onBulkDelete,
  onBulkDisconnectEdges,
  nodeCount,
  edgeCount,
  readOnly = false,
  diagramId,
  selectedComment,
  currentUserId,
  isDiagramAdmin,
  onUpdateComment,
  onDeleteComment,
  onToggleCommentResolved,
  canComment,
  onAddCommentReply,
  onDeleteCommentReply,
  onRestored,
}: PropertiesPanelProps) {
  const [activeTab, setActiveTab] = useState<'properties' | 'layers' | 'activity'>('properties');

  const tabBar = (
    <div className="flex items-center gap-1 border-b border-slate-100 px-2 pt-2 shrink-0 bg-white">
      <button
        onClick={() => setActiveTab('properties')}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold rounded-t-lg border-b-2 -mb-px transition-colors cursor-pointer ${
          activeTab === 'properties'
            ? 'border-blue-600 text-blue-700'
            : 'border-transparent text-slate-500 hover:text-slate-700'
        }`}
      >
        <Sliders className="w-3.5 h-3.5" />
        Properties
      </button>
      <button
        onClick={() => setActiveTab('layers')}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold rounded-t-lg border-b-2 -mb-px transition-colors cursor-pointer ${
          activeTab === 'layers'
            ? 'border-blue-600 text-blue-700'
            : 'border-transparent text-slate-500 hover:text-slate-700'
        }`}
      >
        <Layers className="w-3.5 h-3.5" />
        Layers
        <span className="px-1.5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-bold">
          {nodeCount + edgeCount}
        </span>
      </button>
      {/* ADMIN-only, same gating as eject/disconnect/delete actions — a
          VIEWER can see the diagram but not who's been changing it. */}
      {!readOnly && diagramId && (
        <button
          onClick={() => setActiveTab('activity')}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold rounded-t-lg border-b-2 -mb-px transition-colors cursor-pointer ${
            activeTab === 'activity'
              ? 'border-blue-600 text-blue-700'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          Activity
        </button>
      )}
    </div>
  );

  if (activeTab === 'layers') {
    return (
      <aside className="w-full h-full bg-white border-l border-slate-200 flex flex-col select-none z-20 shadow-2xs">
        {tabBar}
        <LayersList
          nodes={nodes}
          edges={edges}
          selectedNode={selectedNode}
          selectedEdge={selectedEdge}
          onSelectNode={onSelectNode}
          onSelectEdge={onSelectEdge}
          onDeleteNode={onDeleteNode}
          onDeleteEdge={onDeleteEdge}
          readOnly={readOnly}
        />
      </aside>
    );
  }

  if (activeTab === 'activity' && diagramId) {
    return (
      <aside className="w-full h-full bg-white border-l border-slate-200 flex flex-col select-none z-20 shadow-2xs">
        {tabBar}
        <ActivityLog diagramId={diagramId} onRestored={onRestored} />
      </aside>
    );
  }

  // Case 0: Multi-Selection — bulk actions instead of a single node's form,
  // since editing N nodes' individual fields at once doesn't make sense,
  // but a shared background color, a bulk delete, and bulk disconnect do.
  if (selectedNodes.length > 1) {
    const ids = selectedNodes.map((n) => n.id);
    return (
      <aside className="w-full h-full bg-white border-l border-slate-200 flex flex-col select-none z-20 shadow-2xs">
        {tabBar}
        <div className="p-3.5 border-b border-slate-100 flex items-center gap-2">
          <Sliders className="w-4 h-4 text-blue-600" />
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            {selectedNodes.length} Nodes Selected
          </h3>
        </div>
        <fieldset disabled={readOnly} className={`flex-1 overflow-y-auto p-4 space-y-4 text-xs ${readOnly ? 'opacity-80' : ''}`}>
          <BackgroundColorControl
            label={`Background Color (all ${selectedNodes.length})`}
            value={undefined}
            onChange={(hex) => onBulkSetBgColor(ids, hex)}
          />

          {/* Every appearance control applies to all selected nodes at
              once — only per-node content (title, subtitle, status, etc.)
              doesn't make sense in bulk and stays out of this view. */}
          <NodeStyleSection data={{}} onChange={(patch) => onBulkUpdateNodeData(ids, patch)} />

          <div className="pt-3 border-t border-slate-100 space-y-2">
            <button
              onClick={() => onBulkDisconnectEdges(ids)}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors cursor-pointer"
            >
              <Unlink className="w-3.5 h-3.5" />
              Disconnect All Edges
            </button>
            <button
              onClick={() => onBulkDelete(ids)}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete {selectedNodes.length} Nodes
            </button>
          </div>

          <p className="text-[10px] text-slate-400 leading-relaxed pt-2 border-t border-slate-100">
            Use the alignment toolbar above the canvas to align, distribute, or match the size of these
            nodes.
          </p>
        </fieldset>
      </aside>
    );
  }

  // Case 1: Node Selected
  if (selectedNode) {
    const nodeType = selectedNode.type;
    const data = selectedNode.data as Record<string, any>;

    return (
      <aside className="w-full h-full bg-white border-l border-slate-200 flex flex-col select-none z-20 shadow-2xs">
        {tabBar}
        {/* Header */}
        <div className="p-3.5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-blue-600" />
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              {nodeType === 'systemNode'
                ? 'System Component'
                : nodeType === 'erTableNode'
                ? 'ER Table Schema'
                : nodeType === 'flowchartNode'
                ? 'Flowchart Step'
                : nodeType === 'stickyNode'
                ? 'Sticky Note'
                : nodeType === 'imageNode'
                ? 'Image / Actor'
                : nodeType === 'groupNode'
                ? 'Group / Container'
                : 'Node Inspector'}
            </h3>
          </div>

          {readOnly ? (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
              Read-Only
            </span>
          ) : (
            <div className="flex items-center gap-1">
              <button
                onClick={() => onDisconnectNodeEdges(selectedNode.id)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                title="Disconnect all edges from this node (node itself is kept)"
              >
                <Unlink className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onDuplicateNode(selectedNode.id)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                title="Duplicate node"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onDeleteNode(selectedNode.id)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                title="Delete node"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Content Body */}
        <fieldset disabled={readOnly} className={`flex-1 overflow-y-auto p-4 space-y-4 text-xs ${readOnly ? 'opacity-80' : ''}`}>
          {/* System Node Editor */}
          {nodeType === 'systemNode' && (
            <>
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Title</label>
                <input
                  type="text"
                  value={data.title || ''}
                  onChange={(e) => onUpdateNodeData(selectedNode.id, { title: e.target.value })}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Subtitle / Tech</label>
                <input
                  type="text"
                  value={data.subtitle || ''}
                  onChange={(e) => onUpdateNodeData(selectedNode.id, { subtitle: e.target.value })}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Category</label>
                  <input
                    type="text"
                    value={data.category || ''}
                    onChange={(e) => onUpdateNodeData(selectedNode.id, { category: e.target.value })}
                    placeholder="Compute / DB"
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Status Badge</label>
                  <input
                    type="text"
                    value={data.status || ''}
                    onChange={(e) => onUpdateNodeData(selectedNode.id, { status: e.target.value })}
                    placeholder="Active / Port 80"
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Icon Selector */}
              <div>
                <label className="font-semibold text-slate-700 block mb-1.5">Icon</label>
                <select
                  value={data.icon || 'server'}
                  onChange={(e) => onUpdateNodeData(selectedNode.id, { icon: e.target.value })}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500 capitalize"
                >
                  {ICONS_LIST.map((ic) => (
                    <option key={ic.id} value={ic.id}>
                      {ic.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Theme Color */}
              <div>
                <label className="font-semibold text-slate-700 block mb-1.5">Theme Color</label>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {COLOR_OPTIONS.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => onUpdateNodeData(selectedNode.id, { themeColor: c.id })}
                      className={`w-6 h-6 rounded-full border-2 transition-transform ${
                        data.themeColor === c.id ? 'scale-125 ring-2 ring-blue-400' : 'hover:scale-110'
                      }`}
                      style={{ backgroundColor: c.hex, borderColor: '#ffffff' }}
                      title={c.label}
                    />
                  ))}
                </div>
              </div>

              <BackgroundColorControl
                value={data.bgColor}
                onChange={(hex) => onUpdateNodeData(selectedNode.id, { bgColor: hex })}
              />
            </>
          )}

          {/* ER Table Node Editor */}
          {nodeType === 'erTableNode' && (
            <>
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Table Name</label>
                <input
                  type="text"
                  value={data.tableName || ''}
                  onChange={(e) => onUpdateNodeData(selectedNode.id, { tableName: e.target.value })}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-mono text-slate-800 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Header Color */}
              <div>
                <label className="font-semibold text-slate-700 block mb-1.5">Header Theme</label>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {COLOR_OPTIONS.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => onUpdateNodeData(selectedNode.id, { headerColor: c.id })}
                      className={`w-6 h-6 rounded-full border-2 transition-transform ${
                        data.headerColor === c.id ? 'scale-125 ring-2 ring-blue-400' : 'hover:scale-110'
                      }`}
                      style={{ backgroundColor: c.hex, borderColor: '#ffffff' }}
                      title={c.label}
                    />
                  ))}
                </div>
              </div>

              <BackgroundColorControl
                value={data.bgColor}
                onChange={(hex) => onUpdateNodeData(selectedNode.id, { bgColor: hex })}
              />

              {/* Columns List Manager */}
              <div className="pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-slate-700">Columns Schema</span>
                  <button
                    onClick={() => {
                      const cols: ERColumn[] = data.columns || [];
                      const newCol: ERColumn = {
                        id: `col-${Date.now()}`,
                        name: `new_col_${cols.length + 1}`,
                        type: 'VARCHAR(255)',
                        isPrimary: false,
                        isForeign: false,
                      };
                      onUpdateNodeData(selectedNode.id, { columns: [...cols, newCol] });
                    }}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add Column</span>
                  </button>
                </div>

                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {(data.columns || []).map((col: ERColumn, idx: number) => (
                    <div
                      key={col.id || idx}
                      className="p-2 rounded-lg border border-slate-200 bg-slate-50/60 space-y-1.5"
                    >
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={col.name}
                          onChange={(e) => {
                            const cols = [...(data.columns || [])];
                            cols[idx] = { ...cols[idx], name: e.target.value };
                            onUpdateNodeData(selectedNode.id, { columns: cols });
                          }}
                          placeholder="column_name"
                          className="flex-1 px-2 py-1 bg-white border border-slate-200 rounded font-mono text-xs text-slate-800"
                        />
                        <button
                          onClick={() => {
                            const cols = (data.columns || []).filter((_: any, i: number) => i !== idx);
                            onUpdateNodeData(selectedNode.id, { columns: cols });
                          }}
                          className="p-1 text-slate-400 hover:text-red-600 rounded"
                          title="Delete column"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="flex items-center gap-2 text-[10px]">
                        {COLUMN_TYPE_OPTIONS.includes(col.type) ? (
                          <select
                            value={col.type}
                            onChange={(e) => {
                              const cols = [...(data.columns || [])];
                              const nextType = e.target.value === CUSTOM_TYPE_SENTINEL ? '' : e.target.value;
                              cols[idx] = { ...cols[idx], type: nextType };
                              onUpdateNodeData(selectedNode.id, { columns: cols });
                            }}
                            className="w-24 px-1.5 py-0.5 bg-white border border-slate-200 rounded font-mono text-slate-700"
                          >
                            {COLUMN_TYPE_OPTIONS.map((t) => (
                              <option key={t} value={t}>
                                {t}
                              </option>
                            ))}
                            <option value={CUSTOM_TYPE_SENTINEL}>Custom…</option>
                          </select>
                        ) : (
                          <div className="flex items-center gap-0.5">
                            <input
                              type="text"
                              value={col.type}
                              onChange={(e) => {
                                const cols = [...(data.columns || [])];
                                cols[idx] = { ...cols[idx], type: e.target.value };
                                onUpdateNodeData(selectedNode.id, { columns: cols });
                              }}
                              placeholder="TYPE"
                              autoFocus
                              className="w-20 px-1.5 py-0.5 bg-white border border-blue-300 rounded font-mono text-slate-700"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const cols = [...(data.columns || [])];
                                cols[idx] = { ...cols[idx], type: COLUMN_TYPE_OPTIONS[0] };
                                onUpdateNodeData(selectedNode.id, { columns: cols });
                              }}
                              title="Back to type list"
                              className="p-0.5 text-slate-400 hover:text-slate-700 rounded"
                            >
                              <ChevronDown className="w-3 h-3" />
                            </button>
                          </div>
                        )}

                        {/* PK Button */}
                        <button
                          type="button"
                          onClick={() => {
                            const cols = [...(data.columns || [])];
                            cols[idx] = { ...cols[idx], isPrimary: !cols[idx].isPrimary };
                            onUpdateNodeData(selectedNode.id, { columns: cols });
                          }}
                          className={`px-1.5 py-0.5 rounded font-bold transition-colors ${
                            col.isPrimary
                              ? 'bg-amber-100 text-amber-800 border border-amber-300'
                              : 'bg-slate-200 text-slate-500'
                          }`}
                        >
                          PK
                        </button>

                        {/* FK Button */}
                        <button
                          type="button"
                          onClick={() => {
                            const cols = [...(data.columns || [])];
                            cols[idx] = { ...cols[idx], isForeign: !cols[idx].isForeign };
                            onUpdateNodeData(selectedNode.id, { columns: cols });
                          }}
                          className={`px-1.5 py-0.5 rounded font-bold transition-colors ${
                            col.isForeign
                              ? 'bg-indigo-100 text-indigo-800 border border-indigo-300'
                              : 'bg-slate-200 text-slate-500'
                          }`}
                        >
                          FK
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Flowchart Node Editor */}
          {nodeType === 'flowchartNode' && (
            <>
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Step Label</label>
                <input
                  type="text"
                  value={data.label || ''}
                  onChange={(e) => onUpdateNodeData(selectedNode.id, { label: e.target.value })}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Description</label>
                <textarea
                  value={data.description || ''}
                  onChange={(e) => onUpdateNodeData(selectedNode.id, { description: e.target.value })}
                  rows={2}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Shape</label>
                <select
                  value={data.shape || 'process'}
                  onChange={(e) => onUpdateNodeData(selectedNode.id, { shape: e.target.value })}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500"
                >
                  <option value="process">Process (Rectangle)</option>
                  <option value="decision">Decision (Diamond)</option>
                  <option value="start-end">Start / End (Pill)</option>
                  <option value="input-output">Input / Output (Parallelogram)</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1.5">Color Accent</label>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {COLOR_OPTIONS.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => onUpdateNodeData(selectedNode.id, { themeColor: c.id })}
                      className={`w-6 h-6 rounded-full border-2 transition-transform ${
                        data.themeColor === c.id ? 'scale-125 ring-2 ring-blue-400' : 'hover:scale-110'
                      }`}
                      style={{ backgroundColor: c.hex, borderColor: '#ffffff' }}
                      title={c.label}
                    />
                  ))}
                </div>
              </div>

              <BackgroundColorControl
                value={data.bgColor}
                onChange={(hex) => onUpdateNodeData(selectedNode.id, { bgColor: hex })}
              />
            </>
          )}

          {/* Sticky Node Editor */}
          {nodeType === 'stickyNode' && (
            <>
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Note Title</label>
                <input
                  type="text"
                  value={data.title || ''}
                  onChange={(e) => onUpdateNodeData(selectedNode.id, { title: e.target.value })}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Notes / Description</label>
                <textarea
                  value={data.text || ''}
                  onChange={(e) => onUpdateNodeData(selectedNode.id, { text: e.target.value })}
                  rows={5}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500 text-xs"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1.5">Color Tone</label>
                <div className="flex items-center gap-2">
                  {[
                    { id: 'yellow', hex: '#fef08a' },
                    { id: 'blue', hex: '#bae6fd' },
                    { id: 'green', hex: '#bbf7d0' },
                    { id: 'pink', hex: '#fbcfe8' },
                    { id: 'purple', hex: '#e9d5ff' },
                  ].map((c) => (
                    <button
                      key={c.id}
                      onClick={() => onUpdateNodeData(selectedNode.id, { color: c.id })}
                      className={`w-6 h-6 rounded-md border transition-transform ${
                        data.color === c.id ? 'scale-125 ring-2 ring-blue-400' : 'hover:scale-110'
                      }`}
                      style={{ backgroundColor: c.hex }}
                    />
                  ))}
                </div>
              </div>

              <BackgroundColorControl
                value={data.bgColor}
                onChange={(hex) => onUpdateNodeData(selectedNode.id, { bgColor: hex })}
                label="Custom Background (overrides tone above)"
              />
            </>
          )}

          {/* Group Node Editor */}
          {nodeType === 'groupNode' && (
            <>
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Boundary Label</label>
                <input
                  type="text"
                  value={data.label || ''}
                  onChange={(e) => onUpdateNodeData(selectedNode.id, { label: e.target.value })}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1.5">Style Preset</label>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {COLOR_OPTIONS.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => onUpdateNodeData(selectedNode.id, { stylePreset: c.id })}
                      className={`w-6 h-6 rounded-full border-2 transition-transform ${
                        data.stylePreset === c.id ? 'scale-125 ring-2 ring-blue-400' : 'hover:scale-110'
                      }`}
                      style={{ backgroundColor: c.hex, borderColor: '#ffffff' }}
                      title={c.label}
                    />
                  ))}
                </div>
              </div>

              <BackgroundColorControl
                value={data.bgColor}
                onChange={(hex) => onUpdateNodeData(selectedNode.id, { bgColor: hex })}
                label="Custom Background (overrides preset above)"
              />

              <div className="pt-3 border-t border-slate-100">
                <button
                  onClick={() => onEjectGroupNodes(selectedNode.id)}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors cursor-pointer"
                  title="Move every node currently inside this box out to a free row below it"
                >
                  <Ungroup className="w-3.5 h-3.5" />
                  Eject All Nodes
                </button>
                <p className="text-[10px] text-slate-400 mt-1.5 leading-relaxed">
                  Pulls every node currently sitting inside this box out to a free row below it, so you
                  can drag each one wherever it needs to go. Their connections to other nodes are never
                  touched — only their position changes.
                </p>
              </div>
            </>
          )}

          {/* Image / Actor Node Editor */}
          {nodeType === 'imageNode' && (
            <>
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Image URL</label>
                <input
                  type="text"
                  value={data.src || ''}
                  onChange={(e) => onUpdateNodeData(selectedNode.id, { src: e.target.value })}
                  placeholder="https://... or data:image/svg+xml,..."
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-mono text-[11px] text-slate-800 focus:outline-none focus:border-blue-500"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Any PNG, JPG, or SVG URL — including a pasted data: URI. Drag the corner handles on
                  the canvas to resize once it&rsquo;s set.
                </p>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Alt Text</label>
                <input
                  type="text"
                  value={data.alt || ''}
                  onChange={(e) => onUpdateNodeData(selectedNode.id, { alt: e.target.value })}
                  placeholder="Describe the image"
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Fit</label>
                <select
                  value={data.fit || 'contain'}
                  onChange={(e) => onUpdateNodeData(selectedNode.id, { fit: e.target.value })}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500"
                >
                  <option value="contain">Contain (keep aspect ratio, letterbox)</option>
                  <option value="cover">Cover (fill box, may crop)</option>
                  <option value="fill">Fill (stretch to box)</option>
                </select>
              </div>

              <BackgroundColorControl
                value={data.bgColor}
                onChange={(hex) => onUpdateNodeData(selectedNode.id, { bgColor: hex })}
                label="Backdrop Color (useful behind transparent PNGs)"
              />
            </>
          )}

          {/* Layout & Style — common to every node type, appended after each
              type's own fields rather than duplicated into every branch
              above. Width/height/position live on the Node object itself
              (same fields NodeResizer/canvas dragging already write to), so
              they go through onUpdateNodeGeometry instead of onUpdateNodeData. */}
          <div className="pt-3 border-t border-slate-100">
            <div className="flex items-center gap-1.5 mb-2">
              <Maximize className="w-3.5 h-3.5 text-blue-600" />
              <label className="font-semibold text-slate-700">Layout</label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-medium text-slate-500 block mb-1">Width</label>
                <input
                  type="number"
                  value={Math.round(selectedNode.width ?? selectedNode.measured?.width ?? 0)}
                  onChange={(e) =>
                    onUpdateNodeGeometry(selectedNode.id, { width: Number(e.target.value) })
                  }
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-slate-500 block mb-1">Height</label>
                <input
                  type="number"
                  value={Math.round(selectedNode.height ?? selectedNode.measured?.height ?? 0)}
                  onChange={(e) =>
                    onUpdateNodeGeometry(selectedNode.id, { height: Number(e.target.value) })
                  }
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-slate-500 block mb-1">X Position</label>
                <input
                  type="number"
                  value={Math.round(selectedNode.position.x)}
                  onChange={(e) => onUpdateNodeGeometry(selectedNode.id, { x: Number(e.target.value) })}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-slate-500 block mb-1">Y Position</label>
                <input
                  type="number"
                  value={Math.round(selectedNode.position.y)}
                  onChange={(e) => onUpdateNodeGeometry(selectedNode.id, { y: Number(e.target.value) })}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          <NodeStyleSection data={data} onChange={(patch) => onUpdateNodeData(selectedNode.id, patch)} />
        </fieldset>
      </aside>
    );
  }

  // Case 1b: Multi-Edge Selection — every appearance control (curve,
  // animation, line pattern/width/color, arrowheads, move) applies to all
  // selected edges at once; Connection Label is per-edge content and
  // deliberately excluded here, same reasoning as node title/subtitle in
  // the multi-node case above.
  if (selectedEdges.length > 1) {
    const edgeIds = selectedEdges.map((e) => e.id);
    return (
      <aside className="w-full h-full bg-white border-l border-slate-200 flex flex-col select-none z-20 shadow-2xs">
        {tabBar}
        <div className="p-3.5 border-b border-slate-100 flex items-center gap-2">
          <Sliders className="w-4 h-4 text-blue-600" />
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            {selectedEdges.length} Connections Selected
          </h3>
        </div>
        <fieldset disabled={readOnly} className={`flex-1 overflow-y-auto p-4 space-y-4 text-xs ${readOnly ? 'opacity-80' : ''}`}>
          <EdgeStyleSection data={{}} onChange={(patch) => onBulkUpdateEdgeData(edgeIds, patch)} />
          <MoveEdgeSection
            idPrefix="bulk-edges"
            onMove={(end, side) => onBulkMoveEdgeEndpoint(edgeIds, end, side)}
          />

          <div className="pt-3 border-t border-slate-100">
            <button
              onClick={() => onBulkDeleteEdges(edgeIds)}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete {selectedEdges.length} Connections
            </button>
          </div>
        </fieldset>
      </aside>
    );
  }

  // Case 2: Edge Selected
  if (selectedEdge) {
    const edgeData = (selectedEdge.data || {}) as CustomEdgeData;
    const sourceNode = nodes.find((n) => n.id === selectedEdge.source);
    const targetNode = nodes.find((n) => n.id === selectedEdge.target);

    return (
      <aside className="w-full h-full bg-white border-l border-slate-200 flex flex-col select-none z-20 shadow-2xs">
        {tabBar}
        <div className="p-3.5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-blue-600" />
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Connection Line
            </h3>
          </div>

          {readOnly ? (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
              Read-Only
            </span>
          ) : (
            <button
              onClick={() => onDeleteEdge(selectedEdge.id)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
              title="Delete connection"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <fieldset disabled={readOnly} className={`flex-1 overflow-y-auto p-4 space-y-4 text-xs ${readOnly ? 'opacity-80' : ''}`}>
          <div>
            <label className="font-semibold text-slate-700 block mb-1">Connection Label</label>
            <input
              type="text"
              value={edgeData.label || ''}
              onChange={(e) => onUpdateEdgeData(selectedEdge.id, { label: e.target.value })}
              placeholder="e.g. HTTPS / REST, 1:N, Kafka Topic"
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500"
            />
          </div>

          <EdgeStyleSection data={edgeData} onChange={(patch) => onUpdateEdgeData(selectedEdge.id, patch)} />

          <MoveEdgeSection
            idPrefix={`edge-${selectedEdge.id}`}
            sourceLabel={sourceNode ? nodeLabel(sourceNode) : undefined}
            targetLabel={targetNode ? nodeLabel(targetNode) : undefined}
            currentSourceSide={selectedEdge.sourceHandle as 'top' | 'right' | 'bottom' | 'left' | undefined}
            currentTargetSide={selectedEdge.targetHandle as 'top' | 'right' | 'bottom' | 'left' | undefined}
            onMove={(end, side) => onMoveEdgeEndpoint(selectedEdge.id, end, side)}
          />
        </fieldset>
      </aside>
    );
  }

  // Case 2b: Comment Selected — text and style (background/outline) are
  // editable only by whoever wrote it; everyone else with view access sees
  // who wrote it, when, and the text, read-only. Deleting is author-or-ADMIN
  // (moderation), enforced again server-side in onDeleteComment itself —
  // this only ever hides a button someone couldn't use anyway.
  if (selectedComment) {
    const isAuthor = !!currentUserId && currentUserId === selectedComment.authorId;
    const canModerate = isAuthor || !!isDiagramAdmin;

    return (
      <aside className="w-full h-full bg-white border-l border-slate-200 flex flex-col select-none z-20 shadow-2xs">
        {tabBar}
        <div className="p-3.5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-blue-600" />
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Comment</h3>
            {selectedComment.resolved && (
              <span className="px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[9px] font-bold border border-emerald-200">
                Resolved
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {canModerate && (
              <button
                onClick={() => onToggleCommentResolved(selectedComment.id)}
                className={`p-1.5 rounded-lg transition-colors ${
                  selectedComment.resolved
                    ? 'text-emerald-600 hover:bg-emerald-50'
                    : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                }`}
                title={selectedComment.resolved ? 'Mark unresolved' : 'Mark resolved'}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
              </button>
            )}
            {canModerate && (
              <button
                onClick={() => onDeleteComment(selectedComment.id)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                title="Delete comment"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-[11px] font-bold text-slate-700 shrink-0">
              {selectedComment.authorName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-slate-800 truncate">{selectedComment.authorName}</div>
              <div className="text-[10px] text-slate-400">
                {new Date(selectedComment.createdAt).toLocaleString()}
              </div>
            </div>
          </div>

          {isAuthor ? (
            <>
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Text</label>
                <textarea
                  value={selectedComment.text}
                  onChange={(e) => onUpdateComment(selectedComment.id, { text: e.target.value })}
                  rows={4}
                  placeholder="Write a comment... use @Name to notify a collaborator"
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>
              <BackgroundColorControl
                label="Background Color"
                value={selectedComment.bgColor}
                onChange={(hex) => onUpdateComment(selectedComment.id, { bgColor: hex })}
              />
              <BackgroundColorControl
                label="Outline Color"
                value={selectedComment.borderColor}
                onChange={(hex) => onUpdateComment(selectedComment.id, { borderColor: hex })}
              />
            </>
          ) : (
            <div
              className="p-3 rounded-lg border"
              style={{
                backgroundColor: selectedComment.bgColor || '#f8fafc',
                borderColor: selectedComment.borderColor || '#e2e8f0',
              }}
            >
              <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">
                {selectedComment.text || <span className="italic text-slate-400">No text yet.</span>}
              </p>
              <p className="text-[10px] text-slate-400 mt-2 italic">
                Only {selectedComment.authorName} can edit this comment.
              </p>
            </div>
          )}

          <CommentRepliesSection
            key={selectedComment.id}
            comment={selectedComment}
            currentUserId={currentUserId}
            isDiagramAdmin={!!isDiagramAdmin}
            canComment={!!canComment}
            onAddReply={(text) => onAddCommentReply(selectedComment.id, text)}
            onDeleteReply={(replyId) => onDeleteCommentReply(selectedComment.id, replyId)}
          />
        </div>
      </aside>
    );
  }

  // Case 3: Canvas / Nothing Selected
  return (
    <aside className="w-full h-full bg-white border-l border-slate-200 flex flex-col select-none z-20 shadow-2xs">
      {tabBar}
      <div className="p-3.5 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-blue-600" />
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Canvas Overview
          </h3>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5 text-xs">
        {/* Canvas Stats Card */}
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Diagram Metrics
          </div>
          <div className="grid grid-cols-2 gap-2 pt-1">
            <div className="bg-white p-2.5 rounded-lg border border-slate-200/80">
              <div className="text-lg font-bold text-slate-900">{nodeCount}</div>
              <div className="text-[11px] text-slate-500">Total Nodes</div>
            </div>
            <div className="bg-white p-2.5 rounded-lg border border-slate-200/80">
              <div className="text-lg font-bold text-slate-900">{edgeCount}</div>
              <div className="text-[11px] text-slate-500">Connections</div>
            </div>
          </div>
        </div>

        {/* Quick Tips */}
        <div className="space-y-2">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Quick Actions
          </div>
          <div className="space-y-1.5 text-slate-600 leading-relaxed text-[11px]">
            <p>• Click any node or connection line to customize its properties.</p>
            <p>• Drag from any node circle handle to connect nodes together.</p>
            <p>• Click <span className="font-semibold text-slate-800">Tidy Layout</span> in the header to auto-organize overlapping nodes.</p>
          </div>
        </div>

        {/* Keyboard Shortcuts */}
        <div className="pt-3 border-t border-slate-100 space-y-2">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Keyboard Shortcuts
          </div>
          <div className="space-y-1.5 font-mono text-[11px]">
            <div className="flex items-center justify-between text-slate-600">
              <span>Delete / Backspace</span>
              <kbd className="px-1.5 py-0.5 rounded bg-slate-100 border text-[10px]">Del</kbd>
            </div>
            <div className="flex items-center justify-between text-slate-600">
              <span>Undo</span>
              <kbd className="px-1.5 py-0.5 rounded bg-slate-100 border text-[10px]">Ctrl+Z</kbd>
            </div>
            <div className="flex items-center justify-between text-slate-600">
              <span>Redo</span>
              <kbd className="px-1.5 py-0.5 rounded bg-slate-100 border text-[10px]">Ctrl+Y</kbd>
            </div>
            <div className="flex items-center justify-between text-slate-600">
              <span>Multi-select</span>
              <kbd className="px-1.5 py-0.5 rounded bg-slate-100 border text-[10px]">Shift+Drag</kbd>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

interface LayersListProps {
  nodes: Node[];
  edges: Edge[];
  selectedNode: Node | null;
  selectedEdge: Edge | null;
  onSelectNode: (id: string) => void;
  onSelectEdge: (id: string) => void;
  onDeleteNode: (id: string) => void;
  onDeleteEdge: (id: string) => void;
  readOnly: boolean;
}

// Nodes have no explicit parent/child field in this data model, so the
// hierarchy is derived from the edge graph: an edge source -> target means
// target is a "child" of source. Nodes with no incoming edge (including
// fully isolated nodes) are roots. A node reachable from more than one
// parent renders under each of them (normal for a DAG, not a strict tree);
// a node reachable from itself via its own ancestors renders as a
// non-expandable leaf instead of recursing forever.
function buildChildrenMap(edges: Edge[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const edge of edges) {
    const list = map.get(edge.source) || [];
    list.push(edge.target);
    map.set(edge.source, list);
  }
  return map;
}

function LayersList({
  nodes,
  edges,
  selectedNode,
  selectedEdge,
  onSelectNode,
  onSelectEdge,
  onDeleteNode,
  onDeleteEdge,
  readOnly,
}: LayersListProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const nodesById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const childrenMap = useMemo(() => buildChildrenMap(edges), [edges]);
  const hasIncoming = useMemo(() => new Set(edges.map((e) => e.target)), [edges]);
  const roots = useMemo(() => nodes.filter((n) => !hasIncoming.has(n.id)), [nodes, hasIncoming]);

  const toggleCollapsed = useCallback((id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => setCollapsed(new Set()), []);
  const collapseAll = useCallback(() => {
    setCollapsed(new Set(nodes.filter((n) => (childrenMap.get(n.id) || []).length > 0).map((n) => n.id)));
  }, [nodes, childrenMap]);

  const edgeEndpointLabel = (id: string) => {
    const node = nodesById.get(id);
    return node ? nodeLabel(node) : id;
  };

  const renderRow = (nodeId: string, depth: number, ancestors: Set<string>): React.ReactNode => {
    const node = nodesById.get(nodeId);
    if (!node) return null;

    const isCycle = ancestors.has(nodeId);
    const children = isCycle ? [] : childrenMap.get(nodeId) || [];
    const hasChildren = children.length > 0;
    const isCollapsed = collapsed.has(nodeId);
    const active = selectedNode?.id === nodeId;

    return (
      <li key={`${Array.from(ancestors).join('>')}>${nodeId}`}>
        <div
          onClick={() => onSelectNode(nodeId)}
          className={`group flex items-center gap-1.5 py-1.5 pr-3.5 cursor-pointer border-l-2 transition-colors ${
            active
              ? 'bg-blue-50 border-blue-500 text-blue-800'
              : 'border-transparent hover:bg-slate-50 text-slate-700'
          }`}
          style={{ paddingLeft: `${14 + depth * 16}px` }}
          title={isCycle ? `${node.id} (already shown above — cyclic reference)` : node.id}
        >
          {hasChildren ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleCollapsed(nodeId);
              }}
              className="p-0.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200 shrink-0"
              title={isCollapsed ? 'Expand' : 'Collapse'}
            >
              {isCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          ) : (
            <span className="w-4 shrink-0" />
          )}
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isCycle ? 'bg-amber-400' : 'bg-slate-300'}`} />
          <span className={`truncate flex-1 font-medium ${isCycle ? 'italic text-slate-400' : ''}`}>
            {nodeLabel(node)}
          </span>
          <span className="text-[10px] text-slate-400 shrink-0">{nodeTypeLabel(node)}</span>
          {!readOnly && !isCycle && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDeleteNode(nodeId);
              }}
              className="p-1 rounded text-slate-300 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
              title="Delete node"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
        {hasChildren && !isCollapsed && (
          <ul>{children.map((childId) => renderRow(childId, depth + 1, new Set([...ancestors, nodeId])))}</ul>
        )}
      </li>
    );
  };

  return (
    <div className="flex-1 overflow-y-auto text-xs">
      {/* Nodes */}
      <div className="px-3.5 pt-3 pb-1.5 flex items-center justify-between sticky top-0 bg-white">
        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
          <Box className="w-3 h-3" />
          Nodes ({nodes.length})
        </span>
        <div className="flex items-center gap-0.5">
          <button
            onClick={expandAll}
            className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100"
            title="Expand all"
          >
            <ChevronsUpDown className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={collapseAll}
            className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100"
            title="Collapse all"
          >
            <ChevronsDownUp className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      {nodes.length === 0 ? (
        <div className="px-3.5 py-2 text-slate-400 italic">No nodes yet.</div>
      ) : (
        <ul>{roots.map((node) => renderRow(node.id, 0, new Set()))}</ul>
      )}

      {/* Edges */}
      <div className="px-3.5 pt-3 pb-1.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 sticky top-0 bg-white border-t border-slate-100 mt-1">
        <GitBranch className="w-3 h-3" />
        Connections ({edges.length})
      </div>
      {edges.length === 0 ? (
        <div className="px-3.5 py-2 text-slate-400 italic">No connections yet.</div>
      ) : (
        <ul>
          {edges.map((edge) => {
            const active = selectedEdge?.id === edge.id;
            const label = (edge.data as CustomEdgeData | undefined)?.label;
            return (
              <li key={edge.id}>
                <div
                  onClick={() => onSelectEdge(edge.id)}
                  className={`group flex items-center gap-2 px-3.5 py-1.5 cursor-pointer border-l-2 transition-colors ${
                    active
                      ? 'bg-blue-50 border-blue-500 text-blue-800'
                      : 'border-transparent hover:bg-slate-50 text-slate-700'
                  }`}
                  title={edge.id}
                >
                  <span className="truncate flex-1 font-medium">
                    {edgeEndpointLabel(edge.source)}
                    <span className="text-slate-400 mx-1">&rarr;</span>
                    {edgeEndpointLabel(edge.target)}
                  </span>
                  {label ? (
                    <span className="text-[10px] text-slate-400 truncate max-w-[70px] shrink-0">{label}</span>
                  ) : null}
                  {!readOnly && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteEdge(edge.id);
                      }}
                      className="p-1 rounded text-slate-300 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                      title="Delete connection"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

interface BackgroundColorControlProps {
  value?: string;
  onChange: (hex: string | undefined) => void;
  label?: string;
}

// Shared "custom background color" control used across every node type's
// editor — a raw hex override that sits on top of (and can be cleared back
// to) whichever preset/theme color system that node type already has.
function BackgroundColorControl({ value, onChange, label }: BackgroundColorControlProps) {
  return (
    <div>
      <label className="font-semibold text-slate-700 block mb-1.5">
        {label || 'Background Color'}
      </label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value || '#ffffff'}
          onChange={(e) => onChange(e.target.value)}
          className="w-9 h-8 rounded-md border border-slate-200 cursor-pointer bg-white p-0.5"
          title="Pick a custom background color"
        />
        <span className="text-[11px] font-mono text-slate-500">{value || 'default'}</span>
        {value && (
          <button
            onClick={() => onChange(undefined)}
            className="ml-auto text-[11px] text-slate-400 hover:text-slate-700 font-medium"
          >
            Reset
          </button>
        )}
      </div>
    </div>
  );
}

interface NodeStyleSectionProps {
  // For a single selected node, its current data (so controls show real
  // values). For a multi-selection there's no single "current" value across
  // possibly-different nodes, so callers pass `{}` — every control then
  // just shows its "Default" state, and any change is applied to every
  // selected node identically.
  data: Record<string, any>;
  onChange: (patch: Record<string, any>) => void;
}

// The appearance controls common to every node type (opacity, alignment,
// border, font) — shared between the single-node editor and the
// multi-selection bulk editor via the `onChange` indirection, so this
// doesn't need to know whether it's updating one node or many.
function NodeStyleSection({ data, onChange }: NodeStyleSectionProps) {
  return (
    <div className="pt-3 border-t border-slate-100">
      <div className="flex items-center gap-1.5 mb-2">
        <Palette className="w-3.5 h-3.5 text-blue-600" />
        <label className="font-semibold text-slate-700">Style</label>
      </div>

      <div className="mb-2.5">
        <div className="flex items-center justify-between mb-1">
          <label className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
            <Droplet className="w-3 h-3" />
            Opacity
          </label>
          <span className="text-[11px] font-mono text-slate-500">
            {Math.round((data.opacity ?? 1) * 100)}%
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round((data.opacity ?? 1) * 100)}
          onChange={(e) => onChange({ opacity: Number(e.target.value) / 100 })}
          className="w-full accent-blue-600 cursor-pointer"
        />
      </div>

      <div className="mb-2.5">
        <label className="text-[11px] font-medium text-slate-500 block mb-1">Text Align</label>
        <div className="grid grid-cols-3 gap-1.5">
          {(
            [
              { id: 'left', label: 'Left', icon: <AlignLeft className="w-3.5 h-3.5" /> },
              { id: 'center', label: 'Center', icon: <AlignCenter className="w-3.5 h-3.5" /> },
              { id: 'right', label: 'Right', icon: <AlignRight className="w-3.5 h-3.5" /> },
            ] as const
          ).map((align) => (
            <button
              key={align.id}
              onClick={() => onChange({ textAlign: align.id })}
              className={`flex items-center justify-center py-1.5 rounded-lg border transition-colors cursor-pointer ${
                (data.textAlign || 'left') === align.id
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50'
              }`}
              title={align.label}
            >
              {align.icon}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-2.5">
        <div>
          <label className="text-[11px] font-medium text-slate-500 block mb-1">Border Radius</label>
          <input
            type="number"
            min={0}
            placeholder="Default"
            value={typeof data.borderRadius === 'number' ? data.borderRadius : ''}
            onChange={(e) =>
              onChange({ borderRadius: e.target.value === '' ? undefined : Number(e.target.value) })
            }
            className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500"
          />
        </div>
        <div>
          <label className="text-[11px] font-medium text-slate-500 block mb-1">Stroke Width</label>
          <input
            type="number"
            min={0}
            placeholder="Default"
            value={typeof data.strokeWidth === 'number' ? data.strokeWidth : ''}
            onChange={(e) =>
              onChange({ strokeWidth: e.target.value === '' ? undefined : Number(e.target.value) })
            }
            className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      <div className="mb-2.5">
        <BackgroundColorControl
          label="Stroke Color"
          value={data.strokeColor}
          onChange={(hex) => onChange({ strokeColor: hex })}
        />
      </div>

      <div className="grid grid-cols-2 gap-2 mb-2.5">
        <div>
          <label className="text-[11px] font-medium text-slate-500 block mb-1">Font Size</label>
          <input
            type="number"
            min={8}
            placeholder="Default"
            value={typeof data.fontSize === 'number' ? data.fontSize : ''}
            onChange={(e) =>
              onChange({ fontSize: e.target.value === '' ? undefined : Number(e.target.value) })
            }
            className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500"
          />
        </div>
        <div>
          <label className="text-[11px] font-medium text-slate-500 block mb-1">Font Weight</label>
          <select
            value={data.fontWeight || ''}
            onChange={(e) => onChange({ fontWeight: e.target.value || undefined })}
            className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500"
          >
            <option value="">Default</option>
            <option value="normal">Normal</option>
            <option value="medium">Medium</option>
            <option value="semibold">Semibold</option>
            <option value="bold">Bold</option>
          </select>
        </div>
      </div>

      <div className="mb-2.5">
        <BackgroundColorControl
          label="Font Color"
          value={data.fontColor}
          onChange={(hex) => onChange({ fontColor: hex })}
        />
      </div>

      <div>
        <label className="text-[11px] font-medium text-slate-500 block mb-1">Font Family</label>
        <select
          value={data.fontFamily || ''}
          onChange={(e) => onChange({ fontFamily: e.target.value || undefined })}
          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500"
        >
          <option value="">Default</option>
          <option value="Inter, system-ui, sans-serif">Sans-serif (Inter)</option>
          <option value="Georgia, 'Times New Roman', serif">Serif (Georgia)</option>
          <option value="'JetBrains Mono', 'Courier New', monospace">Monospace</option>
          <option value="'Comic Sans MS', cursive">Comic Sans</option>
        </select>
      </div>
    </div>
  );
}

interface EdgeStyleSectionProps {
  // For a single selected edge, its current data. For a multi-selection
  // there's no single "current" value across possibly-different edges, so
  // callers pass `{}` — every control shows its "Default"/unset state, and
  // any change is applied to every selected edge identically.
  data: Record<string, any>;
  onChange: (patch: Record<string, any>) => void;
}

const LINE_COLOR_SWATCHES = [
  { hex: '#2563eb', label: 'Blue' },
  { hex: '#059669', label: 'Green' },
  { hex: '#d97706', label: 'Amber' },
  { hex: '#e11d48', label: 'Rose' },
  { hex: '#7c3aed', label: 'Purple' },
  { hex: '#475569', label: 'Slate' },
];

// The appearance controls common to every edge (curve, animation, line
// pattern/width/color, arrowheads) — shared between the single-edge editor
// and the multi-selection bulk editor via the `onChange` indirection, same
// pattern as NodeStyleSection above. Connection Label is deliberately NOT
// part of this — it's per-edge content, only ever shown for a single
// selected edge.
function EdgeStyleSection({ data, onChange }: EdgeStyleSectionProps) {
  return (
    <>
      <div>
        <label className="font-semibold text-slate-700 block mb-1">Path Curve</label>
        <select
          value={data.edgeType || 'smoothstep'}
          onChange={(e) => onChange({ edgeType: e.target.value })}
          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500"
        >
          <option value="smoothstep">SmoothStep (Orthogonal right angles)</option>
          <option value="bezier">Bezier (Smooth curve)</option>
          <option value="straight">Straight line</option>
        </select>
      </div>

      <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200">
        <span className="font-semibold text-slate-700">Animated Flow Pulse</span>
        <input
          type="checkbox"
          checked={data.animated || false}
          onChange={(e) => onChange({ animated: e.target.checked })}
          className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="font-semibold text-slate-700 block mb-1">Line Pattern</label>
        <select
          value={data.strokeStyle || 'solid'}
          onChange={(e) => onChange({ strokeStyle: e.target.value })}
          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500"
        >
          <option value="solid">Solid Line</option>
          <option value="dashed">Dashed (6 4)</option>
          <option value="dotted">Dotted (2 3)</option>
        </select>
      </div>

      <div>
        <label className="font-semibold text-slate-700 block mb-1">Line Width</label>
        <input
          type="number"
          min={1}
          placeholder="Default"
          value={typeof data.strokeWidth === 'number' ? data.strokeWidth : ''}
          onChange={(e) =>
            onChange({ strokeWidth: e.target.value === '' ? undefined : Number(e.target.value) })
          }
          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500"
        />
      </div>

      <div>
        <label className="font-semibold text-slate-700 block mb-1.5">Line Color</label>
        <div className="flex items-center gap-1.5 flex-wrap">
          {LINE_COLOR_SWATCHES.map((c) => (
            <button
              key={c.hex}
              onClick={() => onChange({ strokeColor: c.hex })}
              className={`w-6 h-6 rounded-full border-2 transition-transform ${
                data.strokeColor === c.hex ? 'scale-125 ring-2 ring-blue-400' : 'hover:scale-110'
              }`}
              style={{ backgroundColor: c.hex, borderColor: '#ffffff' }}
              title={c.label}
            />
          ))}
        </div>
      </div>

      <div>
        <label className="font-semibold text-slate-700 block mb-1">Line Type</label>
        <select
          value={data.lineType || 'none'}
          onChange={(e) => onChange({ lineType: e.target.value })}
          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500"
        >
          <option value="none">Simple Line (no arrows)</option>
          <option value="end">Right Arrow (→ at end)</option>
          <option value="start">Left Arrow (← at start)</option>
          <option value="both">Both Arrows (↔)</option>
        </select>
      </div>
    </>
  );
}

interface MoveEdgeSectionProps {
  idPrefix: string;
  // undefined labels/sides render as generic "Start Node"/"End Node" with no
  // node name and nothing highlighted — the multi-selection case, where
  // each selected edge has a different source/target node.
  sourceLabel?: string;
  targetLabel?: string;
  currentSourceSide?: 'top' | 'right' | 'bottom' | 'left';
  currentTargetSide?: 'top' | 'right' | 'bottom' | 'left';
  onMove: (end: 'source' | 'target', side: 'top' | 'right' | 'bottom' | 'left') => void;
}

const EDGE_SIDES: { id: 'top' | 'right' | 'bottom' | 'left'; label: string; icon: React.ReactNode }[] = [
  { id: 'top', label: 'Top', icon: <ArrowUp className="w-3.5 h-3.5" /> },
  { id: 'right', label: 'Right', icon: <ArrowRight className="w-3.5 h-3.5" /> },
  { id: 'bottom', label: 'Bottom', icon: <ArrowDown className="w-3.5 h-3.5" /> },
  { id: 'left', label: 'Left', icon: <ArrowLeft className="w-3.5 h-3.5" /> },
];

// Shared "which side of the node does this edge attach to" picker — used by
// both the single-edge editor (real node names, current side highlighted)
// and the multi-edge bulk editor (generic labels, nothing highlighted since
// selected edges may currently differ).
function MoveEdgeSection({
  idPrefix,
  sourceLabel,
  targetLabel,
  currentSourceSide,
  currentTargetSide,
  onMove,
}: MoveEdgeSectionProps) {
  const ends = [
    { end: 'source' as const, label: 'Start Node', nodeLabel: sourceLabel, current: currentSourceSide },
    { end: 'target' as const, label: 'End Node', nodeLabel: targetLabel, current: currentTargetSide },
  ];

  return (
    <div className="pt-3 border-t border-slate-100">
      <div className="flex items-center gap-1.5 mb-1">
        <Move className="w-3.5 h-3.5 text-blue-600" />
        <label className="font-semibold text-slate-700">Move Edge</label>
      </div>
      <p className="text-[11px] text-slate-400 mb-2.5 leading-relaxed">
        Pick which side of each node this connection attaches to.
      </p>

      {ends.map(({ end, label, nodeLabel, current }) => (
        <fieldset key={end} className="mb-3 last:mb-0">
          <legend className="text-[11px] font-semibold text-slate-600 mb-1.5">
            {label}
            {nodeLabel && <span className="font-normal text-slate-400"> — {nodeLabel}</span>}
          </legend>
          <div className="grid grid-cols-4 gap-1.5">
            {EDGE_SIDES.map((side) => (
              <label
                key={side.id}
                className={`flex flex-col items-center gap-1 py-1.5 rounded-lg border cursor-pointer transition-colors ${
                  current === side.id
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name={`${idPrefix}-${end}`}
                  className="sr-only"
                  checked={current === side.id}
                  onChange={() => onMove(end, side.id)}
                />
                {side.icon}
                <span className="text-[10px] font-medium">{side.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  );
}

interface CommentRepliesSectionProps {
  comment: DiagramComment;
  currentUserId?: string;
  isDiagramAdmin: boolean;
  canComment: boolean;
  onAddReply: (text: string) => void;
  onDeleteReply: (replyId: string) => void;
}

// Replies are open to anyone who can comment at all — unlike the parent
// comment's own text (author-only), each reply carries its own author, so
// its own delete permission is evaluated per-reply against THAT author, not
// the parent comment's. Keyed by comment id from the caller so this local
// draft state resets automatically when you switch which comment you're
// looking at, instead of needing an effect to clear it.
function CommentRepliesSection({
  comment,
  currentUserId,
  isDiagramAdmin,
  canComment,
  onAddReply,
  onDeleteReply,
}: CommentRepliesSectionProps) {
  const [draft, setDraft] = useState('');
  const replies = comment.replies || [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    onAddReply(draft);
    setDraft('');
  };

  return (
    <div className="pt-3 border-t border-slate-100">
      <label className="font-semibold text-slate-700 block mb-2">
        Replies{replies.length > 0 ? ` (${replies.length})` : ''}
      </label>

      {replies.length > 0 && (
        <ul className="space-y-2 mb-2.5">
          {replies.map((reply: CommentReply) => {
            const canDeleteReply = reply.authorId === currentUserId || isDiagramAdmin;
            return (
              <li key={reply.id} className="flex items-start gap-2 p-2 rounded-lg bg-slate-50 border border-slate-200">
                <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[9px] font-bold text-slate-700 shrink-0 mt-0.5">
                  {reply.authorName.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-slate-800 truncate">{reply.authorName}</span>
                    <span className="text-[10px] text-slate-400 shrink-0">
                      {new Date(reply.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-slate-600 whitespace-pre-wrap leading-relaxed">{reply.text}</p>
                </div>
                {canDeleteReply && (
                  <button
                    onClick={() => onDeleteReply(reply.id)}
                    className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors shrink-0 cursor-pointer"
                    title="Delete reply"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {canComment ? (
        <form onSubmit={handleSubmit} className="flex items-center gap-1.5">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Reply..."
            className="flex-1 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500"
          />
          <button
            type="submit"
            disabled={!draft.trim()}
            className="p-1.5 rounded-lg text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors cursor-pointer shrink-0"
            title="Send reply"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      ) : (
        replies.length === 0 && <p className="text-slate-400 italic">No replies yet.</p>
      )}
    </div>
  );
}

interface AuditEntry {
  id: string;
  userId: string;
  userName: string;
  actorType?: 'human' | 'mcp';
  action: 'created' | 'updated' | 'deleted';
  timestamp: string;
  description?: string;
  restorable: boolean;
}

const ACTION_LABEL: Record<AuditEntry['action'], string> = {
  created: 'created this diagram',
  updated: 'updated this diagram',
  deleted: 'deleted this diagram',
};

function ActivityLog({ diagramId, onRestored }: { diagramId: string; onRestored?: () => void }) {
  // null = not fetched yet; [] = fetched, empty — same trick used elsewhere
  // in this codebase to avoid a separate "loading" flag that would need a
  // synchronous setState call at the top of the effect body.
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const loadActivity = useCallback(() => {
    return fetch(`/api/diagrams/${diagramId}/audit-log`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        setEntries(data?.activity || []);
      });
  }, [diagramId]);

  useEffect(() => {
    loadActivity();
  }, [loadActivity]);

  const handleRestore = useCallback(
    (entryId: string) => {
      setRestoringId(entryId);
      fetch(`/api/diagrams/${diagramId}/audit-log/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entryId }),
      })
        .then((res) => {
          if (!res.ok) throw new Error('Restore failed');
          return loadActivity();
        })
        .then(() => onRestored?.())
        .catch(() => {})
        .finally(() => {
          setRestoringId(null);
          setConfirmingId(null);
        });
    },
    [diagramId, loadActivity, onRestored]
  );

  return (
    <div className="flex-1 overflow-y-auto text-xs">
      <div className="px-3.5 pt-3 pb-1.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
        <History className="w-3 h-3" />
        Recent Activity
      </div>
      {entries === null ? (
        <div className="px-3.5 py-6 text-center text-slate-400">Loading…</div>
      ) : entries.length === 0 ? (
        <div className="px-3.5 py-6 text-center text-slate-400 italic">No recorded activity yet.</div>
      ) : (
        <ul className="px-3.5 space-y-2.5 pb-4">
          {entries.map((entry) => (
            <li key={entry.id || `${entry.userId}-${entry.timestamp}`} className="text-slate-600">
              <div className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <span className="text-[11px] font-semibold text-slate-700 truncate flex items-center gap-1">
                    {entry.userName}
                    {entry.actorType === 'mcp' && (
                      <span title="Made via MCP/AI tool" className="inline-flex shrink-0">
                        <Bot className="w-3 h-3 text-violet-500" />
                      </span>
                    )}
                  </span>
                  <span className="text-[11px] text-slate-500">
                    {entry.description || ACTION_LABEL[entry.action]} · {formatRelativeTime(entry.timestamp)}
                  </span>
                </div>
                {entry.restorable && confirmingId !== entry.id && (
                  <button
                    onClick={() => setConfirmingId(entry.id)}
                    className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer shrink-0"
                    title="Restore this version"
                  >
                    <RotateCcw className="w-3 h-3" />
                  </button>
                )}
              </div>
              {confirmingId === entry.id && (
                <div className="mt-1.5 ml-3.5 flex items-center gap-2 text-[11px]">
                  <span className="text-slate-500">Restore to this version?</span>
                  <button
                    onClick={() => handleRestore(entry.id)}
                    disabled={restoringId === entry.id}
                    className="px-2 py-0.5 rounded bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
                  >
                    {restoringId === entry.id ? 'Restoring…' : 'Confirm'}
                  </button>
                  <button
                    onClick={() => setConfirmingId(null)}
                    disabled={restoringId === entry.id}
                    className="px-2 py-0.5 rounded text-slate-500 hover:bg-slate-100 cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="px-3.5 pb-4 text-[10px] text-slate-300 leading-relaxed border-t border-slate-100 pt-3 mt-2">
        Shows create/update/delete events only — not a field-level diff of what changed.
      </p>
    </div>
  );
}
