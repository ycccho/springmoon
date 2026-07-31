import dagre from '@dagrejs/dagre';
import { MarkerType } from '@xyflow/react';
import { normalizeUrl } from './initialData';

const NODE_WIDTH = 260;
const NODE_HEIGHT = 140;

export function buildGraphFromSites(sites, direction = 'TB') {
  // Map normalized URL to site ID
  const urlToIdMap = new Map();
  sites.forEach(s => {
    urlToIdMap.set(normalizeUrl(s.url), s.id);
  });

  // Calculate inbound & outbound counts for metrics
  const inboundMap = new Map();
  const outboundMap = new Map();
  sites.forEach(s => {
    inboundMap.set(s.id, 0);
    outboundMap.set(s.id, s.targets ? s.targets.length : 0);
  });

  // Collect edges
  const rawEdges = [];
  sites.forEach(sourceSite => {
    if (sourceSite.targets && Array.isArray(sourceSite.targets)) {
      sourceSite.targets.forEach(targetUrl => {
        const normTarget = normalizeUrl(targetUrl);
        const targetId = urlToIdMap.get(normTarget) || targetUrl;

        // Increment inbound count for target
        if (inboundMap.has(targetId)) {
          inboundMap.set(targetId, (inboundMap.get(targetId) || 0) + 1);
        }

        rawEdges.push({
          id: `e-${sourceSite.id}->${targetId}`,
          source: sourceSite.id,
          target: targetId,
          type: 'smoothstep',
          animated: true,
          style: { strokeWidth: 2, stroke: '#6366f1' },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 18,
            height: 18,
            color: '#6366f1'
          }
        });
      });
    }
  });

  // Calculate Node Depths (Ranks)
  // Money Sites = Rank 0 (Topmost)
  // Distance from Money Site dictates depth, so Money Site stays at top!
  const nodeDepths = new Map();

  // Helper to compute depth
  // Money sites have depth 0
  sites.forEach(s => {
    if (s.type === 'money') {
      nodeDepths.set(s.id, 0);
    }
  });

  // BFS / Topological distance calculation for hierarchy
  // For links PBN -> Money Site, PBN is 1 level below Money Site
  let changed = true;
  let iterations = 0;
  while (changed && iterations < 20) {
    changed = false;
    iterations++;
    sites.forEach(s => {
      if (s.targets && Array.isArray(s.targets)) {
        s.targets.forEach(tUrl => {
          const tId = urlToIdMap.get(normalizeUrl(tUrl)) || tUrl;
          if (nodeDepths.has(tId)) {
            const targetDepth = nodeDepths.get(tId);
            const currentDepth = nodeDepths.get(s.id);
            const newDepth = targetDepth + 1;
            if (currentDepth === undefined || currentDepth < newDepth) {
              // Wait, PBN pointing to Money Site means PBN is level below (higher depth index)
              // If PBN points to another PBN which points to Money Site, depth increases
              nodeDepths.set(s.id, newDepth);
              changed = true;
            }
          }
        });
      }
    });
  }

  // Set default depth for standalone target nodes or unlinked nodes
  sites.forEach(s => {
    if (!nodeDepths.has(s.id)) {
      if (s.type === 'target') {
        nodeDepths.set(s.id, 0); // Targets like Naver blog / Insta placed at top rank alongside Money Site
      } else {
        nodeDepths.set(s.id, 1);
      }
    }
  });

  // Build Dagre Graph
  const g = new dagre.graphlib.Graph();
  g.setGraph({
    rankdir: direction,
    nodesep: 80,
    ranksep: 120,
    marginx: 50,
    marginy: 50
  });
  g.setDefaultEdgeLabel(() => ({}));

  // Add nodes to Dagre
  sites.forEach(s => {
    const depth = nodeDepths.get(s.id) || 0;
    g.setNode(s.id, {
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
      rank: depth // Enforce rank in Dagre layout
    });
  });

  // Add edges to Dagre
  rawEdges.forEach(edge => {
    g.setEdge(edge.source, edge.target);
  });

  // Execute Dagre layout
  dagre.layout(g);

  // Map back to React Flow nodes
  const nodes = sites.map(s => {
    const dagreNode = g.node(s.id);
    const inCount = inboundMap.get(s.id) || 0;
    const outCount = outboundMap.get(s.id) || 0;
    const depth = nodeDepths.get(s.id) || 0;

    return {
      id: s.id,
      type: s.type, // 'money' | 'pbn' | 'target'
      position: {
        x: dagreNode ? dagreNode.x - NODE_WIDTH / 2 : 0,
        y: dagreNode ? dagreNode.y - NODE_HEIGHT / 2 : depth * 180
      },
      data: {
        ...s,
        inboundCount: inCount,
        outboundCount: outCount,
        depth: depth
      }
    };
  });

  return { nodes, edges: rawEdges };
}
