'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  useReactFlow,
  OnSelectionChangeParams,
} from '@xyflow/react';
import { toPng, toSvg } from 'html-to-image';
import { ArrowLeft, Loader2, Sparkles, Plus } from 'lucide-react';
import Link from 'next/link';

import { Diagram, DiagramCategory } from '@/types/diagram';
import { getDiagram, saveDiagram, exportDiagramJSON, importDiagramJSON } from '@/lib/storage';
import { tidyLayout } from '@/lib/layout';

import { SystemNode } from '@/components/nodes/SystemNode';
import { FlowchartNode } from '@/components/nodes/FlowchartNode';
import { ERTableNode } from '@/components/nodes/ERTableNode';
import { GroupNode } from '@/components/nodes/GroupNode';
import { StickyNode } from '@/components/nodes/StickyNode';
import { CustomEdge } from '@/components/edges/CustomEdge';

import { EditorHeader } from '@/components/editor/EditorHeader';
import { SidebarPalette } from '@/components/editor/SidebarPalette';
import { PropertiesPanel } from '@/components/editor/PropertiesPanel';

const nodeTypes = {
  systemNode: SystemNode,
  flowchartNode: FlowchartNode,
  erTableNode: ERTableNode,
  groupNode: GroupNode,
  stickyNode: StickyNode,
};

const edgeTypes = {
  customEdge: CustomEdge,
};

