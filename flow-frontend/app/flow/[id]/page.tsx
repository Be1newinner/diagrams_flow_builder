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
  reconnectEdge,
  ConnectionMode,
  MarkerType,
  Connection,
  Edge,
  EdgeMarker,
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
import type Ably from 'ably';
import {
  ArrowLeft,
  Loader2,
  Sparkles,
  Plus,
  Lock,
  LogIn,
  Eye,
  CheckCircle2,
  RefreshCw,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
} from 'lucide-react';

import { useAuth } from '@/context/AuthContext';
import { Diagram, DiagramCategory, DiagramComment } from '@/types/diagram';
import {
  getDiagram,
  saveDiagram,
  saveDiagramComments,
  duplicateDiagram,
  importDiagramJSON,
  fetchLatestFromServer,
} from '@/lib/storage';
import { tidyLayout } from '@/lib/layout';

import { SystemNode } from '@/components/nodes/SystemNode';
import { FlowchartNode } from '@/components/nodes/FlowchartNode';
import { ERTableNode } from '@/components/nodes/ERTableNode';
import { GroupNode } from '@/components/nodes/GroupNode';
import { StickyNode } from '@/components/nodes/StickyNode';
import { ImageNode } from '@/components/nodes/ImageNode';
import { CustomEdge } from '@/components/edges/CustomEdge';

import { EditorHeader } from '@/components/editor/EditorHeader';
import { SidebarPalette } from '@/components/editor/SidebarPalette';
import { PropertiesPanel } from '@/components/editor/PropertiesPanel';
import { AiAssistantModal } from '@/components/editor/AiAssistantModal';
import { AlignmentToolbar } from '@/components/editor/AlignmentToolbar';
import { CollaboratorCursors } from '@/components/editor/CollaboratorCursors';
import { CollaboratorSelections } from '@/components/editor/CollaboratorSelections';
import { CommentPins } from '@/components/editor/CommentPins';
import { AlignmentGuides } from '@/components/editor/AlignmentGuides';
import { CommandPalette, CommandPaletteAction } from '@/components/editor/CommandPalette';

const nodeTypes = {
  systemNode: SystemNode,
  flowchartNode: FlowchartNode,
  erTableNode: ERTableNode,
  groupNode: GroupNode,
  stickyNode: StickyNode,
  imageNode: ImageNode,
};

const edgeTypes = {
  customEdge: CustomEdge,
};

// Derives an edge's top-level markerStart/markerEnd from its own `data`
// (lineType + strokeColor) rather than letting them be set independently —
// React Flow builds its <marker> SVG defs by scanning every edge's
// top-level marker fields, so these can't live purely inside CustomEdge's
// own render; they have to be recomputed here whenever lineType or
// strokeColor changes, and kept in sync with whatever color the line
// itself is using (matching CustomEdge's own default when unset).
function computeEdgeMarkers(data: Record<string, any>): {
  markerStart: EdgeMarker | undefined;
  markerEnd: EdgeMarker | undefined;
} {
  const color = data.strokeColor || '#94a3b8';
  const marker: EdgeMarker = { type: MarkerType.ArrowClosed, color, width: 18, height: 18 };
  const lineType = data.lineType || 'none';
  return {
    markerStart: lineType === 'start' || lineType === 'both' ? marker : undefined,
    markerEnd: lineType === 'end' || lineType === 'both' ? marker : undefined,
  };
}

