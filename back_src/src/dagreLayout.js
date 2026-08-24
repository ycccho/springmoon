import dagre from '@dagrejs/dagre';
import { MarkerType } from '@xyflow/react';
import { normalizeUrl, PBN_COLORS } from './initialData';

const NODE_WIDTH = 320;
const NODE_HEIGHT = 200;

export function buildGraphFromSites(sites, direction = 'TB') {
  // Map normalized URL to site object and ID
  const urlToIdMap = new Map();
  sites.forEach((s) => {
    urlToIdMap.set(normalizeUrl(s.url), s.id);
  });

  // Calculate inbound & outbound counts
  const inboundMap = new Map();
  const outboundMap = new Map();
  sites.forEach(s => {
    inboundMap.set(s.id, 0);
    outboundMap.set(s.id, s.targets ? s.targets.length : 0);
  });

  // Color assignments
  sites.forEach((s, idx) => {
    if (!s.color) {
      if (s.type === 'money') s.color = '#eab308';
      else if (s.type === 'target') s.color = '#38bdf8';
      else s.color = PBN_COLORS[idx % PBN_COLORS.length].hex;
    }
  });

  // Count incoming edges per target to assign separate handles
  const targetIncomingHandleCounter = new Map();
  const sourceOutgoingHandleCounter = new Map();

  // Collect edges with Separate Handles and Source PBN Colors!
  const rawEdges = [];
  sites.forEach(sourceSite => {
    const sourceColor = sourceSite.color || '#6366f1';

    if (sourceSite.targets && Array.isArray(sourceSite.targets)) {
      sourceSite.targets.forEach(targetUrl => {
        const normTarget = normalizeUrl(targetUrl);
        const targetId = urlToIdMap.get(normTarget) || targetUrl;

        // Increment counts
        if (inboundMap.has(targetId)) {
          inboundMap.set(targetId, (inboundMap.get(targetId) || 0) + 1);
        }

        // Calculate unique handle index for target node so lines NEVER overlap
        const inIdx = targetIncomingHandleCounter.get(targetId) || 0;
        targetIncomingHandleCounter.set(targetId, inIdx + 1);
        const targetHandleId = `in-${inIdx % 7}`;

        // Calculate unique handle index for source node
        const outIdx = sourceOutgoingHandleCounter.get(sourceSite.id) || 0;
        sourceOutgoingHandleCounter.set(sourceSite.id, outIdx + 1);
        const sourceHandleId = `out-${outIdx % 7}`;

        const edgeId = `e-${sourceSite.id}->${targetId}-${inIdx}`;

        rawEdges.push({
          id: edgeId,
          source: sourceSite.id,
          sourceHandle: sourceHandleId,
          target: targetId,
          targetHandle: targetHandleId,
          type: 'smoothstep',
          animated: true,
          style: {
            strokeWidth: 3.5,
            stroke: sourceColor,
            filter: `drop-shadow(0 0 6px ${sourceColor}90)`
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 22,
            height: 22,
            color: sourceColor
          }
        });
      });
    }
  });

  // Explicit Tier Ranking Logic
  // Tier 0 (Rank 0): Money Site inde.co.kr (TOP OF CANVAS Y = 0) & Primary Targets
  // Tier 1 (Rank 1): PBNs pointing directly to Tier 0
  // Tier 2 (Rank 2): PBNs pointing to Tier 1 PBNs
  // Tier 3 (Rank 3): PBNs pointing to Tier 2 PBNs
  const nodeTiers = new Map();

  // Step 1: Money sites & targets are Tier 0 (Rank 0)
  sites.forEach(s => {
    if (s.type === 'money') {
      nodeTiers.set(s.id, 0); // Guaranteed Rank 0 (Topmost)
    }
  });

  // Step 2: Calculate Tier levels based on link distance to Money Site
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

  // Fallback for target nodes or standalone nodes
  sites.forEach(s => {
    if (!nodeTiers.has(s.id)) {
      if (s.type === 'target') {
        nodeTiers.set(s.id, 0); // Put target sites alongside Money Site at Tier 0 (Top)
      } else {
        nodeTiers.set(s.id, 1);
      }
    }
  });

  // Build Dagre Layout
  const g = new dagre.graphlib.Graph();
  g.setGraph({
    rankdir: direction,
    nodesep: 120, // Wide spacing between nodes so lines stay clean & separated
    ranksep: 180, // Vertical spacing between tiers
    marginx: 100,
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

  // To layout Dagre from Money Site (top) down to Tier 3 PBNs (bottom),
  // we add inverted edges to Dagre for layout positioning only!
  rawEdges.forEach(edge => {
    // Invert for Dagre layout ranking so Money Site stays at TOP!
    g.setEdge(edge.target, edge.source);
  });

  dagre.layout(g);

  // Map to React Flow nodes with dynamic inbound/outbound site lists
  const nodes = sites.map(s => {
    const dagreNode = g.node(s.id);
    const inCount = inboundMap.get(s.id) || 0;
    const outCount = outboundMap.get(s.id) || 0;
    const tier = nodeTiers.get(s.id) || 0;

    // Find all sites pointing to this site (Inbound sites)
    const inboundSites = sites.filter(otherSite => {
      if (!otherSite.targets || !Array.isArray(otherSite.targets)) return false;
      return otherSite.targets.some(tUrl => {
        const tId = urlToIdMap.get(normalizeUrl(tUrl)) || tUrl;
        return tId === s.id;
      });
    });

    // Find all target sites this site points to (Outbound sites)
    const outboundSites = (s.targets || []).map(tUrl => {
      const tId = urlToIdMap.get(normalizeUrl(tUrl)) || tUrl;
      const targetObj = sites.find(item => item.id === tId);
      return {
        url: tUrl,
        id: tId,
        title: targetObj ? targetObj.title : tId,
        type: targetObj ? targetObj.type : 'target'
      };
    });

    return {
      id: s.id,
      type: s.type, // 'money' | 'pbn' | 'target'
      position: {
        x: dagreNode ? dagreNode.x - NODE_WIDTH / 2 : 0,
        y: dagreNode ? dagreNode.y - NODE_HEIGHT / 2 : tier * 260
      },
      data: {
        ...s,
        inboundCount: inCount,
        outboundCount: outCount,
        inboundSites: inboundSites,
        outboundSites: outboundSites,
        tier: tier,
        color: s.color || '#6366f1'
      }
    };
  });

  return { nodes, edges: rawEdges };
}