function FlowEditorCanvas({ initialDiagram }: { initialDiagram: Diagram }) {
  const router = useRouter();
  const reactFlowInstance = useReactFlow();
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  const [diagram, setDiagram] = useState<Diagram>(initialDiagram);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialDiagram.nodes || []);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialDiagram.edges || []);

  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [gridType, setGridType] = useState<'dots' | 'lines' | 'cross' | 'none'>(
    initialDiagram.settings?.gridType || 'dots'
  );
  const [defaultEdgeType, setDefaultEdgeType] = useState<'smoothstep' | 'bezier' | 'straight'>(
    initialDiagram.settings?.defaultEdgeType || 'smoothstep'
  );

  // Undo/Redo history stack
  const [history, setHistory] = useState<{ nodes: Node[]; edges: Edge[] }[]>([]);
  const [future, setFuture] = useState<{ nodes: Node[]; edges: Edge[] }[]>([]);
  const isUndoRedoAction = useRef(false);

  // Record history snapshot on significant changes
  const recordHistory = useCallback((newNodes: Node[], newEdges: Edge[]) => {
    if (isUndoRedoAction.current) {
      isUndoRedoAction.current = false;
      return;
    }
    setHistory((prev) => [...prev.slice(-30), { nodes: newNodes, edges: newEdges }]);
    setFuture([]);
  }, []);

  // Save to LocalStorage with debouncing
  useEffect(() => {
    setIsSaving(true);
    const timeout = setTimeout(() => {
      const updated: Diagram = {
        ...diagram,
        nodes,
        edges,
        settings: {
          ...diagram.settings,
          gridType,
          defaultEdgeType,
        },
        updatedAt: new Date().toISOString(),
      };
      saveDiagram(updated);
      setDiagram(updated);
      setIsSaving(false);
    }, 600);

    return () => clearTimeout(timeout);
  }, [nodes, edges, diagram.title, diagram.category, gridType, defaultEdgeType]);

  // Connect handler
  const onConnect = useCallback(
    (params: Connection) => {
      const newEdge: Edge = {
        ...params,
        id: `e_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        type: 'customEdge',
        data: {
          label: '',
          edgeType: defaultEdgeType,
          strokeColor: '#64748b',
          animated: false,
        },
      };
      recordHistory(nodes, edges);
      setEdges((eds) => addEdge(newEdge, eds));
    },
    [nodes, edges, defaultEdgeType, recordHistory, setEdges]
  );

  // Selection change
  const onSelectionChange = useCallback((params: OnSelectionChangeParams) => {
    if (params.nodes && params.nodes.length > 0) {
      setSelectedNode(params.nodes[0]);
      setSelectedEdge(null);
    } else if (params.edges && params.edges.length > 0) {
      setSelectedEdge(params.edges[0]);
      setSelectedNode(null);
    } else {
      setSelectedNode(null);
      setSelectedEdge(null);
    }
  }, []);

  // Drag and Drop from Sidebar
  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const raw = e.dataTransfer.getData('application/reactflow');
      if (!raw) return;

      try {
        const { type, data } = JSON.parse(raw);
        const position = reactFlowInstance.screenToFlowPosition({
          x: e.clientX,
          y: e.clientY,
        });

        const newNode: Node = {
          id: `node_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          type,
          position,
          data,
        };

        recordHistory(nodes, edges);
        setNodes((nds) => [...nds, newNode]);
      } catch (err) {
        console.error('Error dropping node:', err);
      }
    },
    [nodes, edges, reactFlowInstance, recordHistory, setNodes]
  );

  // One-click Add Node from Sidebar
  const handleAddNode = useCallback(
    (type: string, data: any) => {
      const id = `node_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      // Position near center with slight random offset
      const currentZoom = reactFlowInstance.getZoom();
      const viewport = reactFlowInstance.getViewport();
      const clientWidth = reactFlowWrapper.current?.clientWidth || 800;
      const clientHeight = reactFlowWrapper.current?.clientHeight || 600;

      const centerX = (-viewport.x + clientWidth / 2) / currentZoom - 100;
      const centerY = (-viewport.y + clientHeight / 2) / currentZoom - 50;

      const offset = (Math.random() - 0.5) * 60;
      const newNode: Node = {
        id,
        type,
        position: { x: centerX + offset, y: centerY + offset },
        data,
      };

      recordHistory(nodes, edges);
      setNodes((nds) => [...nds, newNode]);
    },
    [nodes, edges, reactFlowInstance, recordHistory, setNodes]
  );

  // Update Node Data
  const handleUpdateNodeData = useCallback(
    (nodeId: string, newData: Record<string, any>) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === nodeId) {
            const updated = {
              ...node,
              data: { ...node.data, ...newData },
            };
            setSelectedNode(updated);
            return updated;
          }
          return node;
        })
      );
    },
    [setNodes]
  );

  // Update Edge Data
  const handleUpdateEdgeData = useCallback(
    (edgeId: string, newData: Record<string, any>) => {
      setEdges((eds) =>
        eds.map((edge) => {
          if (edge.id === edgeId) {
            const updated = {
              ...edge,
              data: { ...edge.data, ...newData },
            };
            setSelectedEdge(updated);
            return updated;
          }
          return edge;
        })
      );
    },
    [setEdges]
  );

  // Duplicate Node
  const handleDuplicateNode = useCallback(
    (nodeId: string) => {
      const nodeToCopy = nodes.find((n) => n.id === nodeId);
      if (!nodeToCopy) return;

      const newId = `node_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const duplicated: Node = {
        ...JSON.parse(JSON.stringify(nodeToCopy)),
        id: newId,
        position: {
          x: nodeToCopy.position.x + 40,
          y: nodeToCopy.position.y + 40,
        },
        selected: true,
      };

      recordHistory(nodes, edges);
      setNodes((nds) => [
        ...nds.map((n) => ({ ...n, selected: false })),
        duplicated,
      ]);
      setSelectedNode(duplicated);
    },
    [nodes, edges, recordHistory, setNodes]
  );

  // Delete Node
  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      recordHistory(nodes, edges);
      setNodes((nds) => nds.filter((n) => n.id !== nodeId));
      setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
      setSelectedNode(null);
    },
    [nodes, edges, recordHistory, setNodes, setEdges]
  );

  // Delete Edge
  const handleDeleteEdge = useCallback(
    (edgeId: string) => {
      recordHistory(nodes, edges);
      setEdges((eds) => eds.filter((e) => e.id !== edgeId));
      setSelectedEdge(null);
    },
    [nodes, edges, recordHistory, setEdges]
  );

  // Undo / Redo
  const handleUndo = useCallback(() => {
    if (history.length === 0) return;
    isUndoRedoAction.current = true;
    const previous = history[history.length - 1];
    setFuture((f) => [{ nodes, edges }, ...f]);
    setHistory((h) => h.slice(0, -1));
    setNodes(previous.nodes);
    setEdges(previous.edges);
    setSelectedNode(null);
    setSelectedEdge(null);
  }, [history, nodes, edges, setNodes, setEdges]);

  const handleRedo = useCallback(() => {
    if (future.length === 0) return;
    isUndoRedoAction.current = true;
    const next = future[0];
    setHistory((h) => [...h, { nodes, edges }]);
    setFuture((f) => f.slice(1));
    setNodes(next.nodes);
    setEdges(next.edges);
    setSelectedNode(null);
    setSelectedEdge(null);
  }, [future, nodes, edges, setNodes, setEdges]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input or textarea
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if (
        ((e.metaKey || e.ctrlKey) && e.key === 'y') ||
        ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'z')
      ) {
        e.preventDefault();
        handleRedo();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedNode) {
          e.preventDefault();
          handleDeleteNode(selectedNode.id);
        } else if (selectedEdge) {
          e.preventDefault();
          handleDeleteEdge(selectedEdge.id);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo, selectedNode, selectedEdge, handleDeleteNode, handleDeleteEdge]);

  // Auto Layout
  const handleAutoLayout = useCallback(() => {
    recordHistory(nodes, edges);
    const arranged = tidyLayout(nodes, edges);
    setNodes(arranged);
    setTimeout(() => {
      reactFlowInstance.fitView({ padding: 0.2, duration: 400 });
    }, 50);
  }, [nodes, edges, recordHistory, setNodes, reactFlowInstance]);

  // Export handlers
  const handleExportPNG = useCallback(() => {
    if (!reactFlowWrapper.current) return;
    const flowElem = reactFlowWrapper.current.querySelector('.react-flow__viewport') as HTMLElement;
    if (!flowElem) return;

    toPng(flowElem, {
      backgroundColor: '#f8fafc',
      quality: 0.95,
      pixelRatio: 2,
    }).then((dataUrl) => {
      const a = document.createElement('a');
      a.download = `${diagram.title.toLowerCase().replace(/\s+/g, '_')}.png`;
      a.href = dataUrl;
      a.click();
    });
  }, [diagram.title]);

  const handleExportSVG = useCallback(() => {
    if (!reactFlowWrapper.current) return;
    const flowElem = reactFlowWrapper.current.querySelector('.react-flow__viewport') as HTMLElement;
    if (!flowElem) return;

    toSvg(flowElem, {
      backgroundColor: '#f8fafc',
    }).then((dataUrl) => {
      const a = document.createElement('a');
      a.download = `${diagram.title.toLowerCase().replace(/\s+/g, '_')}.svg`;
      a.href = dataUrl;
      a.click();
    });
  }, [diagram.title]);

  const handleExportJSON = useCallback(() => {
    const json = JSON.stringify({ ...diagram, nodes, edges }, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.download = `${diagram.title.toLowerCase().replace(/\s+/g, '_')}.json`;
    a.href = url;
    a.click();
    URL.revokeObjectURL(url);
  }, [diagram, nodes, edges]);

  const handleImportJSON = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const imported = importDiagramJSON(text);
        router.push(`/flow/${imported.id}`);
      } catch {
        alert('Invalid diagram JSON file.');
      }
    };
    reader.readAsText(file);
  }, [router]);

  // MiniMap node color mapper
  const nodeColor = useCallback((node: Node) => {
    if (node.type === 'systemNode') return '#3b82f6';
    if (node.type === 'flowchartNode') return '#f59e0b';
    if (node.type === 'erTableNode') return '#10b981';
    if (node.type === 'groupNode') return '#cbd5e1';
    if (node.type === 'stickyNode') return '#fde047';
    return '#94a3b8';
  }, []);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-50">
      {/* Top Header Toolbar */}
      <EditorHeader
        diagram={diagram}
        onUpdateTitle={(title) => setDiagram((d) => ({ ...d, title }))}
        onUpdateCategory={(category) => setDiagram((d) => ({ ...d, category }))}
        isSaving={isSaving}
        canUndo={history.length > 0}
        canRedo={future.length > 0}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onZoomIn={() => reactFlowInstance.zoomIn({ duration: 250 })}
        onZoomOut={() => reactFlowInstance.zoomOut({ duration: 250 })}
        onFitView={() => reactFlowInstance.fitView({ padding: 0.2, duration: 400 })}
        onAutoLayout={handleAutoLayout}
        gridType={gridType}
        onChangeGridType={setGridType}
        defaultEdgeType={defaultEdgeType}
        onChangeDefaultEdgeType={setDefaultEdgeType}
        onExportPNG={handleExportPNG}
        onExportSVG={handleExportSVG}
        onExportJSON={handleExportJSON}
        onImportJSON={handleImportJSON}
      />

      {/* Main Workspace: Left Palette + Canvas + Right Inspector */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Left Palette */}
        <SidebarPalette onAddNode={handleAddNode} defaultCategory={diagram.category} />

        {/* Center React Flow Canvas */}
        <div ref={reactFlowWrapper} className="flex-1 h-full w-full relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onSelectionChange={onSelectionChange}
            onDragOver={onDragOver}
            onDrop={onDrop}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
            fitViewOptions={{ padding: 0.25 }}
            snapToGrid={diagram.settings?.snapToGrid ?? true}
            snapGrid={[20, 20]}
            defaultEdgeOptions={{
              type: 'customEdge',
              data: { edgeType: defaultEdgeType },
            }}
            proOptions={{ hideAttribution: true }}
            className="bg-slate-50"
          >
            {/* Background pattern */}
            {gridType !== 'none' && (
              <Background
                variant={
                  gridType === 'lines'
                    ? BackgroundVariant.Lines
                    : gridType === 'cross'
                    ? BackgroundVariant.Cross
                    : BackgroundVariant.Dots
                }
                gap={20}
                size={1.2}
                color="#cbd5e1"
              />
            )}

            {/* Standard React Flow Controls */}
            <Controls showInteractive={false} position="bottom-left" />

            {/* MiniMap */}
            <MiniMap
              nodeColor={nodeColor}
              nodeStrokeWidth={3}
              zoomable
              pannable
              position="bottom-right"
              className="!w-44 !h-32 shadow-sm border border-slate-200"
            />
          </ReactFlow>
        </div>

        {/* Right Properties Panel */}
        <PropertiesPanel
          selectedNode={selectedNode}
          selectedEdge={selectedEdge}
          onUpdateNodeData={handleUpdateNodeData}
          onUpdateEdgeData={handleUpdateEdgeData}
          onDuplicateNode={handleDuplicateNode}
          onDeleteNode={handleDeleteNode}
          onDeleteEdge={handleDeleteEdge}
          nodeCount={nodes.length}
          edgeCount={edges.length}
        />
      </div>
    </div>
  );
}

