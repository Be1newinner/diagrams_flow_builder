'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  NodeChange,
  EdgeChange,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  useReactFlow,
  OnSelectionChangeParams,
} from '@xyflow/react';
import { toPng, toSvg } from 'html-to-image';
import { ArrowLeft, Loader2, Sparkles, Plus, Lock, LogIn, Eye, CheckCircle2, RefreshCw } from 'lucide-react';

import { useAuth } from '@/context/AuthContext';
import { Diagram, DiagramCategory } from '@/types/diagram';
import {
  getDiagram,
  saveDiagram,
  duplicateDiagram,
  exportDiagramJSON,
  importDiagramJSON,
  fetchLatestFromServer,
} from '@/lib/storage';
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

  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // True only while there is a real, user-driven change waiting to be saved.
  // React Flow fires onNodesChange for passive events too (dimension
  // measurement on mount, selection clicks) — without this flag those would
  // trigger the autosave effect and PUT a stale in-memory copy back to the
  // server, clobbering a newer edit made elsewhere (another tab, another
  // user, or an MCP tool call) in the gap between page load and that PUT.
  const isDirtyRef = useRef(false);

  // Set when a save attempt (or background poll) discovers the server has a
  // newer version than the one this tab started editing from.
  const [conflictDiagram, setConflictDiagramState] = useState<Diagram | null>(null);

  // Resizable left/right panel widths (px), dragged via the handles between
  // each sidebar and the canvas.
  const [leftWidth, setLeftWidth] = useState(288); // w-72
  const [rightWidth, setRightWidth] = useState(320); // w-80
  const LEFT_MIN = 220;
  const LEFT_MAX = 480;
  const RIGHT_MIN = 260;
  const RIGHT_MAX = 520;

  const startResize = useCallback((side: 'left' | 'right') => (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = side === 'left' ? leftWidth : rightWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX;
      if (side === 'left') {
        const next = Math.min(LEFT_MAX, Math.max(LEFT_MIN, startWidth + delta));
        setLeftWidth(next);
      } else {
        const next = Math.min(RIGHT_MAX, Math.max(RIGHT_MIN, startWidth - delta));
        setRightWidth(next);
      }
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [leftWidth, rightWidth]);

  const isTemplate = diagram.isTemplate || diagram.id.startsWith('template-');

  // Access permissions: exactly 1 ADMIN can edit or delete, VIEWERS are read-only
  const isAdmin =
    !isTemplate &&
    !!user &&
    (diagram.userId === user.id ||
      diagram.users?.some((u) => u.userId === user.id && u.accesstype === 'ADMIN') ||
      !diagram.userId);
  const isViewer =
    !isTemplate && !!user && !isAdmin && !!diagram.users?.some((u) => u.userId === user.id && u.accesstype === 'VIEWER');
  const userAccess: 'ADMIN' | 'VIEWER' | 'TEMPLATE' | 'GUEST' = isTemplate
    ? 'TEMPLATE'
    : isAdmin
    ? 'ADMIN'
    : isViewer
    ? 'VIEWER'
    : 'GUEST';

  const [history, setHistory] = useState<{ nodes: Node[]; edges: Edge[] }[]>([]);
  const [future, setFuture] = useState<{ nodes: Node[]; edges: Edge[] }[]>([]);
  const isUndoRedoAction = useRef(false);

  // Record history snapshot on significant changes
  const recordHistory = useCallback((newNodes: Node[], newEdges: Edge[]) => {
    if (isUndoRedoAction.current) {
      isUndoRedoAction.current = false;
      return;
    }
    isDirtyRef.current = true;
    setHistory((prev) => [...prev.slice(-30), { nodes: newNodes, edges: newEdges }]);
    setFuture([]);
  }, []);

  // Wrapped React Flow change handlers: apply every change (so dimension
  // measurement etc. still renders correctly), but only mark the diagram
  // dirty for changes a user actually made (drag, delete, add) — not passive
  // 'dimensions' or 'select' events. This is what the autosave effect below
  // gates on.
  const onNodesChangeTracked = useCallback(
    (changes: NodeChange[]) => {
      if (changes.some((c) => c.type !== 'dimensions' && c.type !== 'select')) {
        isDirtyRef.current = true;
      }
      onNodesChange(changes);
    },
    [onNodesChange]
  );
  const onEdgesChangeTracked = useCallback(
    (changes: EdgeChange[]) => {
      if (changes.some((c) => c.type !== 'select')) {
        isDirtyRef.current = true;
      }
      onEdgesChange(changes);
    },
    [onEdgesChange]
  );

  // Save to LocalStorage / server with debouncing (ADMIN only)
  useEffect(() => {
    if (isTemplate || !isAdmin) {
      setIsSaving(false);
      return;
    }
    if (!isDirtyRef.current) {
      // Nothing the user actually changed since the last successful save —
      // skip the network round trip instead of re-PUTting an identical (or
      // worse, stale) copy.
      setIsSaving(false);
      return;
    }
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
      };
      saveDiagram(updated, user?.id).then((result) => {
        setIsSaving(false);
        if (result.status === 'ok' || result.status === 'created') {
          isDirtyRef.current = false;
          setDiagram(result.diagram);
        } else if (result.status === 'conflict') {
          // Do NOT overwrite the user's in-progress edits automatically —
          // just surface the newer version and let them choose to reload it.
          // isDirtyRef stays true so we keep retrying (and keep failing
          // safely) until they do.
          setConflictDiagramState(result.latest);
        }
      });
    }, 600);

    return () => clearTimeout(timeout);
  }, [nodes, edges, diagram, gridType, defaultEdgeType, user?.id, isAdmin, isTemplate]);

  // Poll for drift while this tab is open, so edits made elsewhere (another
  // tab, another user, or an MCP tool call) are noticed even if this tab
  // never attempts its own save.
  useEffect(() => {
    if (isTemplate || !isAdmin) return;
    const interval = setInterval(async () => {
      const latest = await fetchLatestFromServer(diagram.id);
      if (!latest || latest.updatedAt === diagram.updatedAt) return;
      if (isDirtyRef.current) {
        // We have unsaved local edits — don't discard them, just warn.
        setConflictDiagramState(latest);
      } else {
        // Nothing unsaved locally: safe to silently adopt the newer version.
        setDiagram(latest);
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [diagram.id, diagram.updatedAt, isAdmin, isTemplate]);

  const handleReloadLatest = useCallback(() => {
    if (!conflictDiagram) return;
    isDirtyRef.current = false;
    setDiagram(conflictDiagram);
    setConflictDiagramState(null);
  }, [conflictDiagram]);

  // Connect handler (ADMIN only)
  const onConnect = useCallback(
    (params: Connection) => {
      if (!user) {
        openLoginModal();
        return;
      }
      if (!isAdmin) {
        setToastMessage('Viewer access is read-only. Duplicate this flow to make changes.');
        setTimeout(() => setToastMessage(null), 3000);
        return;
      }
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
    [user, isAdmin, openLoginModal, nodes, edges, defaultEdgeType, recordHistory, setEdges]
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
      // Position near center of the current viewport with slight random offset
      const viewport = reactFlowInstance.getViewport();
      const currentZoom = viewport.zoom || 1;
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
    [user, isAdmin, openLoginModal, nodes, edges, reactFlowInstance, recordHistory, setNodes]
  );

  // Update Node Data (Admin only)
  const handleUpdateNodeData = useCallback(
    (nodeId: string, newData: Record<string, any>) => {
      if (!isAdmin) return;
      isDirtyRef.current = true;
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
    [isAdmin, setNodes]
  );

  // Update Edge Data (Admin only)
  const handleUpdateEdgeData = useCallback(
    (edgeId: string, newData: Record<string, any>) => {
      if (!isAdmin) return;
      isDirtyRef.current = true;
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
    [isAdmin, setEdges]
  );

  // Duplicate Node (Admin only)
  const handleDuplicateNode = useCallback(
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
        duplicated,
      ]);
      setSelectedNode(duplicated);
    },
    [isAdmin, nodes, edges, recordHistory, setNodes]
  );

  // Delete Node (Admin only)
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
    isUndoRedoAction.current = true;
    isDirtyRef.current = true;
    setNodes(previous.nodes);
    setEdges(previous.edges);
    setSelectedNode(null);
    setSelectedEdge(null);
  }, [isAdmin, history, nodes, edges, setNodes, setEdges]);

  const handleRedo = useCallback(() => {
    if (!isAdmin) return;
    if (future.length === 0) return;
    const next = future[0];
    isUndoRedoAction.current = true;
    isDirtyRef.current = true;
    setHistory((h) => [...h, { nodes, edges }]);
    setFuture((f) => f.slice(1));
    setNodes(next.nodes);
    setEdges(next.edges);
    setSelectedNode(null);
    setSelectedEdge(null);
  }, [isAdmin, future, nodes, edges, setNodes, setEdges]);

  // Keyboard Shortcuts (Admin only)
  useEffect(() => {
    if (!isAdmin) return;

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
  }, [isAdmin, handleUndo, handleRedo, selectedNode, selectedEdge, handleDeleteNode, handleDeleteEdge]);

  // Auto Layout (Admin only)
  const handleAutoLayout = useCallback(() => {
    if (!isAdmin) {
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
  }, [isAdmin, nodes, edges, recordHistory, setNodes, reactFlowInstance]);

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
    const json = exportDiagramJSON(diagram.id, user?.id);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.download = `${diagram.title.toLowerCase().replace(/\s+/g, '_')}.json`;
    a.href = url;
    a.click();
    URL.revokeObjectURL(url);
  }, [diagram.id, diagram.title, user?.id]);

  const handleImportJSON = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target?.result as string;
          const imported = importDiagramJSON(text, user?.id);
          router.push(`/flow/${imported.id}`);
        } catch {
          alert('Invalid diagram JSON file.');
        }
      };
      reader.readAsText(file);
    },
    [router, user?.id]
  );

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
      {isTemplate ? (
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
            <Eye className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span>
              <strong>Viewer Access:</strong> You have read-only access to this diagram.
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
                <strong>Preview Mode:</strong> You must sign in or register to create, move, connect, or edit diagram nodes.
              </span>
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

      {/* Conflict Banner: server has a newer version than the one we're editing */}
      {isAdmin && conflictDiagram && (
        <div className="bg-rose-50 border-b border-rose-200/90 px-4 py-2 flex items-center justify-between text-xs text-rose-900 shadow-2xs z-30">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-3.5 h-3.5 text-rose-600 shrink-0" />
            <span>
              <strong>Changed elsewhere:</strong> this diagram was updated (another tab, teammate, or an MCP
              tool) since you loaded it. Your unsaved edits here will keep failing to save until you reload.
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setConflictDiagramState(null)}
              className="px-3 py-1 text-rose-700 hover:text-rose-900 font-medium text-xs cursor-pointer"
            >
              Dismiss
            </button>
            <button
              onClick={handleReloadLatest}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-semibold rounded-lg text-xs shadow-xs transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reload Latest Version</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Workspace: Left Palette + Canvas + Right Inspector */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Left Palette */}
        <div style={{ width: leftWidth, flexShrink: 0 }} className="h-full">
          <SidebarPalette
            onAddNode={handleAddNode}
            defaultCategory={diagram.category}
            readOnly={!isAdmin}
          />
        </div>

        {/* Left resize handle */}
        <div
          onMouseDown={startResize('left')}
          className="w-1.5 shrink-0 h-full cursor-col-resize relative z-30 group"
          title="Drag to resize"
        >
          <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-slate-200 group-hover:bg-blue-400 group-active:bg-blue-500 transition-colors" />
        </div>

        {/* Center React Flow Canvas */}
        <div ref={reactFlowWrapper} className="flex-1 h-full w-full relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={isAdmin ? onNodesChangeTracked : undefined}
            onEdgesChange={isAdmin ? onEdgesChangeTracked : undefined}
            onConnect={onConnect}
            nodesDraggable={isAdmin}
            nodesConnectable={isAdmin}
            elementsSelectable={true}
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

        {/* Right resize handle */}
        <div
          onMouseDown={startResize('right')}
          className="w-1.5 shrink-0 h-full cursor-col-resize relative z-30 group"
          title="Drag to resize"
        >
          <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-slate-200 group-hover:bg-blue-400 group-active:bg-blue-500 transition-colors" />
        </div>

        {/* Right Properties Panel */}
        <div style={{ width: rightWidth, flexShrink: 0 }} className="h-full">
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
            readOnly={!isAdmin}
          />
        </div>
      </div>

      {isAdmin && (
        <AiAssistantModal
          isOpen={isAiModalOpen}
          onClose={() => setIsAiModalOpen(false)}
          diagram={diagram}
          nodes={nodes}
          edges={edges}
          onApplyChanges={(newNodes, newEdges, summary) => {
            recordHistory(nodes, edges);
            setNodes(newNodes);
            setEdges(newEdges);
            // Note: don't stamp updatedAt here — saveDiagram uses the
            // incoming value as the version this edit was based on
            // (baseVersion) and stamps the real one itself on success.
            const updated: Diagram = {
              ...diagram,
              nodes: newNodes,
              edges: newEdges,
            };
            saveDiagram(updated, user?.id).then((result) => {
              if (result.status === 'ok' || result.status === 'created') {
                isDirtyRef.current = false;
                setDiagram(result.diagram);
              } else if (result.status === 'conflict') {
                setConflictDiagramState(result.latest);
              }
            });
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
          const serverDiagram = await res.json();
          if (serverDiagram && isMounted) {
            setDiagram(serverDiagram);
            saveDiagram(serverDiagram, user?.id);
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
  }, [id, user?.id]);

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
      {/*
        Keying on updatedAt forces a full remount whenever a newer server
        copy arrives (initial load resolving after localStorage, or a
        reload-latest action after a conflict). FlowEditorCanvas seeds its
        nodes/edges from initialDiagram exactly once via useState — without
        this key, a fresher diagram fetched after mount would never reach
        the canvas, and its stale in-memory nodes could autosave back over
        newer edits made elsewhere (see lib/storage.ts saveDiagram).
      */}
      <FlowEditorCanvas key={diagram.updatedAt} initialDiagram={diagram} />
    </ReactFlowProvider>
  );
}
