import { Diagram } from '@/types/diagram';

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

// Cheap structural diff between two diagram states, used to give each
// activity/version entry a human-readable description instead of just
// "updated this diagram". Deliberately coarse (counts, not a real diff) —
// good enough to scan a history list, not a substitute for opening the
// version itself.
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

  let movedCount = 0;
  let editedCount = 0;
  for (const node of updatedNodes) {
    const prev = existingNodeById.get(node.id);
    if (!prev) continue;
    const moved = prev.position?.x !== node.position?.x || prev.position?.y !== node.position?.y;
    const dataChanged = JSON.stringify(prev.data) !== JSON.stringify(node.data);
    if (moved) movedCount++;
    if (dataChanged) editedCount++;
  }

  if (addedNodes.length) parts.push(`+${plural(addedNodes.length, 'node')}`);
  if (removedNodes.length) parts.push(`-${plural(removedNodes.length, 'node')}`);
  if (editedCount) parts.push(`${plural(editedCount, 'node')} edited`);
  if (movedCount) parts.push(`${plural(movedCount, 'node')} moved`);

  const existingEdges = existing.edges || [];
  const updatedEdges = updated.edges || [];
  const existingEdgeIds = new Set(existingEdges.map((e) => e.id));
  const updatedEdgeIds = new Set(updatedEdges.map((e) => e.id));
  const addedEdges = updatedEdges.filter((e) => !existingEdgeIds.has(e.id));
  const removedEdges = existingEdges.filter((e) => !updatedEdgeIds.has(e.id));

  if (addedEdges.length) parts.push(`+${plural(addedEdges.length, 'edge')}`);
  if (removedEdges.length) parts.push(`-${plural(removedEdges.length, 'edge')}`);

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
