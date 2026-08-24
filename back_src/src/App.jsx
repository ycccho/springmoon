import React, { useState, useEffect, useCallback } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { INITIAL_SITES, DEFAULT_MEMO } from './initialData';
import { buildGraphFromSites } from './dagreLayout';
import MoneyNode from './components/MoneyNode';
import PBNNode from './components/PBNNode';
import TargetNode from './components/TargetNode';
import TopMemo from './components/TopMemo';
import SidePanel from './components/SidePanel';
import CanvasHeader from './components/CanvasHeader';
import LiveBacklinkChecker from './components/LiveBacklinkChecker';
import BacklinkTable from './components/BacklinkTable';
import StrategyGuide from './components/StrategyGuide';

const STORAGE_KEY_SITES = 'backlink_visualizer_sites_v4';
const STORAGE_KEY_MEMO = 'backlink_visualizer_memo_v4';

// Register Custom Node Types
const nodeTypes = {
  money: MoneyNode,
  pbn: PBNNode,
  target: TargetNode
};

function FlowApp() {
  // Active View Mode: 'live_search' (Default) | 'graph' | 'table' | 'guide'
  const [activeView, setActiveView] = useState('live_search');

  // Load initial sites from localStorage or preset
  const [sites, setSites] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SITES);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error('Failed to parse saved sites from localStorage', e);
    }
    return INITIAL_SITES;
  });

  // Load initial memo from localStorage or default
  const [memo, setMemo] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_MEMO);
      if (saved !== null) return saved;
    } catch (e) {
      console.error('Failed to load memo from localStorage', e);
    }
    return DEFAULT_MEMO;
  });

  // UI Control states
  const [direction, setDirection] = useState('TB'); // 'TB' | 'LR'
  const [searchTerm, setSearchTerm] = useState('');
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [editingSite, setEditingSite] = useState(null);
  const [hoveredNodeId, setHoveredNodeId] = useState(null);

  // React Flow state
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const reactFlowInstance = useReactFlow();

  // Save to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_SITES, JSON.stringify(sites));
    } catch (e) {
      console.error('Failed to save sites to localStorage', e);
    }
  }, [sites]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_MEMO, memo);
    } catch (e) {
      console.error('Failed to save memo to localStorage', e);
    }
  }, [memo]);

  // Calculate layout and node/edge highlighting
  const applyLayout = useCallback(() => {
    const { nodes: layoutedNodes, edges: layoutedEdges } = buildGraphFromSites(sites, direction);

    // Compute connected node IDs for hovered node
    const connectedNodeIds = new Set();
    const connectedEdgeIds = new Set();

    if (hoveredNodeId) {
      connectedNodeIds.add(hoveredNodeId);
      layoutedEdges.forEach(e => {
        if (e.source === hoveredNodeId || e.target === hoveredNodeId) {
          connectedEdgeIds.add(e.id);
          connectedNodeIds.add(e.source);
          connectedNodeIds.add(e.target);
        }
      });
    }

    // Apply search filter and hover highlighting
    const updatedNodes = layoutedNodes.map(n => {
      const isSearchMatch = searchTerm.trim() === '' ||
        n.data.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        n.data.url.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (n.data.memo && n.data.memo.toLowerCase().includes(searchTerm.toLowerCase()));

      const isHoverMatch = !hoveredNodeId || connectedNodeIds.has(n.id);
      const isDimmed = !isSearchMatch || !isHoverMatch;

      return {
        ...n,
        style: {
          ...n.style,
          opacity: isDimmed ? 0.15 : 1,
          transition: 'all 0.3s ease'
        }
      };
    });

    const updatedEdges = layoutedEdges.map(e => {
      const isHoverMatch = !hoveredNodeId || connectedEdgeIds.has(e.id);
      return {
        ...e,
        style: {
          ...e.style,
          opacity: isHoverMatch ? 1 : 0.1,
          strokeWidth: connectedEdgeIds.has(e.id) ? 5 : 3.5
        }
      };
    });

    setNodes(updatedNodes);
    setEdges(updatedEdges);
  }, [sites, direction, searchTerm, hoveredNodeId, setNodes, setEdges]);

  useEffect(() => {
    applyLayout();
  }, [applyLayout]);

  const handleRelayout = () => {
    applyLayout();
    setTimeout(() => {
      reactFlowInstance.fitView({ padding: 0.25, duration: 400 });
    }, 50);
  };

  const handleNodeClick = (_, node) => {
    if (node && node.data && node.data.url) {
      window.open(node.data.url, '_blank', 'noopener,noreferrer');
    }
  };

  const handleNodeMouseEnter = (_, node) => {
    setHoveredNodeId(node.id);
  };

  const handleNodeMouseLeave = () => {
    setHoveredNodeId(null);
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 text-slate-100 overflow-hidden font-sans select-none">
      {/* 1. Top Collapsible Memo Pad */}
      <TopMemo memo={memo} setMemo={setMemo} />

      {/* 2. Canvas Header & View Mode Navigation */}
      <CanvasHeader
        sites={sites}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        direction={direction}
        setDirection={setDirection}
        onRelayout={handleRelayout}
        isPanelOpen={isPanelOpen}
        setIsPanelOpen={setIsPanelOpen}
        activeView={activeView}
        setActiveView={setActiveView}
      />

      {/* 3. Main Views Container */}
      <div className="flex-1 w-full relative overflow-hidden flex">
        {/* VIEW 1: REACT FLOW GRAPH CANVAS */}
        {activeView === 'graph' && (
          <div className="flex-1 w-full h-full relative">
            {/* Tier Level Background Floating Banners */}
            {direction === 'TB' && (
              <div className="absolute left-6 top-6 z-10 flex flex-col gap-32 pointer-events-none opacity-50">
                <div className="flex items-center gap-2 bg-amber-500/20 text-amber-300 px-3.5 py-1.5 rounded-xl border border-amber-500/50 text-xs font-black shadow-lg">
                  <span>👑 [티어 0] 최상단 머니사이트 & 목표 사이트 (최종 백링크 집결지)</span>
                </div>
                <div className="flex items-center gap-2 bg-rose-500/20 text-rose-300 px-3.5 py-1.5 rounded-xl border border-rose-500/50 text-xs font-black shadow-lg">
                  <span>🥇 [티어 1] 1차 직결 PBN 백링크 사이트</span>
                </div>
                <div className="flex items-center gap-2 bg-cyan-500/20 text-cyan-300 px-3.5 py-1.5 rounded-xl border border-cyan-500/50 text-xs font-black shadow-lg">
                  <span>🥈 [티어 2] 2차 지원 PBN 백링크 사이트</span>
                </div>
                <div className="flex items-center gap-2 bg-pink-500/20 text-pink-300 px-3.5 py-1.5 rounded-xl border border-pink-500/50 text-xs font-black shadow-lg">
                  <span>🥉 [티어 3] 3차 하부 지원 블로그 사이트</span>
                </div>
              </div>
            )}

            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              nodeTypes={nodeTypes}
              onNodeClick={handleNodeClick}
              onNodeMouseEnter={handleNodeMouseEnter}
              onNodeMouseLeave={handleNodeMouseLeave}
              fitView
              fitViewOptions={{ padding: 0.25 }}
              minZoom={0.2}
              maxZoom={2}
              defaultEdgeOptions={{
                type: 'smoothstep',
                animated: true
              }}
              className="bg-slate-950"
            >
              <Background variant="dots" gap={24} size={1.2} color="#334155" />
              <Controls
                className="!bg-slate-900/90 !border !border-slate-800 !rounded-xl !shadow-2xl !text-slate-200"
                showInteractive={false}
              />
            </ReactFlow>

            {/* Empty Canvas Notice */}
            {sites.length === 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-sm p-6 text-center z-10">
                <h3 className="text-lg font-bold text-slate-200 mb-2">등록된 백링크 사이트가 없습니다</h3>
                <p className="text-sm text-slate-400 max-w-md mb-4">
                  우측 상단 '사이트 관리' 버튼을 눌러 사이트를 직접 추가하거나 기본 프리셋 데이터로 복원하세요.
                </p>
                <button
                  onClick={() => setSites(INITIAL_SITES)}
                  className="px-4 py-2 bg-amber-500 text-slate-950 font-black rounded-xl shadow-lg transition-all"
                >
                  기본 프리셋 데이터 복원
                </button>
              </div>
            )}
          </div>
        )}

        {/* VIEW 2: LIVE BACKLINK EXPLORER & CRAWLER */}
        {activeView === 'live_search' && (
          <LiveBacklinkChecker
            sites={sites}
            setSites={setSites}
            onSwitchToGraph={() => setActiveView('graph')}
          />
        )}

        {/* VIEW 3: BACKLINK DATA TABLE */}
        {activeView === 'table' && (
          <BacklinkTable
            sites={sites}
            setSites={setSites}
            onSelectSiteForEdit={(site) => {
              setEditingSite(site);
              setIsPanelOpen(true);
            }}
          />
        )}

        {/* VIEW 4: PBN STRATEGY & ARCHITECTURE GUIDE */}
        {activeView === 'guide' && (
          <StrategyGuide />
        )}
      </div>

      {/* 4. Right Side Management Drawer Panel */}
      <SidePanel
        sites={sites}
        setSites={setSites}
        setMemo={setMemo}
        editingSite={editingSite}
        setEditingSite={setEditingSite}
        isOpen={isPanelOpen}
        setIsOpen={setIsPanelOpen}
      />
    </div>
  );
}

export default function App() {
  return (
    <ReactFlowProvider>
      <FlowApp />
    </ReactFlowProvider>
  );
}
