import { Diagram, Node } from '@/types/diagram';

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

// Every node type names itself differently (SystemNodeData.title,
// FlowchartNodeData/GroupNodeData.label, ERTableNodeData.tableName,
// StickyNodeData.title) — this tries them in a sensible order rather than
// requiring the caller to know which shape a given node's data is.
function nodeLabel(node: Node): string {
  const data = (node.data || {}) as Record<string, unknown>;
  const name = data.title || data.label || data.tableName;
  return typeof name === 'string' && name.trim() ? name.trim() : 'Untitled node';
}

// Renders a set of node names as "A", "A and B", "A, B and 1 more" — used so
// an activity entry can say which nodes changed instead of just how many,
// which is what actually lets someone pick the right version to restore.
function namesList(nodes: Node[], max: number = 2): string {
  const names = nodes.map(nodeLabel);
  if (names.length <= max) {
    return names.length <= 1
      ? names.join('')
      : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  }
  const shown = names.slice(0, max);
  const rest = names.length - max;
  return `${shown.join(', ')} and ${plural(rest, 'more')}`;
}

// Cheap structural diff between two diagram states, used to give each
// activity/version entry a human-readable description instead of just
// "updated this diagram" — naming what actually changed (by node name where
// possible) rather than a bare count, since a count alone doesn't tell
// anyone which version to restore to.
export function summarizeDiagramChange(existing: Diagram | null, updated: Diagram): string {
  if (!existing) {
    const nodeCount = updated.nodes?.length || 0;
    const edgeCount = updated.edges?.length || 0;
    return `created diagram with ${plural(nodeCount, 'node')}, ${plural(edgeCount, 'edge')}`;
  }

  const parts: string[] = [];

  const existingNodes = existing.nodes || [];
  const updatedNodes = updated.nodes || [];
  const existingNodeById = new Map(existingNodes.map((n) => [n.id, n]));
  const updatedNodeIds = new Set(updatedNodes.map((n) => n.id));

  const addedNodes = updatedNodes.filter((n) => !existingNodeById.has(n.id));
  const removedNodes = existingNodes.filter((n) => !updatedNodeIds.has(n.id));

  const movedNodes: Node[] = [];
  const editedNodes: Node[] = [];
  for (const node of updatedNodes) {
    const prev = existingNodeById.get(node.id);
    if (!prev) continue;
    const moved = prev.position?.x !== node.position?.x || prev.position?.y !== node.position?.y;
    const dataChanged = JSON.stringify(prev.data) !== JSON.stringify(node.data);
    if (moved) movedNodes.push(node);
    if (dataChanged) editedNodes.push(node);
  }

  if (addedNodes.length) parts.push(`added ${namesList(addedNodes)}`);
  if (removedNodes.length) parts.push(`removed ${namesList(removedNodes)}`);
  if (editedNodes.length) parts.push(`edited ${namesList(editedNodes)}`);
  if (movedNodes.length) parts.push(`moved ${namesList(movedNodes)}`);

  const existingEdges = existing.edges || [];
  const updatedEdges = updated.edges || [];
  const existingEdgeIds = new Set(existingEdges.map((e) => e.id));
  const updatedEdgeIds = new Set(updatedEdges.map((e) => e.id));
  const addedEdges = updatedEdges.filter((e) => !existingEdgeIds.has(e.id));
  const removedEdges = existingEdges.filter((e) => !updatedEdgeIds.has(e.id));

  if (addedEdges.length) parts.push(`+${plural(addedEdges.length, 'connection')}`);
  if (removedEdges.length) parts.push(`-${plural(removedEdges.length, 'connection')}`);

  if (existing.title !== updated.title) {
    parts.push(`renamed "${existing.title}" to "${updated.title}"`);
  }

  const existingCommentCount = existing.comments?.length || 0;
  const updatedCommentCount = updated.comments?.length || 0;
  if (updatedCommentCount > existingCommentCount) {
    parts.push(updatedCommentCount - existingCommentCount === 1 ? 'added a comment' : 'added comments');
  } else if (updatedCommentCount < existingCommentCount) {
    parts.push('removed a comment');
  } else if (updatedCommentCount > 0 && JSON.stringify(existing.comments) !== JSON.stringify(updated.comments)) {
    parts.push('updated a comment');
  }

  return parts.length > 0 ? parts.join(', ') : 'updated this diagram';
}
