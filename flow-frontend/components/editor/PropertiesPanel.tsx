'use client';

import React from 'react';
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
} from 'lucide-react';
import {
  SystemNodeData,
  FlowchartNodeData,
  ERTableNodeData,
  GroupNodeData,
  StickyNodeData,
  CustomEdgeData,
  ERColumn,
} from '@/types/diagram';

interface PropertiesPanelProps {
  selectedNode: Node | null;
  selectedEdge: Edge | null;
  onUpdateNodeData: (id: string, newData: Record<string, any>) => void;
  onUpdateEdgeData: (id: string, newData: Record<string, any>) => void;
  onDuplicateNode: (id: string) => void;
  onDeleteNode: (id: string) => void;
  onDeleteEdge: (id: string) => void;
  nodeCount: number;
  edgeCount: number;
  readOnly?: boolean;
}

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
  onUpdateNodeData,
  onUpdateEdgeData,
  onDuplicateNode,
  onDeleteNode,
  onDeleteEdge,
  nodeCount,
  edgeCount,
  readOnly = false,
}: PropertiesPanelProps) {
  // Case 1: Node Selected
  if (selectedNode) {
    const nodeType = selectedNode.type;
    const data = selectedNode.data as Record<string, any>;

    return (
      <aside className="w-full h-full bg-white border-l border-slate-200 flex flex-col select-none z-20 shadow-2xs">
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
                        <input
                          type="text"
                          value={col.type}
                          onChange={(e) => {
                            const cols = [...(data.columns || [])];
                            cols[idx] = { ...cols[idx], type: e.target.value };
                            onUpdateNodeData(selectedNode.id, { columns: cols });
                          }}
                          placeholder="TYPE"
                          className="w-24 px-1.5 py-0.5 bg-white border border-slate-200 rounded font-mono text-slate-700"
                        />

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
            </>
          )}
        </fieldset>
      </aside>
    );
  }

  // Case 2: Edge Selected
  if (selectedEdge) {
    const edgeData = (selectedEdge.data || {}) as CustomEdgeData;

    return (
      <aside className="w-full h-full bg-white border-l border-slate-200 flex flex-col select-none z-20 shadow-2xs">
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

          <div>
            <label className="font-semibold text-slate-700 block mb-1">Path Curve</label>
            <select
              value={edgeData.edgeType || 'smoothstep'}
              onChange={(e) => onUpdateEdgeData(selectedEdge.id, { edgeType: e.target.value })}
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
              checked={edgeData.animated || false}
              onChange={(e) => onUpdateEdgeData(selectedEdge.id, { animated: e.target.checked })}
              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-1">Line Pattern</label>
            <select
              value={edgeData.strokeStyle || 'solid'}
              onChange={(e) => onUpdateEdgeData(selectedEdge.id, { strokeStyle: e.target.value })}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500"
            >
              <option value="solid">Solid Line</option>
              <option value="dashed">Dashed (6 4)</option>
              <option value="dotted">Dotted (2 3)</option>
            </select>
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-1.5">Line Color</label>
            <div className="flex items-center gap-1.5 flex-wrap">
              {[
                { hex: '#2563eb', label: 'Blue' },
                { hex: '#059669', label: 'Green' },
                { hex: '#d97706', label: 'Amber' },
                { hex: '#e11d48', label: 'Rose' },
                { hex: '#7c3aed', label: 'Purple' },
                { hex: '#475569', label: 'Slate' },
              ].map((c) => (
                <button
                  key={c.hex}
                  onClick={() => onUpdateEdgeData(selectedEdge.id, { strokeColor: c.hex })}
                  className={`w-6 h-6 rounded-full border-2 transition-transform ${
                    edgeData.strokeColor === c.hex ? 'scale-125 ring-2 ring-blue-400' : 'hover:scale-110'
                  }`}
                  style={{ backgroundColor: c.hex, borderColor: '#ffffff' }}
                  title={c.label}
                />
              ))}
            </div>
          </div>
        </fieldset>
      </aside>
    );
  }

  // Case 3: Canvas / Nothing Selected
  return (
    <aside className="w-full h-full bg-white border-l border-slate-200 flex flex-col select-none z-20 shadow-2xs">
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
