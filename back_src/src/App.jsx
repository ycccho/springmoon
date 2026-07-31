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

const STORAGE_KEY_SITES = 'backlink_visualizer_sites_v3';
const STORAGE_KEY_MEMO = 'backlink_visualizer_memo_v3';

// Register Custom Node Types
const nodeTypes = {
  money: MoneyNode,
  pbn: PBNNode,
  target: TargetNode
};

function FlowApp() {
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

  // Re-layout DAG graph whenever sites or direction changes
  const applyLayout = useCallback(() => {
    const { nodes: layoutedNodes, edges: layoutedEdges } = buildGraphFromSites(sites, direction);

    // Apply search filter highlighting if search term present
    const updatedNodes = layoutedNodes.map(n => {
      const isMatch = searchTerm.trim() === '' ||
        n.data.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        n.data.url.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (n.data.memo && n.data.memo.toLowerCase().includes(searchTerm.toLowerCase()));

      return {
        ...n,
        style: {
          ...n.style,
          opacity: isMatch ? 1 : 0.25,
          transition: 'all 0.3s ease'
        }
      };
    });

    setNodes(updatedNodes);
    setEdges(layoutedEdges);
  }, [sites, direction, searchTerm, setNodes, setEdges]);

  useEffect(() => {
    applyLayout();
  }, [applyLayout]);

  const handleRelayout = () => {
    applyLayout();
    setTimeout(() => {
      reactFlowInstance.fitView({ padding: 0.2, duration: 400 });
    }, 50);
  };

  const handleNodeClick = (_, node) => {
    if (node && node.data && node.data.url) {
      window.open(node.data.url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 text-slate-100 overflow-hidden font-sans select-none">
      {/* 1. Top Collapsible Memo Pad */}
      <TopMemo memo={memo} setMemo={setMemo} />

      {/* 2. Canvas Header & Toolbar */}
      <CanvasHeader
        sites={sites}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        direction={direction}
        setDirection={setDirection}
        onRelayout={handleRelayout}
        isPanelOpen={isPanelOpen}
        setIsPanelOpen={setIsPanelOpen}
      />

      {/* 3. Central Visualization Canvas */}
      <div className="flex-1 w-full relative">
        {/* Tier Level Background Floating Markers */}
        {direction === 'TB' && (
          <div className="absolute left-4 top-4 z-10 flex flex-col gap-28 pointer-events-none opacity-40">
            <div className="flex items-center gap-2 bg-amber-500/20 text-amber-300 px-3 py-1 rounded-full border border-amber-500/40 text-xs font-black">
              ⭐ [티어 0] 머니사이트 & 타겟 영역 (최상단)
            </div>
            <div className="flex items-center gap-2 bg-rose-500/20 text-rose-300 px-3 py-1 rounded-full border border-rose-500/40 text-xs font-black">
              📌 [티어 1] 1차 백링크 PBN 영역
            </div>
            <div className="flex items-center gap-2 bg-cyan-500/20 text-cyan-300 px-3 py-1 rounded-full border border-cyan-500/40 text-xs font-black">
              🔗 [티어 2] 2차 백링크 PBN 영역
            </div>
            <div className="flex items-center gap-2 bg-pink-500/20 text-pink-300 px-3 py-1 rounded-full border border-pink-500/40 text-xs font-black">
              🌐 [티어 3] 3차 백링크 PBN 영역
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
              우측 상단 '데이터 입력/관리' 버튼을 눌러 사이트를 직접 추가하거나 기본 프리셋 데이터로 복원하세요.
            </p>
            <button
              onClick={() => setSites(INITIAL_SITES)}
              className="px-4 py-2 bg-amber-500 text-slate-950 font-extrabold rounded-xl shadow-lg transition-all"
            >
              기본 프리셋 데이터 복원
            </button>
          </div>
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