function FlowEditorCanvas({ initialDiagram }: { initialDiagram: Diagram }) {
  const router = useRouter();
  const reactFlowInstance = useReactFlow();
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { user, openLoginModal } = useAuth();

  const [diagram, setDiagram] = useState<Diagram>(initialDiagram);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialDiagram.nodes || []);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialDiagram.edges || []);
  // Comments are a canvas overlay independent of the node/edge graph — no
  // React Flow node type, never counted in node/edge CRUD, never selectable
  // alongside a node/edge — so plain state is enough, no useNodesState-style
  // change-tracking needed.
  const [comments, setComments] = useState<DiagramComment[]>(initialDiagram.comments || []);
  const [selectedComment, setSelectedComment] = useState<DiagramComment | null>(null);
  const [commentModeActive, setCommentModeActive] = useState(false);
  // Purely a local view preference (like gridType), not synced to the
  // diagram — resolved comments still exist and still sync for everyone,
  // this just declutters your own canvas.
  const [hideResolvedComments, setHideResolvedComments] = useState(false);

  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null);
  // Full multi-selection, for the alignment toolbar and bulk actions.
  // selectedNode/selectedEdge above stay "the first selected" for the
  // single-item Properties view — these are additive, not a replacement.
  const [selectedNodes, setSelectedNodes] = useState<Node[]>([]);
  const [selectedEdges, setSelectedEdges] = useState<Edge[]>([]);

  const [isSaving, setIsSaving] = useState(false);
  const [gridType, setGridType] = useState<'dots' | 'lines' | 'cross' | 'none'>(
    initialDiagram.settings?.gridType || 'dots'
  );
  const [gridGap, setGridGap] = useState<number>(initialDiagram.settings?.gridGap || 20);
  const [gridSize, setGridSize] = useState<number>(initialDiagram.settings?.gridSize || 1.2);
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

  // Separate from isDirtyRef: a viewer (canComment but !canEdit) can still
  // dirty a comment, but must never trigger the full-diagram autosave below
  // (the server rejects that PUT for non-editors) — only the lighter
  // comments-only save path further down.
  const commentsDirtyRef = useRef(false);

  // Set when a save attempt (or background poll) discovers the server has a
  // newer version than the one this tab started editing from.
  const [conflictDiagram, setConflictDiagramState] = useState<Diagram | null>(null);

  // Resizable left/right panel widths (px), dragged via the handles between
  // each sidebar and the canvas.
  const [leftWidth, setLeftWidth] = useState(288); // w-72
  const [rightWidth, setRightWidth] = useState(320); // w-80
  const [leftVisible, setLeftVisible] = useState(true);
  const [rightVisible, setRightVisible] = useState(true);
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

  // Access permissions: exactly 1 ADMIN owns the diagram (can delete it and
  // manage sharing); any number of EDITORs can edit content alongside the
  // ADMIN but can't do either of those two things; VIEWERS are read-only.
  const isAdmin =
    !isTemplate &&
    !!user &&
    (diagram.userId === user.id ||
      diagram.users?.some((u) => u.userId === user.id && u.accesstype === 'ADMIN') ||
      !diagram.userId);
  const isEditor =
    !isTemplate &&
    !isAdmin &&
    !!user &&
    !!diagram.users?.some((u) => u.userId === user.id && u.accesstype === 'EDITOR');
  // A public diagram is viewable read-only by anyone — signed in or not —
  // so this intentionally does NOT require `user` the way isAdmin/isEditor do.
  const isViewer =
    !isTemplate &&
    !isAdmin &&
    !isEditor &&
    (diagram.isPublic === true ||
      (!!user && !!diagram.users?.some((u) => u.userId === user.id && u.accesstype === 'VIEWER')));
  // The single flag almost every editing gate below actually cares about:
  // "can this person change nodes/edges/canvas settings" — true for both
  // ADMIN and EDITOR. `isAdmin` itself stays reserved for the couple of
  // truly owner-only actions (Share button, diagram delete) that live
  // outside this file.
  const canEdit = isAdmin || isEditor;
  const userAccess: 'ADMIN' | 'EDITOR' | 'VIEWER' | 'TEMPLATE' | 'GUEST' = isTemplate
    ? 'TEMPLATE'
    : isAdmin
    ? 'ADMIN'
    : isEditor
    ? 'EDITOR'
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

  // True for the exact window between calling saveDiagram() and its promise
  // settling. The Ably 'updated' push for THIS save can arrive from the
  // server before that promise resolves and updates diagramUpdatedAtRef (see
  // the ref-sync effect below) — during that gap, isDirtyRef is still true
  // and the push looks exactly like an external edit, which was showing a
  // false "Changed elsewhere" conflict banner even for a single solo editor.
  // Any push that arrives while our own save is still in flight is
  // effectively certain to be that save's own echo, so it's ignored here;
  // genuine conflicts are still fully caught by the 409 baseVersion check
  // performSave itself goes through.
  const saveInFlightRef = useRef(false);

  // The actual save, shared by the debounced autosave effect below and by
  // the manual "Save this version" button — both must save identically
  // (same payload, same conflict handling), the button just skips the wait.
  // `checkpoint` is false only for the debounced autosave, so a run of
  // pauses-while-editing merges into one activity entry instead of each one
  // minting its own (see lib/auditLog.ts) — a manual save always stands on
  // its own.
  const performSave = useCallback((checkpoint: boolean) => {
    if (isTemplate || !canEdit) return;
    if (!isDirtyRef.current) return;
    setIsSaving(true);
    saveInFlightRef.current = true;
    const updated: Diagram = {
      ...diagram,
      nodes,
      edges,
      comments,
      settings: {
        ...diagram.settings,
        gridType,
        gridGap,
        gridSize,
        defaultEdgeType,
      },
    };
    saveDiagram(updated, user?.id, checkpoint).then((result) => {
      setIsSaving(false);
      saveInFlightRef.current = false;
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
  }, [isTemplate, canEdit, diagram, nodes, edges, comments, gridType, gridGap, gridSize, defaultEdgeType, user?.id]);

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced autosave (ADMIN only)
  useEffect(() => {
    if (isTemplate || !canEdit) {
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
    saveTimeoutRef.current = setTimeout(() => performSave(false), 600);

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [nodes, edges, comments, diagram, gridType, gridGap, gridSize, defaultEdgeType, user?.id, canEdit, isTemplate, performSave]);

  const commentSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Manual "Save this version" button: cancel any pending debounced save
  // (so we don't double-save moments later) and save right now instead of
  // waiting out the 600ms debounce.
  const handleSaveNow = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    if (!isDirtyRef.current) {
      setToastMessage('Already up to date — nothing to save.');
      setTimeout(() => setToastMessage(null), 2000);
      return;
    }
    performSave(true);
  }, [performSave]);

  // Applies a server-fetched diagram to everything that actually drives the
  // canvas. `diagram` only holds metadata (title/category/settings) — the
  // visible nodes/edges live in their own useNodesState/useEdgesState. An
  // earlier version of this poll only called setDiagram(latest), which
  // updated that metadata but left the on-screen nodes/edges untouched, so
  // an already-open tab looked stuck even though it had "adopted" the
  // update internally. Route every adoption through here instead.
  const adoptDiagram = useCallback(
    (next: Diagram) => {
      isDirtyRef.current = false;
      isUndoRedoAction.current = false;
      setHistory([]);
      setFuture([]);
      setSelectedNode(null);
      setSelectedEdge(null);
      setSelectedComment(null);
      setNodes(next.nodes || []);
      setEdges(next.edges || []);
      setComments(next.comments || []);
      setGridType(next.settings?.gridType || 'dots');
      setGridGap(next.settings?.gridGap || 20);
      setGridSize(next.settings?.gridSize || 1.2);
      setDefaultEdgeType(next.settings?.defaultEdgeType || 'smoothstep');
      setDiagram(next);
    },
    [setNodes, setEdges]
  );

  // Real-time drift detection: subscribe to this diagram's Ably channel so
  // edits made elsewhere (another tab, another user, or an MCP tool call)
  // arrive as a push the moment they're saved, instead of waiting on a poll.
  // serverStorage.ts publishes an 'updated' event with the new updatedAt
  // after every successful save, from every write path.
  const diagramIdRef = useRef(diagram.id);
  const diagramUpdatedAtRef = useRef(diagram.updatedAt);
  useEffect(() => {
    diagramIdRef.current = diagram.id;
    diagramUpdatedAtRef.current = diagram.updatedAt;
  }, [diagram.id, diagram.updatedAt]);

  // Presence: who else has this diagram open, where their cursor is, and
  // what node/edge (if any) they currently have selected. Keyed by Ably
  // clientId, which we set to our own userId — see /api/ably-token.
  // Excludes ourselves.
  const [collaborators, setCollaborators] = useState<
    Record<string, { name: string; x?: number; y?: number; selectedId?: string | null; selectedType?: 'node' | 'edge' | null }>
  >({});
  const channelRef = useRef<Ably.RealtimeChannel | null>(null);
  const lastCursorSentRef = useRef(0);
  // Presence.update() replaces the whole data object, not just the fields
  // you pass — so every call (cursor move, selection change) needs to carry
  // the last known cursor position forward, or a selection-only update
  // would blank the cursor from everyone else's view until the next
  // mousemove.
  const lastCursorPosRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (isTemplate || !canEdit) return;

    let realtime: Ably.Realtime | null = null;
    let cancelled = false;

    const handleUpdate = async (updatedAt: string) => {
      if (updatedAt === diagramUpdatedAtRef.current) return; // our own save echoing back
      if (saveInFlightRef.current) return; // our own save is still in flight — almost certainly the same echo
      const latest = await fetchLatestFromServer(diagramIdRef.current);
      if (!latest || cancelled) return;
      if (isDirtyRef.current) {
        // We have unsaved local edits — don't discard them, just warn.
        setConflictDiagramState(latest);
      } else {
        // Nothing unsaved locally: safe to adopt the newer version immediately.
        adoptDiagram(latest);
      }
    };

    (async () => {
      const Ably = (await import('ably')).default;
      if (cancelled) return;
      // authParams are sent on every token request (initial + renewal) —
      // the server uses diagramId to mint a token capable of subscribing
      // only to this diagram's own channel, not every diagram's.
      realtime = new Ably.Realtime({
        authUrl: '/api/ably-token',
        authParams: { diagramId: diagramIdRef.current },
      });
      const channel = realtime.channels.get(`diagram:${diagramIdRef.current}`);
      channel.subscribe('updated', (msg) => {
        handleUpdate(msg.data?.updatedAt);
      });

      const refreshCollaborators = async () => {
        try {
          const members = await channel.presence.get();
          if (cancelled) return;
          const next: Record<
            string,
            { name: string; x?: number; y?: number; selectedId?: string | null; selectedType?: 'node' | 'edge' | null }
          > = {};
          members.forEach((m) => {
            if (m.clientId === user?.id) return; // exclude ourselves
            next[m.clientId as string] = {
              name: (m.data?.name as string) || 'Someone',
              x: m.data?.x,
              y: m.data?.y,
              selectedId: m.data?.selectedId ?? null,
              selectedType: m.data?.selectedType ?? null,
            };
          });
          setCollaborators(next);
        } catch {
          // presence unavailable — collaborators list just stays empty
        }
      };
      channel.presence.subscribe(['enter', 'update', 'leave'], refreshCollaborators);
      await channel.presence.enter({ name: user?.name || 'Someone' });
      channelRef.current = channel;
    })();

    // Fallback safety net in case Ably is unreachable, misconfigured
    // (ABLY_API_KEY unset), or the realtime connection silently drops —
    // much slower than the old primary mechanism since it's now just a
    // backstop, not the main sync path.
    const fallbackPoll = setInterval(async () => {
      if (saveInFlightRef.current) return;
      const latest = await fetchLatestFromServer(diagramIdRef.current);
      if (!latest || latest.updatedAt === diagramUpdatedAtRef.current) return;
      if (isDirtyRef.current) {
        setConflictDiagramState(latest);
      } else {
        adoptDiagram(latest);
      }
    }, 60000);

    return () => {
      cancelled = true;
      clearInterval(fallbackPoll);
      channelRef.current?.presence.leave().catch(() => {});
      channelRef.current = null;
      setCollaborators({});
      realtime?.close();
    };
  }, [diagram.id, canEdit, isTemplate, adoptDiagram, user?.id, user?.name]);

  // Broadcasts our cursor position (in flow coordinates, so it stays
  // correctly placed for viewers at a different zoom/pan) to anyone else
  // with this diagram open, throttled so panning/moving the mouse doesn't
  // flood the channel.
  const handleCanvasMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!channelRef.current) return;
      const now = Date.now();
      if (now - lastCursorSentRef.current < 80) return;
      lastCursorSentRef.current = now;
      const flowPos = reactFlowInstance.screenToFlowPosition({ x: e.clientX, y: e.clientY });
      lastCursorPosRef.current = flowPos;
      channelRef.current.presence.update({ name: user?.name || 'Someone', x: flowPos.x, y: flowPos.y });
    },
    [reactFlowInstance, user?.name]
  );

  // Broadcasts what we currently have selected (or null to clear it) so
  // everyone else can render our outline/badge and get bounced with a toast
  // if they try to select the same thing — see the lock effect below.
  const broadcastSelection = useCallback(
    (selectedId: string | null, selectedType: 'node' | 'edge' | null) => {
      if (!channelRef.current) return;
      channelRef.current.presence.update({
        name: user?.name || 'Someone',
        x: lastCursorPosRef.current.x,
        y: lastCursorPosRef.current.y,
        selectedId,
        selectedType,
      });
    },
    [user?.name]
  );

  // "Jump to" a collaborator from the header avatar stack: centers the
  // viewport on whatever they currently have selected (resolved to an
  // actual position from the live nodes/edges, not just re-broadcasting
  // their raw x/y), falling back to their last-known cursor position if
  // they don't have anything selected right now.
  const handleJumpToCollaborator = useCallback(
    (collabId: string) => {
      const collab = collaborators[collabId];
      if (!collab) return;

      if (collab.selectedType === 'node' && collab.selectedId) {
        const node = nodes.find((n) => n.id === collab.selectedId);
        if (node) {
          const width = node.width ?? node.measured?.width ?? 160;
          const height = node.height ?? node.measured?.height ?? 80;
          reactFlowInstance.setCenter(node.position.x + width / 2, node.position.y + height / 2, {
            zoom: Math.max(reactFlowInstance.getZoom(), 1),
            duration: 500,
          });
          return;
        }
      }
      if (collab.selectedType === 'edge' && collab.selectedId) {
        const edge = edges.find((e) => e.id === collab.selectedId);
        const sourceNode = edge && nodes.find((n) => n.id === edge.source);
        const targetNode = edge && nodes.find((n) => n.id === edge.target);
        if (sourceNode && targetNode) {
          const sourceCx = sourceNode.position.x + (sourceNode.width ?? sourceNode.measured?.width ?? 160) / 2;
          const sourceCy = sourceNode.position.y + (sourceNode.height ?? sourceNode.measured?.height ?? 80) / 2;
          const targetCx = targetNode.position.x + (targetNode.width ?? targetNode.measured?.width ?? 160) / 2;
          const targetCy = targetNode.position.y + (targetNode.height ?? targetNode.measured?.height ?? 80) / 2;
          reactFlowInstance.setCenter((sourceCx + targetCx) / 2, (sourceCy + targetCy) / 2, {
            zoom: Math.max(reactFlowInstance.getZoom(), 1),
            duration: 500,
          });
          return;
        }
      }
      if (collab.x !== undefined && collab.y !== undefined) {
        reactFlowInstance.setCenter(collab.x, collab.y, { zoom: reactFlowInstance.getZoom(), duration: 500 });
      }
    },
    [collaborators, nodes, edges, reactFlowInstance]
  );

  const handleReloadLatest = useCallback(() => {
    if (!conflictDiagram) return;
    adoptDiagram(conflictDiagram);
    setConflictDiagramState(null);
  }, [conflictDiagram, adoptDiagram]);

  // Connect handler (ADMIN only)
  const onConnect = useCallback(
    (params: Connection) => {
      if (!user) {
        openLoginModal();
        return;
      }
      if (!canEdit) {
        setToastMessage('Viewer access is read-only. Duplicate this flow to make changes.');
        setTimeout(() => setToastMessage(null), 3000);
        return;
      }
      if (params.source === params.target) {
        setToastMessage('A node can’t connect to itself.');
        setTimeout(() => setToastMessage(null), 3000);
        return;
      }
      const isDuplicate = edges.some(
        (e) =>
          e.source === params.source &&
          e.target === params.target &&
          (e.sourceHandle || null) === (params.sourceHandle || null) &&
          (e.targetHandle || null) === (params.targetHandle || null)
      );
      if (isDuplicate) {
        setToastMessage('These two nodes are already connected on this handle pair.');
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
    [user, canEdit, openLoginModal, nodes, edges, defaultEdgeType, recordHistory, setEdges]
  );

  // Dragging an existing edge's endpoint onto a different handle (same node,
  // a different side, or a different node entirely) re-points that end
  // instead of requiring delete-and-recreate. React Flow renders the
  // draggable endpoint handles itself once `edgesReconnectable` and
  // `onReconnect` are wired up — same guards as onConnect above.
  const onReconnect = useCallback(
    (oldEdge: Edge, newConnection: Connection) => {
      if (!canEdit) return;
      if (newConnection.source === newConnection.target) {
        setToastMessage('A node can’t connect to itself.');
        setTimeout(() => setToastMessage(null), 3000);
        return;
      }
      const isDuplicate = edges.some(
        (e) =>
          e.id !== oldEdge.id &&
          e.source === newConnection.source &&
          e.target === newConnection.target &&
          (e.sourceHandle || null) === (newConnection.sourceHandle || null) &&
          (e.targetHandle || null) === (newConnection.targetHandle || null)
      );
      if (isDuplicate) {
        setToastMessage('These two nodes are already connected on this handle pair.');
        setTimeout(() => setToastMessage(null), 3000);
        return;
      }
      recordHistory(nodes, edges);
      setEdges((eds) => reconnectEdge(oldEdge, newConnection, eds));
    },
    [canEdit, nodes, edges, recordHistory, setEdges]
  );

  // Selection change
  const onSelectionChange = useCallback(
    (params: OnSelectionChangeParams) => {
      setSelectedNodes(params.nodes || []);
      setSelectedEdges(params.edges || []);
      // Presence only has room for one "currently selected" slot per person
      // (see broadcastSelection) — a multi-selection broadcasts as "nothing
      // selected" rather than picking one arbitrary item to lock for others.
      const isSingleSelection =
        (params.nodes?.length || 0) + (params.edges?.length || 0) === 1;
      if (params.nodes && params.nodes.length > 0) {
        setSelectedNode(params.nodes[0]);
        setSelectedEdge(null);
        setSelectedComment(null);
        broadcastSelection(isSingleSelection ? params.nodes[0].id : null, isSingleSelection ? 'node' : null);
      } else if (params.edges && params.edges.length > 0) {
        setSelectedEdge(params.edges[0]);
        setSelectedNode(null);
        setSelectedComment(null);
        broadcastSelection(isSingleSelection ? params.edges[0].id : null, isSingleSelection ? 'edge' : null);
      } else {
        setSelectedNode(null);
        setSelectedEdge(null);
        setSelectedComment(null);
        broadcastSelection(null, null);
      }
    },
    [broadcastSelection]
  );

  // Soft real-time lock: if what we just selected is already someone else's
  // current selection (per their broadcast presence data), release our own
  // selection immediately and say whose it is, instead of letting two
  // people edit the same node/edge at once. Reacts to `collaborators`
  // changing too, so this also catches the case where someone else selects
  // the thing we already have open.
  useEffect(() => {
    const lockedId = selectedNode?.id || selectedEdge?.id;
    if (!lockedId) return;
    const lockedType: 'node' | 'edge' = selectedNode ? 'node' : 'edge';
    const lockedBy = Object.values(collaborators).find(
      (c) => c.selectedId === lockedId && c.selectedType === lockedType
    );
    if (!lockedBy) return;

    // Deferred through a resolved promise: the lint rule here flags any
    // setState called synchronously in an effect body regardless of
    // legitimacy (reacting to presence data contesting our own selection is
    // exactly the "subscribe to an external system" case the rule means to
    // allow) — a microtask deferral satisfies it without any observable
    // behavior change, same pattern used elsewhere in this file.
    Promise.resolve().then(() => {
      setSelectedNode(null);
      setSelectedEdge(null);
      broadcastSelection(null, null);
      setToastMessage(`${lockedBy.name} has selected this ${lockedType}.`);
      setTimeout(() => setToastMessage(null), 3000);
    });
    // Only the identity of what's selected (and the presence data that
    // might contest it) should re-run this — not every reference change to
    // the objects themselves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNode?.id, selectedEdge?.id, collaborators]);

  // Selecting a row in the Layers panel: mirror the same selection state a
  // canvas click would produce (so the Properties tab reflects it too),
  // reflect `selected` on the node/edge itself so React Flow highlights it,
  // and pan/zoom so it's actually visible.
  const handleSelectFromLayers = useCallback(
    (nodeId: string) => {
      setNodes((nds) => nds.map((n) => ({ ...n, selected: n.id === nodeId })));
      setEdges((eds) => eds.map((e) => ({ ...e, selected: false })));
      const node = nodes.find((n) => n.id === nodeId) || null;
      setSelectedNode(node);
      setSelectedEdge(null);
      if (node) {
        reactFlowInstance.fitView({ nodes: [{ id: nodeId }], duration: 300, maxZoom: 1.25, padding: 0.5 });
      }
    },
    [nodes, setNodes, setEdges, reactFlowInstance]
  );

  const handleSelectEdgeFromLayers = useCallback(
    (edgeId: string) => {
      setEdges((eds) => eds.map((e) => ({ ...e, selected: e.id === edgeId })));
      setNodes((nds) => nds.map((n) => ({ ...n, selected: false })));
      const edge = edges.find((e) => e.id === edgeId) || null;
      setSelectedEdge(edge);
      setSelectedNode(null);
      if (edge) {
        reactFlowInstance.fitView({
          nodes: [{ id: edge.source }, { id: edge.target }],
          duration: 300,
          maxZoom: 1.25,
          padding: 0.5,
        });
      }
    },
    [edges, setNodes, setEdges, reactFlowInstance]
  );

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
      if (!canEdit) {
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
    [user, canEdit, openLoginModal, nodes, edges, reactFlowInstance, recordHistory, setNodes]
  );

  // One-click Add Node from Sidebar
  const handleAddNode = useCallback(
    (type: string, data: any) => {
      if (!user) {
        return;
      }
      if (!canEdit) {
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
    [user, canEdit, openLoginModal, nodes, edges, reactFlowInstance, recordHistory, setNodes]
  );

  // Update Node Data (Admin only)
  const handleUpdateNodeData = useCallback(
    (nodeId: string, newData: Record<string, any>) => {
      if (!canEdit) return;
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
    [canEdit, setNodes]
  );

  // Update a node's geometry (size/position) from the Properties panel's
  // Layout section — these live on the Node object itself (set by
  // NodeResizer / canvas dragging), not inside `data` like every other
  // field onUpdateNodeData touches, hence a separate handler.
  const handleUpdateNodeGeometry = useCallback(
    (nodeId: string, geometry: { width?: number; height?: number; x?: number; y?: number }) => {
      if (!canEdit) return;
      isDirtyRef.current = true;
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id !== nodeId) return node;
          const updated: Node = {
            ...node,
            ...(geometry.width !== undefined ? { width: geometry.width } : {}),
            ...(geometry.height !== undefined ? { height: geometry.height } : {}),
            position: {
              x: geometry.x !== undefined ? geometry.x : node.position.x,
              y: geometry.y !== undefined ? geometry.y : node.position.y,
            },
          };
          setSelectedNode(updated);
          return updated;
        })
      );
    },
    [canEdit, setNodes]
  );

  // Update Edge Data (Admin only)
  const handleUpdateEdgeData = useCallback(
    (edgeId: string, newData: Record<string, any>) => {
      if (!canEdit) return;
      isDirtyRef.current = true;
      setEdges((eds) =>
        eds.map((edge) => {
          if (edge.id === edgeId) {
            const mergedData = { ...edge.data, ...newData };
            const updated = { ...edge, data: mergedData, ...computeEdgeMarkers(mergedData) };
            setSelectedEdge(updated);
            return updated;
          }
          return edge;
        })
      );
    },
    [canEdit, setEdges]
  );

  // Bulk edge style edit — Path Curve, Animated, Line Pattern/Width/Color,
  // Line Type — applied to every selected edge at once. Connection Label is
  // deliberately never routed through here: it's per-edge content, edited
  // only in the single-edge view, same reasoning as node title/subtitle.
  const handleBulkUpdateEdgeData = useCallback(
    (ids: string[], patch: Record<string, any>) => {
      if (!canEdit || ids.length === 0) return;
      const idSet = new Set(ids);
      recordHistory(nodes, edges);
      setEdges((eds) =>
        eds.map((e) => {
          if (!idSet.has(e.id)) return e;
          const mergedData = { ...e.data, ...patch };
          return { ...e, data: mergedData, ...computeEdgeMarkers(mergedData) };
        })
      );
      isDirtyRef.current = true;
    },
    [canEdit, nodes, edges, recordHistory, setEdges]
  );

  // Move one end of an edge to a different side of the SAME node it's
  // already attached to — the Properties panel's explicit alternative to
  // dragging the edge endpoint on the canvas (which needs a precise grab of
  // a ~9px handle and isn't discoverable). `end` says which endpoint moves;
  // the node itself never changes here, only which of its 4 handles the
  // edge is anchored to.
  const handleMoveEdgeEndpoint = useCallback(
    (edgeId: string, end: 'source' | 'target', handleId: 'top' | 'bottom' | 'left' | 'right') => {
      if (!canEdit) return;
      const edge = edges.find((e) => e.id === edgeId);
      if (!edge) return;

      const nextSourceHandle = end === 'source' ? handleId : edge.sourceHandle;
      const nextTargetHandle = end === 'target' ? handleId : edge.targetHandle;
      if (nextSourceHandle === edge.sourceHandle && nextTargetHandle === edge.targetHandle) return;

      const isDuplicate = edges.some(
        (e) =>
          e.id !== edgeId &&
          e.source === edge.source &&
          e.target === edge.target &&
          (e.sourceHandle || null) === (nextSourceHandle || null) &&
          (e.targetHandle || null) === (nextTargetHandle || null)
      );
      if (isDuplicate) {
        setToastMessage('These two nodes are already connected on this handle pair.');
        setTimeout(() => setToastMessage(null), 3000);
        return;
      }

      recordHistory(nodes, edges);
      isDirtyRef.current = true;
      setEdges((eds) =>
        eds.map((e) => {
          if (e.id !== edgeId) return e;
          const updated = { ...e, sourceHandle: nextSourceHandle, targetHandle: nextTargetHandle };
          setSelectedEdge(updated);
          return updated;
        })
      );
    },
    [canEdit, nodes, edges, recordHistory, setEdges]
  );

  // Bulk version of handleMoveEdgeEndpoint: applies the same side to the
  // chosen endpoint (source or target) of every selected edge, each
  // relative to its own connected node — coherent even though the edges
  // connect entirely different node pairs. Edges that would land on a
  // duplicate connection are skipped individually rather than aborting the
  // whole batch, since one collision shouldn't block the rest.
  const handleBulkMoveEdgeEndpoint = useCallback(
    (ids: string[], end: 'source' | 'target', handleId: 'top' | 'bottom' | 'left' | 'right') => {
      if (!canEdit || ids.length === 0) return;
      const idSet = new Set(ids);
      recordHistory(nodes, edges);
      let skipped = 0;
      setEdges((eds) => {
        const next = eds.map((e) => {
          if (!idSet.has(e.id)) return e;
          const nextSourceHandle = end === 'source' ? handleId : e.sourceHandle;
          const nextTargetHandle = end === 'target' ? handleId : e.targetHandle;
          if (nextSourceHandle === e.sourceHandle && nextTargetHandle === e.targetHandle) return e;
          const isDuplicate = eds.some(
            (other) =>
              other.id !== e.id &&
              other.source === e.source &&
              other.target === e.target &&
              (other.sourceHandle || null) === (nextSourceHandle || null) &&
              (other.targetHandle || null) === (nextTargetHandle || null)
          );
          if (isDuplicate) {
            skipped += 1;
            return e;
          }
          return { ...e, sourceHandle: nextSourceHandle, targetHandle: nextTargetHandle };
        });
        return next;
      });
      isDirtyRef.current = true;
      if (skipped > 0) {
        setToastMessage(
          `${skipped} connection${skipped > 1 ? 's' : ''} skipped — would duplicate an existing connection.`
        );
        setTimeout(() => setToastMessage(null), 3000);
      }
    },
    [canEdit, nodes, edges, recordHistory, setEdges]
  );

  // Duplicate Node (Admin only)
  const handleDuplicateNode = useCallback(
    (nodeId: string) => {
      if (!canEdit) return;
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
    [canEdit, nodes, edges, recordHistory, setNodes]
  );

  // Delete Node (Admin only)
  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      if (!canEdit) return;
      recordHistory(nodes, edges);
      setNodes((nds) => nds.filter((n) => n.id !== nodeId));
      setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
      setSelectedNode(null);
    },
    [canEdit, nodes, edges, recordHistory, setNodes, setEdges]
  );

  // Delete Edge (Admin only)
  const handleDeleteEdge = useCallback(
    (edgeId: string) => {
      if (!canEdit) return;
      recordHistory(nodes, edges);
      setEdges((eds) => eds.filter((e) => e.id !== edgeId));
      setSelectedEdge(null);
    },
    [canEdit, nodes, edges, recordHistory, setEdges]
  );

  // Delete every selected edge by its own id (as opposed to
  // handleBulkDisconnectEdges, which deletes edges touching a set of
  // selected NODES) — the multi-edge selection's own "Delete N Connections"
  // action.
  const handleBulkDeleteEdges = useCallback(
    (ids: string[]) => {
      if (!canEdit || ids.length === 0) return;
      const idSet = new Set(ids);
      recordHistory(nodes, edges);
      setEdges((eds) => eds.filter((e) => !idSet.has(e.id)));
      setSelectedEdge(null);
      setSelectedEdges([]);
    },
    [canEdit, nodes, edges, recordHistory, setEdges]
  );

  // Comments are a lighter-weight permission than full editing — anyone
  // signed in who can at least view this diagram can leave one, same as
  // most collaborative tools let viewers comment without edit rights.
  // Editing an existing comment's text/style, though, is author-only (see
  // handleUpdateComment); deleting one is author-or-ADMIN (moderation).
  const canComment = !isTemplate && !!user;

  // Debounced comments-only autosave for viewers: canComment is a lower bar
  // than canEdit, so a viewer's comment/reply/resolve must persist through
  // the lighter comments-only save path — the full-diagram autosave further
  // up is canEdit-gated and would never fire for them.
  useEffect(() => {
    if (isTemplate || canEdit || !canComment) return;
    if (!commentsDirtyRef.current) return;
    commentSaveTimeoutRef.current = setTimeout(() => {
      saveDiagramComments(diagram.id, comments, diagramUpdatedAtRef.current).then((result) => {
        if (result.status === 'ok') {
          commentsDirtyRef.current = false;
          diagramUpdatedAtRef.current = result.diagram.updatedAt;
          setDiagram((prev) => ({ ...prev, comments: result.diagram.comments, updatedAt: result.diagram.updatedAt }));
        } else if (result.status === 'conflict') {
          setConflictDiagramState(result.latest);
        }
      });
    }, 600);

    return () => {
      if (commentSaveTimeoutRef.current) clearTimeout(commentSaveTimeoutRef.current);
    };
  }, [comments, diagram.id, canEdit, canComment, isTemplate]);

  const handleAddComment = useCallback(
    (x: number, y: number) => {
      if (!canComment || !user) return;
      const comment: DiagramComment = {
        id: `comment_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        x,
        y,
        text: '',
        authorId: user.id,
        authorName: user.name,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      isDirtyRef.current = true;
      commentsDirtyRef.current = true;
      setComments((prev) => [...prev, comment]);
      setSelectedNode(null);
      setSelectedEdge(null);
      setSelectedComment(comment);
      setCommentModeActive(false);
    },
    [canComment, user]
  );

  // Armed by the "Add Comment" toolbar toggle — the next click on the
  // canvas pane (not a node/edge, which have their own click handling)
  // drops a comment there and disarms itself, mirroring the one-shot
  // placement pattern most comment tools use instead of a persistent mode
  // toggle you have to remember to turn off.
  const handlePaneClick = useCallback(
    (event: React.MouseEvent) => {
      if (!commentModeActive) return;
      const flowPos = reactFlowInstance.screenToFlowPosition({ x: event.clientX, y: event.clientY });
      handleAddComment(flowPos.x, flowPos.y);
    },
    [commentModeActive, reactFlowInstance, handleAddComment]
  );

  const handleUpdateComment = useCallback(
    (id: string, patch: Partial<Pick<DiagramComment, 'text' | 'bgColor' | 'borderColor'>>) => {
      if (!user) return;
      isDirtyRef.current = true;
      commentsDirtyRef.current = true;
      setComments((prev) =>
        prev.map((c) => {
          // Author-only — not even the diagram ADMIN can edit someone
          // else's comment text, only delete it (moderation, below).
          if (c.id !== id || c.authorId !== user.id) return c;
          const updated = { ...c, ...patch, updatedAt: new Date().toISOString() };
          setSelectedComment(updated);
          return updated;
        })
      );
    },
    [user]
  );

  const handleDeleteComment = useCallback(
    (id: string) => {
      if (!user) return;
      const comment = comments.find((c) => c.id === id);
      if (!comment) return;
      if (comment.authorId !== user.id && !isAdmin) return;
      isDirtyRef.current = true;
      commentsDirtyRef.current = true;
      setComments((prev) => prev.filter((c) => c.id !== id));
      setSelectedComment(null);
    },
    [user, comments, isAdmin]
  );

  // Resolved/unresolved — same author-or-ADMIN permission as delete (it's a
  // moderation action, not content editing), unlike the comment's own
  // text/style which stays strictly author-only.
  const handleToggleCommentResolved = useCallback(
    (id: string) => {
      if (!user) return;
      isDirtyRef.current = true;
      commentsDirtyRef.current = true;
      setComments((prev) =>
        prev.map((c) => {
          if (c.id !== id) return c;
          if (c.authorId !== user.id && !isAdmin) return c;
          const updated = { ...c, resolved: !c.resolved, updatedAt: new Date().toISOString() };
          setSelectedComment(updated);
          return updated;
        })
      );
    },
    [user, isAdmin]
  );

  // Replies are open to anyone who can comment at all (not author-only like
  // the parent comment's own text) — each reply carries its own author, so
  // permission for editing/deleting one is evaluated per-reply, not
  // inherited from the parent comment.
  const handleAddCommentReply = useCallback(
    (commentId: string, text: string) => {
      if (!canComment || !user || !text.trim()) return;
      isDirtyRef.current = true;
      commentsDirtyRef.current = true;
      const reply = {
        id: `reply_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        text: text.trim(),
        authorId: user.id,
        authorName: user.name,
        createdAt: new Date().toISOString(),
      };
      setComments((prev) =>
        prev.map((c) => {
          if (c.id !== commentId) return c;
          const updated = { ...c, replies: [...(c.replies || []), reply] };
          setSelectedComment(updated);
          return updated;
        })
      );
    },
    [canComment, user]
  );

  const handleDeleteCommentReply = useCallback(
    (commentId: string, replyId: string) => {
      if (!user) return;
      isDirtyRef.current = true;
      commentsDirtyRef.current = true;
      setComments((prev) =>
        prev.map((c) => {
          if (c.id !== commentId) return c;
          const reply = (c.replies || []).find((r) => r.id === replyId);
          if (!reply || (reply.authorId !== user.id && !isAdmin)) return c;
          const updated = { ...c, replies: (c.replies || []).filter((r) => r.id !== replyId) };
          setSelectedComment(updated);
          return updated;
        })
      );
    },
    [user, isAdmin]
  );

  // Disconnect every edge touching a node (either as source or target),
  // leaving the node itself and every other node/edge untouched. Companion
  // to "Eject All Nodes" on a group: this frees up a single node so it can
  // be manually dragged and reconnected elsewhere without deleting it.
  const handleDisconnectNodeEdges = useCallback(
    (nodeId: string) => {
      if (!canEdit) return;
      const touching = edges.filter((e) => e.source === nodeId || e.target === nodeId);
      if (touching.length === 0) {
        setToastMessage('This node has no connections to disconnect.');
        setTimeout(() => setToastMessage(null), 2500);
        return;
      }
      recordHistory(nodes, edges);
      setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
      setToastMessage(
        `Disconnected ${touching.length} edge${touching.length > 1 ? 's' : ''} from this node.`
      );
      setTimeout(() => setToastMessage(null), 2500);
    },
    [canEdit, nodes, edges, recordHistory, setEdges]
  );

  // Bulk actions for a multi-selection — each is a single history entry and
  // a single state update, not a loop over the single-node handlers (which
  // would otherwise push N separate undo steps for one user action).
  const handleBulkSetBgColor = useCallback(
    (ids: string[], hex: string | undefined) => {
      if (!canEdit || ids.length === 0) return;
      const idSet = new Set(ids);
      recordHistory(nodes, edges);
      setNodes((nds) =>
        nds.map((n) => (idSet.has(n.id) ? { ...n, data: { ...n.data, bgColor: hex } } : n))
      );
      isDirtyRef.current = true;
    },
    [canEdit, nodes, edges, recordHistory, setNodes]
  );

  // Bulk style edit — everything in the Properties panel's shared "Style"
  // section (opacity, alignment, border, font) applied to every selected
  // node at once, same single-history/single-update shape as
  // handleBulkSetBgColor above.
  const handleBulkUpdateNodeData = useCallback(
    (ids: string[], patch: Record<string, any>) => {
      if (!canEdit || ids.length === 0) return;
      const idSet = new Set(ids);
      recordHistory(nodes, edges);
      setNodes((nds) =>
        nds.map((n) => (idSet.has(n.id) ? { ...n, data: { ...n.data, ...patch } } : n))
      );
      isDirtyRef.current = true;
    },
    [canEdit, nodes, edges, recordHistory, setNodes]
  );

  const handleBulkDelete = useCallback(
    (ids: string[]) => {
      if (!canEdit || ids.length === 0) return;
      const idSet = new Set(ids);
      recordHistory(nodes, edges);
      setNodes((nds) => nds.filter((n) => !idSet.has(n.id)));
      setEdges((eds) => eds.filter((e) => !idSet.has(e.source) && !idSet.has(e.target)));
      setSelectedNode(null);
      setSelectedNodes([]);
    },
    [canEdit, nodes, edges, recordHistory, setNodes, setEdges]
  );

  const handleBulkDisconnectEdges = useCallback(
    (ids: string[]) => {
      if (!canEdit || ids.length === 0) return;
      const idSet = new Set(ids);
      const touching = edges.filter((e) => idSet.has(e.source) || idSet.has(e.target));
      if (touching.length === 0) {
        setToastMessage('None of the selected nodes have connections to disconnect.');
        setTimeout(() => setToastMessage(null), 2500);
        return;
      }
      recordHistory(nodes, edges);
      setEdges((eds) => eds.filter((e) => !idSet.has(e.source) && !idSet.has(e.target)));
      setToastMessage(
        `Disconnected ${touching.length} edge${touching.length > 1 ? 's' : ''} from the selected nodes.`
      );
      setTimeout(() => setToastMessage(null), 2500);
    },
    [canEdit, nodes, edges, recordHistory, setEdges]
  );

  const handleUndo = useCallback(() => {
    if (!canEdit) return;
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
  }, [canEdit, history, nodes, edges, setNodes, setEdges]);

  const handleRedo = useCallback(() => {
    if (!canEdit) return;
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
  }, [canEdit, future, nodes, edges, setNodes, setEdges]);

  // Copy/paste, backed by localStorage rather than component state — this
  // is what makes it work *across* diagrams (copy in one tab, open a
  // different diagram, paste there), not just within one. pasteCountRef
  // cascades repeated pastes of the same clipboard diagonally instead of
  // stacking them exactly on top of each other; a fresh copy resets it.
  const CLIPBOARD_KEY = 'flowcraft:clipboard';
  const pasteCountRef = useRef(0);

  const handleCopySelection = useCallback(() => {
    if (selectedNodes.length === 0) return;
    const ids = new Set(selectedNodes.map((n) => n.id));
    const copiedEdges = edges.filter((e) => ids.has(e.source) && ids.has(e.target));
    try {
      localStorage.setItem(CLIPBOARD_KEY, JSON.stringify({ nodes: selectedNodes, edges: copiedEdges }));
      pasteCountRef.current = 0;
      setToastMessage(`Copied ${selectedNodes.length} node${selectedNodes.length > 1 ? 's' : ''}.`);
      setTimeout(() => setToastMessage(null), 2000);
    } catch {
      // localStorage unavailable (private browsing, quota) — nothing to do
    }
  }, [selectedNodes, edges]);

  const handlePasteClipboard = useCallback(() => {
    if (!canEdit) return;
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(CLIPBOARD_KEY);
    } catch {
      return;
    }
    if (!raw) return;

    let parsed: { nodes: Node[]; edges: Edge[] } | null = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }
    if (!parsed || !Array.isArray(parsed.nodes) || parsed.nodes.length === 0) return;

    pasteCountRef.current += 1;
    const offset = 40 * pasteCountRef.current;
    const idMap = new Map<string, string>();
    const newNodes: Node[] = parsed.nodes.map((n) => {
      const newId = `node_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      idMap.set(n.id, newId);
      return {
        ...n,
        id: newId,
        position: { x: n.position.x + offset, y: n.position.y + offset },
        selected: true,
      };
    });
    const newEdges: Edge[] = (parsed.edges || [])
      .filter((e) => idMap.has(e.source) && idMap.has(e.target))
      .map((e) => ({
        ...e,
        id: `e_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        source: idMap.get(e.source)!,
        target: idMap.get(e.target)!,
      }));

    recordHistory(nodes, edges);
    setNodes((nds) => [...nds.map((n) => ({ ...n, selected: false })), ...newNodes]);
    setEdges((eds) => [...eds, ...newEdges]);
    setSelectedNodes(newNodes);
    setSelectedNode(newNodes[0] || null);
    setToastMessage(`Pasted ${newNodes.length} node${newNodes.length > 1 ? 's' : ''}.`);
    setTimeout(() => setToastMessage(null), 2000);
  }, [canEdit, nodes, edges, recordHistory, setNodes, setEdges]);

  // Keyboard Shortcuts (Admin only)
  useEffect(() => {
    if (!canEdit) return;

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
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'c') {
        if (selectedNodes.length > 0) {
          e.preventDefault();
          handleCopySelection();
        }
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'v') {
        e.preventDefault();
        handlePasteClipboard();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedNodes.length > 1) {
          e.preventDefault();
          handleBulkDelete(selectedNodes.map((n) => n.id));
        } else if (selectedNode) {
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
  }, [
    canEdit,
    handleUndo,
    handleRedo,
    selectedNode,
    selectedEdge,
    selectedNodes,
    handleDeleteNode,
    handleDeleteEdge,
    handleBulkDelete,
    handleCopySelection,
    handlePasteClipboard,
  ]);

  // Auto Layout (Admin only)
  const handleAutoLayout = useCallback(() => {
    if (!canEdit) {
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
  }, [canEdit, nodes, edges, recordHistory, setNodes, reactFlowInstance]);

  // Eject every node currently sitting inside a Group/Container box out to a
  // free row underneath it, so they can be individually dragged elsewhere.
  // Group nodes here are a purely visual dashed box (no real parentId /
  // containment in this data model) — "inside" just means positionally
  // overlapping the group's rectangle. This only ever touches node
  // `position`; the edges array is never read or written, so every
  // connection a node has — to something inside or outside the group —
  // survives untouched.
  // Standard diagram-tool alignment/distribution/match-size toolbar, for
  // when 2+ nodes are selected. Reads width/height off whichever the node
  // actually has — an explicit top-level size (set by dragging a
  // NodeResizer handle) if present, else React Flow's own measured render
  // size, else a reasonable fallback for a node that's never been measured.
  const getNodeSize = useCallback((node: Node) => {
    return {
      width: node.width || node.measured?.width || 200,
      height: node.height || node.measured?.height || 100,
    };
  }, []);

  // Smart alignment guides: while dragging a node, check its edges/center
  // against every other node's edges/center (in flow coordinates, so this
  // works regardless of zoom); anything within SNAP_THRESHOLD gets both a
  // guide line (rendered by AlignmentGuides, via the guides state) and an
  // actual snap of the dragged node's position to match exactly. Only ever
  // considers the single node being dragged — multi-node drag doesn't get
  // guides, which covers the overwhelmingly common case without the added
  // complexity of guiding a whole group's bounding box.
  const SNAP_THRESHOLD = 6;
  const [guides, setGuides] = useState<{ vertical: number[]; horizontal: number[] }>({
    vertical: [],
    horizontal: [],
  });

  const getNodeBounds = useCallback(
    (node: Node) => {
      const { width, height } = getNodeSize(node);
      return {
        left: node.position.x,
        right: node.position.x + width,
        centerX: node.position.x + width / 2,
        top: node.position.y,
        bottom: node.position.y + height,
        centerY: node.position.y + height / 2,
      };
    },
    [getNodeSize]
  );

  const onNodeDrag = useCallback(
    (_event: MouseEvent | TouchEvent, draggedNode: Node) => {
      if (!canEdit) return;
      const bounds = getNodeBounds(draggedNode);
      const others = nodes.filter((n) => n.id !== draggedNode.id);

      let snapX: number | null = null;
      let snapY: number | null = null;
      const vGuides = new Set<number>();
      const hGuides = new Set<number>();

      for (const other of others) {
        const ob = getNodeBounds(other);
        for (const myVal of [bounds.left, bounds.centerX, bounds.right]) {
          for (const otherVal of [ob.left, ob.centerX, ob.right]) {
            if (Math.abs(myVal - otherVal) <= SNAP_THRESHOLD) {
              vGuides.add(otherVal);
              if (snapX === null) snapX = draggedNode.position.x + (otherVal - myVal);
            }
          }
        }
        for (const myVal of [bounds.top, bounds.centerY, bounds.bottom]) {
          for (const otherVal of [ob.top, ob.centerY, ob.bottom]) {
            if (Math.abs(myVal - otherVal) <= SNAP_THRESHOLD) {
              hGuides.add(otherVal);
              if (snapY === null) snapY = draggedNode.position.y + (otherVal - myVal);
            }
          }
        }
      }

      setGuides({ vertical: Array.from(vGuides), horizontal: Array.from(hGuides) });

      if (snapX !== null || snapY !== null) {
        setNodes((nds) =>
          nds.map((n) =>
            n.id === draggedNode.id
              ? { ...n, position: { x: snapX ?? n.position.x, y: snapY ?? n.position.y } }
              : n
          )
        );
      }
    },
    [canEdit, nodes, getNodeBounds, setNodes]
  );

  const onNodeDragStop = useCallback(() => {
    setGuides({ vertical: [], horizontal: [] });
  }, []);

  const handleAlign = useCallback(
    (mode: 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom') => {
      if (!canEdit || selectedNodes.length < 2) return;
      const ids = new Set(selectedNodes.map((n) => n.id));
      recordHistory(nodes, edges);
      setNodes((nds) => {
        const targets = nds.filter((n) => ids.has(n.id));
        const isHorizontal = mode === 'left' || mode === 'hcenter' || mode === 'right';

        let refValue: number;
        if (mode === 'left') {
          refValue = Math.min(...targets.map((n) => n.position.x));
        } else if (mode === 'right') {
          refValue = Math.max(...targets.map((n) => n.position.x + getNodeSize(n).width));
        } else if (mode === 'top') {
          refValue = Math.min(...targets.map((n) => n.position.y));
        } else if (mode === 'bottom') {
          refValue = Math.max(...targets.map((n) => n.position.y + getNodeSize(n).height));
        } else {
          // hcenter / vcenter: midpoint of the selection's overall bounding box
          const coord = isHorizontal ? 'x' : 'y';
          const size = isHorizontal ? 'width' : 'height';
          const min = Math.min(...targets.map((n) => n.position[coord]));
          const max = Math.max(...targets.map((n) => n.position[coord] + getNodeSize(n)[size]));
          refValue = (min + max) / 2;
        }

        return nds.map((n) => {
          if (!ids.has(n.id)) return n;
          const { width, height } = getNodeSize(n);
          const position = { ...n.position };
          if (mode === 'left') position.x = refValue;
          else if (mode === 'right') position.x = refValue - width;
          else if (mode === 'hcenter') position.x = refValue - width / 2;
          else if (mode === 'top') position.y = refValue;
          else if (mode === 'bottom') position.y = refValue - height;
          else if (mode === 'vcenter') position.y = refValue - height / 2;
          return { ...n, position };
        });
      });
      isDirtyRef.current = true;
    },
    [canEdit, selectedNodes, nodes, edges, recordHistory, setNodes, getNodeSize]
  );

  const handleDistribute = useCallback(
    (axis: 'horizontal' | 'vertical') => {
      if (!canEdit || selectedNodes.length < 3) return;
      const ids = new Set(selectedNodes.map((n) => n.id));
      recordHistory(nodes, edges);
      setNodes((nds) => {
        const coord = axis === 'horizontal' ? 'x' : 'y';
        const sizeKey = axis === 'horizontal' ? 'width' : 'height';
        const targets = nds
          .filter((n) => ids.has(n.id))
          .slice()
          .sort((a, b) => a.position[coord] - b.position[coord]);

        const first = targets[0];
        const last = targets[targets.length - 1];
        const totalSpan =
          last.position[coord] + getNodeSize(last)[sizeKey] - first.position[coord];
        const totalSize = targets.reduce((sum, n) => sum + getNodeSize(n)[sizeKey], 0);
        const gap = (totalSpan - totalSize) / (targets.length - 1);

        const nextCoord = new Map<string, number>();
        let cursor = first.position[coord];
        targets.forEach((n) => {
          nextCoord.set(n.id, cursor);
          cursor += getNodeSize(n)[sizeKey] + gap;
        });

        return nds.map((n) => {
          const value = nextCoord.get(n.id);
          if (value === undefined) return n;
          return { ...n, position: { ...n.position, [coord]: value } };
        });
      });
      isDirtyRef.current = true;
    },
    [canEdit, selectedNodes, nodes, edges, recordHistory, setNodes, getNodeSize]
  );

  const handleMatchSize = useCallback(
    (dimension: 'width' | 'height') => {
      if (!canEdit || selectedNodes.length < 2) return;
      const ids = new Set(selectedNodes.map((n) => n.id));
      const refSize = getNodeSize(selectedNodes[0]);
      recordHistory(nodes, edges);
      setNodes((nds) =>
        nds.map((n) =>
          ids.has(n.id) ? { ...n, [dimension]: dimension === 'width' ? refSize.width : refSize.height } : n
        )
      );
      isDirtyRef.current = true;
    },
    [canEdit, selectedNodes, nodes, edges, recordHistory, setNodes, getNodeSize]
  );

  const handleEjectGroupNodes = useCallback(
    (groupId: string) => {
      if (!canEdit) return;
      const group = nodes.find((n) => n.id === groupId);
      if (!group || group.type !== 'groupNode') return;

      const gx = group.position.x;
      const gy = group.position.y;
      const gw = group.width || group.measured?.width || 280;
      const gh = group.height || group.measured?.height || 180;

      const contained = nodes.filter((n) => {
        if (n.id === groupId || n.type === 'groupNode') return false;
        const nw = n.width || n.measured?.width || 200;
        const nh = n.height || n.measured?.height || 100;
        const cx = n.position.x + nw / 2;
        const cy = n.position.y + nh / 2;
        return cx >= gx && cx <= gx + gw && cy >= gy && cy <= gy + gh;
      });

      if (contained.length === 0) {
        setToastMessage('No nodes are currently inside this group.');
        setTimeout(() => setToastMessage(null), 3000);
        return;
      }

      recordHistory(nodes, edges);

      const spacing = 40;
      const newY = gy + gh + 60;
      let cursorX = gx;
      const nextPositions = new Map<string, { x: number; y: number }>();
      contained.forEach((n) => {
        const nw = n.width || n.measured?.width || 200;
        nextPositions.set(n.id, { x: cursorX, y: newY });
        cursorX += nw + spacing;
      });

      setNodes((nds) =>
        nds.map((n) => {
          const pos = nextPositions.get(n.id);
          return pos ? { ...n, position: pos, selected: false } : n;
        })
      );
      setToastMessage(
        `Ejected ${contained.length} node${contained.length > 1 ? 's' : ''} from the group — drag to reconnect elsewhere.`
      );
      setTimeout(() => setToastMessage(null), 3500);
    },
    [canEdit, nodes, edges, recordHistory, setNodes]
  );

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
    // Export the live canvas state (nodes/edges currently in memory), not a
    // server round-trip — the server copy can lag behind unsaved edits.
    const exportable: Diagram = { ...diagram, nodes, edges };
    const json = JSON.stringify(exportable, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.download = `${diagram.title.toLowerCase().replace(/\s+/g, '_')}.json`;
    a.href = url;
    a.click();
    URL.revokeObjectURL(url);
  }, [diagram, nodes, edges]);

  const commandPaletteActions: CommandPaletteAction[] = useMemo(
    () => [
      { id: 'save-now', label: 'Save this version', onRun: handleSaveNow },
      { id: 'tidy-layout', label: 'Tidy layout', onRun: handleAutoLayout },
      { id: 'toggle-left-sidebar', label: 'Toggle left sidebar', onRun: () => setLeftVisible((v) => !v) },
      { id: 'toggle-right-sidebar', label: 'Toggle right panel', onRun: () => setRightVisible((v) => !v) },
      { id: 'export-png', label: 'Export as PNG', onRun: handleExportPNG },
      { id: 'export-svg', label: 'Export as SVG', onRun: handleExportSVG },
      { id: 'export-json', label: 'Export as JSON', onRun: handleExportJSON },
      { id: 'back-to-dashboard', label: 'Back to Dashboard', onRun: () => router.push('/') },
    ],
    [handleSaveNow, handleAutoLayout, handleExportPNG, handleExportSVG, handleExportJSON, router]
  );

  const handleImportJSON = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const text = e.target?.result as string;
          const imported = await importDiagramJSON(text, user?.id);
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
    if (node.type === 'imageNode') return '#a855f7';
    return '#94a3b8';
  }, []);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-50">
      {/* Top Header Toolbar */}
      <EditorHeader
        diagram={diagram}
        collaborators={collaborators}
        onUpdateTitle={(title) => {
          if (!canEdit) return;
          setDiagram((d) => ({ ...d, title }));
        }}
        onUpdateCategory={(category) => {
          if (!canEdit) return;
          setDiagram((d) => ({ ...d, category }));
        }}
        isSaving={isSaving}
        onSaveNow={handleSaveNow}
        canSaveNow={canEdit && !isTemplate}
        canUndo={canEdit && history.length > 0}
        canRedo={canEdit && future.length > 0}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onZoomIn={() => reactFlowInstance.zoomIn({ duration: 250 })}
        onZoomOut={() => reactFlowInstance.zoomOut({ duration: 250 })}
        onFitView={() => reactFlowInstance.fitView({ padding: 0.2, duration: 400 })}
        onAutoLayout={handleAutoLayout}
        gridType={gridType}
        onChangeGridType={(t) => {
          isDirtyRef.current = true;
          setGridType(t);
        }}
        gridGap={gridGap}
        onChangeGridGap={(gap) => {
          isDirtyRef.current = true;
          setGridGap(gap);
        }}
        gridSize={gridSize}
        onChangeGridSize={(size) => {
          isDirtyRef.current = true;
          setGridSize(size);
        }}
        defaultEdgeType={defaultEdgeType}
        onChangeDefaultEdgeType={(t) => {
          isDirtyRef.current = true;
          setDefaultEdgeType(t);
        }}
        onExportPNG={handleExportPNG}
        onExportSVG={handleExportSVG}
        onExportJSON={handleExportJSON}
        onImportJSON={handleImportJSON}
        onOpenAiModal={() => setIsAiModalOpen(true)}
        commentModeActive={commentModeActive}
        onToggleCommentMode={() => setCommentModeActive((v) => !v)}
        hideResolvedComments={hideResolvedComments}
        onToggleHideResolvedComments={() => setHideResolvedComments((v) => !v)}
        onJumpToCollaborator={handleJumpToCollaborator}
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
            onClick={async () => {
              if (!user) {
                openLoginModal();
                return;
              }
              const cloned = await duplicateDiagram(diagram.id, user.id);
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
            onClick={async () => {
              if (!user) {
                openLoginModal();
                return;
              }
              const cloned = await duplicateDiagram(diagram.id, user.id);
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
      {canEdit && conflictDiagram && (
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
        {leftVisible && (
          <div style={{ width: leftWidth, flexShrink: 0 }} className="h-full">
            <SidebarPalette
              onAddNode={handleAddNode}
              defaultCategory={diagram.category}
              readOnly={!canEdit}
            />
          </div>
        )}

        {/* Left resize handle + collapse toggle */}
        <div
          onMouseDown={leftVisible ? startResize('left') : undefined}
          className={`w-3 shrink-0 h-full relative z-30 group flex items-center justify-center ${
            leftVisible ? 'cursor-col-resize' : ''
          }`}
          title={leftVisible ? 'Drag to resize' : undefined}
        >
          <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-slate-200 group-hover:bg-blue-400 group-active:bg-blue-500 transition-colors" />
          <button
            onClick={(e) => {
              e.stopPropagation();
              setLeftVisible((v) => !v);
            }}
            onMouseDown={(e) => e.stopPropagation()}
            className="absolute top-1/2 -translate-y-1/2 w-5 h-9 rounded-md bg-white border border-slate-200 shadow-xs flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors z-40 cursor-pointer"
            title={leftVisible ? 'Hide left sidebar' : 'Show left sidebar'}
          >
            {leftVisible ? <PanelLeftClose className="w-3.5 h-3.5" /> : <PanelLeftOpen className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Center React Flow Canvas */}
        <div
          ref={reactFlowWrapper}
          className={`flex-1 h-full w-full relative ${commentModeActive ? 'cursor-crosshair' : ''}`}
          onMouseMove={handleCanvasMouseMove}
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={canEdit ? onNodesChangeTracked : undefined}
            onEdgesChange={canEdit ? onEdgesChangeTracked : undefined}
            onConnect={onConnect}
            onReconnect={onReconnect}
            edgesReconnectable={canEdit}
            // Every node's Handle is hardcoded per side as either 'source'
            // (right/bottom) or 'target' (top/left) — see the node
            // components. React Flow's default 'strict' connectionMode only
            // lets a drag START from a 'source' handle and END on a
            // 'target' one, so starting a connection from a top or left
            // handle (both 'target') silently failed no matter what side
            // it was dropped on. 'loose' drops that pairing requirement:
            // any handle can start or end a connection, on any side.
            connectionMode={ConnectionMode.Loose}
            onNodeDrag={onNodeDrag}
            onNodeDragStop={onNodeDragStop}
            onPaneClick={handlePaneClick}
            nodesDraggable={canEdit}
            nodesConnectable={canEdit}
            elementsSelectable={true}
            // React Flow's default multiSelectionKeyCode is 'Meta' alone —
            // the Windows/Linux key, not Ctrl, which is what everyone on
            // those platforms actually reaches for. Accepting either lets
            // Ctrl+click (Win/Linux) and Cmd+click (Mac) both add a node to
            // the selection; dragging any selected node then moves the
            // whole group together, which is React Flow's built-in behavior
            // once multiple nodes are selected — no extra drag logic needed.
            multiSelectionKeyCode={['Meta', 'Control']}
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
                gap={gridGap}
                size={gridSize}
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

          {canEdit && (
            <AlignmentToolbar
              count={selectedNodes.length}
              onAlign={handleAlign}
              onDistribute={handleDistribute}
              onMatchSize={handleMatchSize}
            />
          )}

          {/* Discoverability hint for multi-select — the alignment toolbar
              above only appears once 2+ nodes are already selected, so
              without this there's no on-canvas clue the gesture exists at
              all. Hidden as soon as something is selected or the canvas is
              too sparse for it to matter. */}
          {canEdit && selectedNodes.length === 0 && nodes.length >= 2 && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
              <div className="flex items-center gap-1.5 bg-white/90 border border-slate-200 rounded-full shadow-xs px-3 py-1 text-[11px] text-slate-500">
                <kbd className="px-1 py-0.5 rounded bg-slate-100 border border-slate-200 font-mono text-[10px]">
                  Shift
                </kbd>
                <span>+ drag, or</span>
                <kbd className="px-1 py-0.5 rounded bg-slate-100 border border-slate-200 font-mono text-[10px]">
                  Ctrl/⌘
                </kbd>
                <span>+ click to select multiple, then drag any of them together</span>
              </div>
            </div>
          )}

          <CollaboratorCursors collaborators={collaborators} />
          <CollaboratorSelections collaborators={collaborators} nodes={nodes} edges={edges} />
          <CommentPins
            comments={hideResolvedComments ? comments.filter((c) => !c.resolved) : comments}
            selectedCommentId={selectedComment?.id || null}
            onSelect={(comment) => {
              setSelectedNode(null);
              setSelectedEdge(null);
              setSelectedComment(comment);
              broadcastSelection(null, null);
            }}
          />

          <AlignmentGuides vertical={guides.vertical} horizontal={guides.horizontal} />

          {canEdit && nodes.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
              <div className="text-center max-w-xs px-6 py-8 rounded-2xl border-2 border-dashed border-slate-200 bg-white/60">
                <p className="text-sm font-semibold text-slate-500">This diagram is empty</p>
                <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                  Drag a shape from the left sidebar onto the canvas, or press{' '}
                  <kbd className="px-1 py-0.5 rounded bg-slate-100 border border-slate-200 font-mono text-[10px]">
                    Ctrl/⌘+K
                  </kbd>{' '}
                  for quick actions.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Right resize handle + collapse toggle */}
        <div
          onMouseDown={rightVisible ? startResize('right') : undefined}
          className={`w-3 shrink-0 h-full relative z-30 group flex items-center justify-center ${
            rightVisible ? 'cursor-col-resize' : ''
          }`}
          title={rightVisible ? 'Drag to resize' : undefined}
        >
          <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-slate-200 group-hover:bg-blue-400 group-active:bg-blue-500 transition-colors" />
          <button
            onClick={(e) => {
              e.stopPropagation();
              setRightVisible((v) => !v);
            }}
            onMouseDown={(e) => e.stopPropagation()}
            className="absolute top-1/2 -translate-y-1/2 w-5 h-9 rounded-md bg-white border border-slate-200 shadow-xs flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors z-40 cursor-pointer"
            title={rightVisible ? 'Hide right panel' : 'Show right panel'}
          >
            {rightVisible ? (
              <PanelRightClose className="w-3.5 h-3.5" />
            ) : (
              <PanelRightOpen className="w-3.5 h-3.5" />
            )}
          </button>
        </div>

        {/* Right Properties Panel */}
        {rightVisible && (
          <div style={{ width: rightWidth, flexShrink: 0 }} className="h-full">
            <PropertiesPanel
              selectedNode={selectedNode}
              selectedEdge={selectedEdge}
              nodes={nodes}
              edges={edges}
              onUpdateNodeData={handleUpdateNodeData}
              onUpdateNodeGeometry={handleUpdateNodeGeometry}
              onUpdateEdgeData={handleUpdateEdgeData}
              onMoveEdgeEndpoint={handleMoveEdgeEndpoint}
              onDuplicateNode={handleDuplicateNode}
              onDeleteNode={handleDeleteNode}
              onDeleteEdge={handleDeleteEdge}
              onSelectNode={handleSelectFromLayers}
              onSelectEdge={handleSelectEdgeFromLayers}
              onEjectGroupNodes={handleEjectGroupNodes}
              onDisconnectNodeEdges={handleDisconnectNodeEdges}
              selectedNodes={selectedNodes}
              selectedEdges={selectedEdges}
              onBulkSetBgColor={handleBulkSetBgColor}
              onBulkUpdateNodeData={handleBulkUpdateNodeData}
              onBulkUpdateEdgeData={handleBulkUpdateEdgeData}
              onBulkMoveEdgeEndpoint={handleBulkMoveEdgeEndpoint}
              onBulkDeleteEdges={handleBulkDeleteEdges}
              onBulkDelete={handleBulkDelete}
              onBulkDisconnectEdges={handleBulkDisconnectEdges}
              nodeCount={nodes.length}
              edgeCount={edges.length}
              readOnly={!canEdit}
              diagramId={diagram.id}
              selectedComment={selectedComment}
              currentUserId={user?.id}
              isDiagramAdmin={isAdmin}
              onUpdateComment={handleUpdateComment}
              onDeleteComment={handleDeleteComment}
              onToggleCommentResolved={handleToggleCommentResolved}
              canComment={canComment}
              onAddCommentReply={handleAddCommentReply}
              onDeleteCommentReply={handleDeleteCommentReply}
              onRestored={() => {
                fetchLatestFromServer(diagram.id).then((latest) => {
                  if (latest) adoptDiagram(latest);
                });
              }}
            />
          </div>
        )}
      </div>

      <CommandPalette actions={commandPaletteActions} />

      {canEdit && (
        <AiAssistantModal
          isOpen={isAiModalOpen}
          onClose={() => setIsAiModalOpen(false)}
          diagram={diagram}
          nodes={nodes}
          edges={edges}
          activeCollaboratorNames={Object.values(collaborators).map((c) => c.name)}
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
      setLoading(true);
      // Always the server's current copy — no local cache to fall back to
      // or go stale.
      const serverDiagram = await getDiagram(id);
      if (isMounted) {
        setDiagram(serverDiagram);
        setLoading(false);
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
        copy arrives (e.g. a reload-latest action after a conflict).
        FlowEditorCanvas seeds its
        nodes/edges from initialDiagram exactly once via useState — without
        this key, a fresher diagram fetched after mount would never reach
        the canvas, and its stale in-memory nodes could autosave back over
        newer edits made elsewhere (see lib/storage.ts saveDiagram).
      */}
      <FlowEditorCanvas key={diagram.updatedAt} initialDiagram={diagram} />
    </ReactFlowProvider>
  );
}
