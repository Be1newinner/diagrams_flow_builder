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
import { ArrowLeft, Loader2, Sparkles, Plus, Lock, LogIn, Eye, CheckCircle2 } from 'lucide-react';

import { useAuth } from '@/context/AuthContext';
import { Diagram, DiagramCategory } from '@/types/diagram';
import { getDiagram, saveDiagram, duplicateDiagram, exportDiagramJSON, importDiagramJSON } from '@/lib/storage';
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
import { AiAssistantModal } from '@/components/editor/AiAssistantModal';
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
  const { user, openLoginModal } = useAuth();

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

  // Access permissions: exactly 1 ADMIN can edit or delete, VIEWERS are read-only
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

  // Save to LocalStorage / server with debouncing (ADMIN only)
  useEffect(() => {
      setIsSaving(false);
      return;
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
      saveDiagram(updated, user?.id);
      setDiagram(updated);
      setIsSaving(false);
    }, 600);

    return () => clearTimeout(timeout);
  }, [nodes, edges, diagram.title, diagram.category, diagram.isTemplate, diagram.id, gridType, defaultEdgeType, user?.id, isAdmin]);

  // Connect handler (ADMIN only)
  const onConnect = useCallback(
      if (!user) {
        openLoginModal();
      }
      if (!isAdmin) {
        setToastMessage('Viewer access is read-only. Duplicate this flow to make changes.');
        setTimeout(() => setToastMessage(null), 3000);
        return;
      }
          label: '',
          edgeType: defaultEdgeType,
          strokeColor: '#64748b',
          animated: false,
        },
      };
      recordHistory(nodes, edges);
      setEdges((eds) => addEdge(newEdge, eds));
    },
    [user, isAdmin, openLoginModal, nodes, edges, defaultEdgeType, recordHistory, setEdges]
  );

  // Selection change
  const onSelectionChange = useCallback((params: OnSelectionChangeParams) => {
    if (params.nodes && params.nodes.length > 0) {
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
      if (!user) {
        openLoginModal();
        return;
      }
      if (!isAdmin) {
        setToastMessage('Viewer access is read-only. Duplicate this flow to make changes.');
        setTimeout(() => setToastMessage(null), 3000);
        return;
      }
      const raw = e.dataTransfer.getData('application/reactflow');
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
    [user, isAdmin, openLoginModal, nodes, edges, reactFlowInstance, recordHistory, setNodes]
  );

  // One-click Add Node from Sidebar
  const handleAddNode = useCallback(
    (type: string, data: any) => {
      if (!user) {
        return;
      }
      if (!isAdmin) {
        setToastMessage('Viewer access is read-only. Duplicate this flow to make changes.');
        setTimeout(() => setToastMessage(null), 3000);
        return;
      }
      const id = `node_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      // Position near center with slight random offset
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
    [user, isAdmin, openLoginModal, nodes, edges, reactFlowInstance, recordHistory, setNodes]
  );

  // Update Node Data (Admin only)
  const handleUpdateNodeData = useCallback(
    (nodeId: string, newData: Record<string, any>) => {
      if (!isAdmin) return;
      setNodes((nds) =>
          if (node.id === nodeId) {
            const updated = {
              ...node,
            };
            setSelectedNode(updated);
            return updated;
          }
          return node;
        })
    },
    [isAdmin, setNodes]
  );

  // Update Edge Data (Admin only)
  const handleUpdateEdgeData = useCallback(
    (edgeId: string, newData: Record<string, any>) => {
      if (!isAdmin) return;
      setEdges((eds) =>
        eds.map((edge) => {
          if (edge.id === edgeId) {
            const updated = {
              ...edge,
              data: { ...edge.data, ...newData },
            };
            return updated;
          }
          return edge;
      );
    },
    [isAdmin, setEdges]
  );

  // Duplicate Node (Admin only)
    (nodeId: string) => {
      if (!isAdmin) return;
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
      ]);
      setSelectedNode(duplicated);
    },
    [isAdmin, nodes, edges, recordHistory, setNodes]
  );

  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      if (!isAdmin) return;
      recordHistory(nodes, edges);
      setNodes((nds) => nds.filter((n) => n.id !== nodeId));
      setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
      setSelectedNode(null);
    },
    [isAdmin, nodes, edges, recordHistory, setNodes, setEdges]
  );

  // Delete Edge (Admin only)
  const handleDeleteEdge = useCallback(
    (edgeId: string) => {
      if (!isAdmin) return;
      recordHistory(nodes, edges);
      setEdges((eds) => eds.filter((e) => e.id !== edgeId));
      setSelectedEdge(null);
    },
    [isAdmin, nodes, edges, recordHistory, setEdges]
  );

  const handleUndo = useCallback(() => {
    if (!isAdmin) return;
    if (history.length === 0) return;
    const previous = history[history.length - 1];
    setFuture((f) => [{ nodes, edges }, ...f]);
    setHistory((h) => h.slice(0, -1));
    setNodes(previous.nodes);
    setEdges(previous.edges);
    setSelectedNode(null);
  }, [isAdmin, history, nodes, edges, setNodes, setEdges]);

  const handleRedo = useCallback(() => {
    if (!isAdmin) return;
    if (future.length === 0) return;
    isUndoRedoAction.current = true;
    setHistory((h) => [...h, { nodes, edges }]);
    setFuture((f) => f.slice(1));
    setNodes(next.nodes);
    setSelectedNode(null);
    setSelectedEdge(null);
  }, [isAdmin, future, nodes, edges, setNodes, setEdges]);

  // Keyboard Shortcuts (Admin only)
  useEffect(() => {
      if (!isAdmin) return;
      // Don't trigger if user is typing in an input or textarea
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;

      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
      } else if (
        ((e.metaKey || e.ctrlKey) && e.key === 'y') ||
        ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'z')
      ) {
        e.preventDefault();
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
  }, [isAdmin, handleUndo, handleRedo, selectedNode, selectedEdge, handleDeleteNode, handleDeleteEdge]);

  // Auto Layout (Admin only)
  const handleAutoLayout = useCallback(() => {
      setToastMessage('Viewer access is read-only.');
      setTimeout(() => setToastMessage(null), 3000);
      return;
    }
    recordHistory(nodes, edges);
    const arranged = tidyLayout(nodes, edges);
    setNodes(arranged);
    setTimeout(() => {
      reactFlowInstance.fitView({ padding: 0.2, duration: 400 });
    }, 50);

  // Export handlers
    if (!reactFlowWrapper.current) return;
    const flowElem = reactFlowWrapper.current.querySelector('.react-flow__viewport') as HTMLElement;

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
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    a.download = `${diagram.title.toLowerCase().replace(/\s+/g, '_')}.json`;
    a.href = url;
    a.click();
  const handleImportJSON = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const imported = importDiagramJSON(text);
        router.push(`/flow/${imported.id}`);
      } catch {
        alert('Invalid diagram JSON file.');
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
        onUpdateTitle={(title) => {
          if (!isAdmin) return;
          setDiagram((d) => ({ ...d, title }));
        }}
        onUpdateCategory={(category) => {
          if (!isAdmin) return;
          setDiagram((d) => ({ ...d, category }));
        }}
        isSaving={isSaving}
        canUndo={isAdmin && history.length > 0}
        canRedo={isAdmin && future.length > 0}
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
        onOpenAiModal={() => setIsAiModalOpen(true)}
        userAccessType={userAccess}
      />

      {/* Sample Template Banner (Read-only) */}
      {(diagram.isTemplate || diagram.id.startsWith('template-')) ? (
        <div className="bg-blue-50 border-b border-blue-200/90 px-4 py-2 flex items-center justify-between text-xs text-blue-900 shadow-2xs z-30">
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span>
              <strong>Starter Sample Template:</strong> This is a built-in read-only reference diagram.
            </span>
          </div>
          <button
            onClick={() => {
              if (!user) {
                openLoginModal();
                return;
              }
              const cloned = duplicateDiagram(diagram.id, user.id);
              if (cloned) router.push(`/flow/${cloned.id}`);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold rounded-lg text-xs shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Duplicate to Edit</span>
          </button>
        </div>
      ) : isViewer ? (
        /* Viewer Notice Banner (Read-Only) */
        <div className="bg-amber-50 border-b border-amber-200/90 px-4 py-2 flex items-center justify-between text-xs text-amber-900 shadow-2xs z-30">
          <div className="flex items-center gap-2">
                openLoginModal();
                return;
              }
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-semibold rounded-lg text-xs shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Duplicate to Edit as Admin</span>
          </button>
        </div>
      ) : (
        /* Top Notice Banner when user is logged out */
        !user && (
          <div className="bg-amber-50 border-b border-amber-200/90 px-4 py-2 flex items-center justify-between text-xs text-amber-900 shadow-2xs z-30">
            <div className="flex items-center gap-2">
              <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>
            </div>
            <button
              onClick={openLoginModal}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold rounded-lg text-xs shadow-xs transition-colors cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In to Build</span>
            </button>
          </div>
        )
      )}

      {/* Main Workspace: Left Palette + Canvas + Right Inspector */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Left Palette */}
        <SidebarPalette
          onAddNode={handleAddNode}
          defaultCategory={diagram.category}
          readOnly={!isAdmin}
        />

        {/* Center React Flow Canvas */}
        <div ref={reactFlowWrapper} className="flex-1 h-full w-full relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
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
        <PropertiesPanel
          selectedNode={selectedNode}
          selectedEdge={selectedEdge}
          onUpdateNodeData={handleUpdateNodeData}
          onUpdateEdgeData={handleUpdateEdgeData}
          onDuplicateNode={handleDuplicateNode}
          onDeleteNode={handleDeleteNode}
          onDeleteEdge={handleDeleteEdge}
          readOnly={!isAdmin}
        />
      </div>
      {isAdmin && (
        <AiAssistantModal
          isOpen={isAiModalOpen}
          onClose={() => setIsAiModalOpen(false)}
          edges={edges}
          onApplyChanges={(newNodes, newEdges, summary) => {
            recordHistory(nodes, edges);
            setNodes(newNodes);
            setEdges(newEdges);
            const updated: Diagram = {
              ...diagram,
              nodes: newNodes,
              edges: newEdges,
              updatedAt: new Date().toISOString(),
            };
            saveDiagram(updated, user?.id);
            setDiagram(updated);
            setToastMessage(summary || 'Diagram updated by AI!');
            setTimeout(() => setToastMessage(null), 3500);
            setTimeout(() => {
              reactFlowInstance.fitView({ padding: 0.2, duration: 400 });
            }, 100);
          }}
        />
      )}

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-xl text-xs font-medium flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}

export default function FlowEditorPage() {
  const params = useParams();
  const id = params?.id as string;
  const { user } = useAuth();
  const [diagram, setDiagram] = useState<Diagram | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function loadDiagram() {
      if (!id) return;
      // 1. Try local storage first
      const local = getDiagram(id, user?.id);
      if (local && isMounted) {
        setDiagram(local);
        setLoading(false);
      }

      // 2. Fetch from server API to guarantee latest AI edits
      try {
        const res = await fetch(`/api/diagrams/${id}`);
        if (res.ok) {
          if (serverDiagram && isMounted) {
            setDiagram(serverDiagram);
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