export default function FlowEditorPage() {
  const params = useParams();
  const id = params?.id as string;
  const [diagram, setDiagram] = useState<Diagram | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function loadDiagram() {
      if (!id) return;
      // 1. Try local storage first
      const local = getDiagram(id);
      if (local && isMounted) {
        setDiagram(local);
        setLoading(false);
      }

      // 2. Fetch from server API to guarantee latest AI edits
      try {
        const res = await fetch(`/api/diagrams/${id}`);
        if (res.ok) {
          const serverDiagram = await res.json();
          if (serverDiagram && isMounted) {
            setDiagram(serverDiagram);
            saveDiagram(serverDiagram);
          }
        }
      } catch {
        // use local
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadDiagram();
    return () => {
      isMounted = false;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-7 h-7 animate-spin text-blue-600" />
          <span className="text-xs font-semibold text-slate-500">Loading flow canvas...</span>
        </div>
      </div>
    );
  }

  if (!diagram) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-md p-8 max-w-md text-center">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-3">
            <Sparkles className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-slate-900">Diagram Not Found</h2>
          <p className="text-xs text-slate-500 mt-1 mb-5">
            The requested diagram may have been removed or does not exist.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Dashboard</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <ReactFlowProvider>
      <FlowEditorCanvas initialDiagram={diagram} />
    </ReactFlowProvider>
  );
}
