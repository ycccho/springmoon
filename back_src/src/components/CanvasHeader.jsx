import React from 'react';
import {
  Search,
  SlidersHorizontal,
  LayoutGrid,
  Crown,
  Layers,
  Target,
  ArrowUpDown,
  RefreshCw
} from 'lucide-react';

export default function CanvasHeader({
  sites,
  searchTerm,
  setSearchTerm,
  direction,
  setDirection,
  onRelayout,
  isPanelOpen,
  setIsPanelOpen
}) {
  const moneyCount = sites.filter(s => s.type === 'money').length;
  const pbnCount = sites.filter(s => s.type === 'pbn').length;
  const targetCount = sites.filter(s => s.type === 'target').length;
  const edgeCount = sites.reduce((acc, s) => acc + (s.targets ? s.targets.length : 0), 0);

  return (
    <div className="bg-slate-900/80 border-b border-indigo-500/20 backdrop-blur-md px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-slate-100 z-10 shadow-md">
      {/* Left: App Brand & Quick Search */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <LayoutGrid className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="font-extrabold text-sm text-slate-100 leading-tight">
              백링크 시각화 대시보드
            </h1>
            <span className="text-[10px] text-indigo-400 font-mono">
              Cloudflare Pages • Hierarchical Tree
            </span>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative w-44 sm:w-64 ml-2">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="캔버스 노드 검색..."
            className="w-full bg-slate-950/80 border border-indigo-500/30 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-indigo-400 focus:outline-none"
          />
        </div>
      </div>

      {/* Middle: Canvas Metrics */}
      <div className="hidden lg:flex items-center gap-3 text-xs bg-slate-950/50 px-3 py-1.5 rounded-xl border border-indigo-500/20 font-medium">
        <div className="flex items-center gap-1.5 text-amber-300">
          <Crown className="w-3.5 h-3.5" />
          <span>머니사이트: <strong>{moneyCount}</strong></span>
        </div>
        <span className="text-slate-700">|</span>
        <div className="flex items-center gap-1.5 text-indigo-300">
          <Layers className="w-3.5 h-3.5" />
          <span>PBN: <strong>{pbnCount}</strong></span>
        </div>
        <span className="text-slate-700">|</span>
        <div className="flex items-center gap-1.5 text-cyan-300">
          <Target className="w-3.5 h-3.5" />
          <span>타겟: <strong>{targetCount}</strong></span>
        </div>
        <span className="text-slate-700">|</span>
        <div className="text-slate-300">
          총 백링크 연결: <strong className="text-indigo-400">{edgeCount}</strong>개
        </div>
      </div>

      {/* Right: Actions & Panel Toggle */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setDirection(direction === 'TB' ? 'LR' : 'TB')}
          className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition-colors"
          title="정렬 방향 변경 (수직 / 수평)"
        >
          <ArrowUpDown className="w-3.5 h-3.5 text-indigo-400" />
          <span className="hidden sm:inline">{direction === 'TB' ? '수직 정렬 (상하)' : '수평 정렬 (좌우)'}</span>
        </button>

        <button
          onClick={onRelayout}
          className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition-colors"
          title="트리 노드 위치 재정렬"
        >
          <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
          <span className="hidden sm:inline">자동 재정렬</span>
        </button>

        <button
          onClick={() => setIsPanelOpen(!isPanelOpen)}
          className={`px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-md transition-all ${
            isPanelOpen
              ? 'bg-indigo-600 text-white ring-2 ring-indigo-400/40'
              : 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white hover:from-indigo-500 hover:to-violet-500'
          }`}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>데이터 입력/관리</span>
        </button>
      </div>
    </div>
  );
}
