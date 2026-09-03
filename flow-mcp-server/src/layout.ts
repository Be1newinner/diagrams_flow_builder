import { DiagramNode, DiagramEdge } from './types.js';

export function tidyLayout(nodes: DiagramNode[], edges: DiagramEdge[]): DiagramNode[] {
  if (!nodes.length) return [];

  const inDegree: Record<string, number> = {};
  const adjacency: Record<string, string[]> = {};

  nodes.forEach((n) => {
    inDegree[n.id] = 0;
    adjacency[n.id] = [];
  });

  edges.forEach((e) => {
    if (inDegree[e.target] !== undefined) {
      inDegree[e.target] += 1;
    }
    if (adjacency[e.source] !== undefined) {
      adjacency[e.source].push(e.target);
    }
  });

  const levels: Record<string, number> = {};
  const queue: string[] = [];

  nodes.forEach((n) => {
    if (inDegree[n.id] === 0) {
      levels[n.id] = 0;
      queue.push(n.id);
    }
  });

  if (queue.length === 0 && nodes.length > 0) {
    levels[nodes[0].id] = 0;
    queue.push(nodes[0].id);
  }

  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentLevel = levels[current] || 0;
    const targets = adjacency[current] || [];

    targets.forEach((target) => {
      if (levels[target] === undefined || levels[target] < currentLevel + 1) {
        levels[target] = currentLevel + 1;
        queue.push(target);
      }
    });
  }

  let maxLevel = 0;
  Object.values(levels).forEach((l) => {
    if (l > maxLevel) maxLevel = l;
  });

  nodes.forEach((n) => {
    if (levels[n.id] === undefined) {
      maxLevel += 1;
      levels[n.id] = maxLevel;
    }
  });

  const levelGroups: Record<number, DiagramNode[]> = {};
  nodes.forEach((n) => {
    const lvl = levels[n.id] || 0;
    if (!levelGroups[lvl]) levelGroups[lvl] = [];
    levelGroups[lvl].push(n);
  });

  const startX = 80;
  const startY = 80;
  const colSpacing = 280;
  const rowSpacing = 160;

  return nodes.map((node) => {
    const lvl = levels[node.id] || 0;
    const group = levelGroups[lvl] || [node];
    const indexInGroup = group.findIndex((n) => n.id === node.id);

    return {
      ...node,
      position: {
        x: startX + lvl * colSpacing,
        y: startY + indexInGroup * rowSpacing,
      },
    };
  });
}
