import dagre from '@dagrejs/dagre';
import { MarkerType } from '@xyflow/react';
import { normalizeUrl, PBN_COLORS } from './initialData';

const NODE_WIDTH = 300;
const NODE_HEIGHT = 180;

export function buildGraphFromSites(sites, direction = 'TB') {
  // Map normalized URL to site object
  const urlToSiteMap = new Map();
  const urlToIdMap = new Map();
  sites.forEach((s, idx) => {
    urlToSiteMap.set(normalizeUrl(s.url), s);
    urlToIdMap.set(normalizeUrl(s.url), s.id);
  });

  // Calculate inbound & outbound counts for metrics
  const inboundMap = new Map();
  const outboundMap = new Map();
  sites.forEach(s => {
    inboundMap.set(s.id, 0);
    outboundMap.set(s.id, s.targets ? s.targets.length : 0);
  });

  // Assign colors if missing
  sites.forEach((s, idx) => {
    if (!s.color) {
      if (s.type === 'money') s.color = '#eab308';
      else if (s.type === 'target') s.color = '#38bdf8';
      else s.color = PBN_COLORS[idx % PBN_COLORS.length].hex;
    }
  });

  // Collect edges with Source Node's Unique Color!
  const rawEdges = [];
  sites.forEach(sourceSite => {
    const sourceColor = sourceSite.color || '#6366f1';

    if (sourceSite.targets && Array.isArray(sourceSite.targets)) {
      sourceSite.targets.forEach(targetUrl => {
        const normTarget = normalizeUrl(targetUrl);
        const targetId = urlToIdMap.get(normTarget) || targetUrl;

        // Increment inbound count for target
        if (inboundMap.has(targetId)) {
          inboundMap.set(targetId, (inboundMap.get(targetId) || 0) + 1);
        }

        const edgeId = `e-${sourceSite.id}->${targetId}`;

        rawEdges.push({
          id: edgeId,
          source: sourceSite.id,
          target: targetId,
          type: 'smoothstep',
          animated: true,
          style: {
            strokeWidth: 3,
            stroke: sourceColor,
            filter: `drop-shadow(0 0 6px ${sourceColor}80)`
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 20,
            height: 20,
            color: sourceColor
          }
        });
      });
    }
  });

  // Dynamic Tier Calculation
  // Tier 0: Money site (and primary target sites)
  // Tier 1: Sites pointing to Tier 0
  // Tier 2: Sites pointing to Tier 1
  // Tier 3: Sites pointing to Tier 2
  const nodeTiers = new Map();

  sites.forEach(s => {
    if (s.type === 'money' || s.type === 'target') {
      nodeTiers.set(s.id, 0);
    }
  });

  let changed = true;
  let iterations = 0;
  while (changed && iterations < 15) {
    changed = false;
    iterations++;
    sites.forEach(s => {
      if (s.targets && Array.isArray(s.targets)) {
        s.targets.forEach(tUrl => {
          const tId = urlToIdMap.get(normalizeUrl(tUrl)) || tUrl;
          if (nodeTiers.has(tId)) {
            const targetTier = nodeTiers.get(tId);
            const currentTier = nodeTiers.get(s.id);
            const calculatedTier = targetTier + 1;
            if (currentTier === undefined || currentTier < calculatedTier) {
              nodeTiers.set(s.id, calculatedTier);
              changed = true;
            }
          }
        });
      }
    });
  }

  // Fallback for unlinked nodes
  sites.forEach(s => {
    if (!nodeTiers.has(s.id)) {
      nodeTiers.set(s.id, s.type === 'money' ? 0 : 1);
    }
  });

  // Build Dagre Layout Graph
  const g = new dagre.graphlib.Graph();
  g.setGraph({
    rankdir: direction,
    nodesep: 90,
    ranksep: 160,
    marginx: 80,
    marginy: 80
  });
  g.setDefaultEdgeLabel(() => ({}));

  sites.forEach(s => {
    const tier = nodeTiers.get(s.id) || 0;
    g.setNode(s.id, {
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
      rank: tier
    });
  });

  rawEdges.forEach(edge => {
    g.setEdge(edge.source, edge.target);
  });

  dagre.layout(g);

  // Map to React Flow nodes with exact color & tier metadata
  const nodes = sites.map(s => {
    const dagreNode = g.node(s.id);
    const inCount = inboundMap.get(s.id) || 0;
    const outCount = outboundMap.get(s.id) || 0;
    const tier = nodeTiers.get(s.id) || 0;

    return {
      id: s.id,
      type: s.type, // 'money' | 'pbn' | 'target'
      position: {
        x: dagreNode ? dagreNode.x - NODE_WIDTH / 2 : 0,
        y: dagreNode ? dagreNode.y - NODE_HEIGHT / 2 : tier * 240
      },
      data: {
        ...s,
        inboundCount: inCount,
        outboundCount: outCount,
        tier: tier,
        color: s.color || '#6366f1'
      }
    };
  });

  return { nodes, edges: rawEdges };
}
