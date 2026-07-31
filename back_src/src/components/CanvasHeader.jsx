import React from 'react';
import {
  Search,
  SlidersHorizontal,
  LayoutGrid,
  Star,
  Layers,
  Target,
  ArrowUpDown,
  RefreshCw,
  Info
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
    <div className="bg-slate-900/90 border-b border-slate-800 backdrop-blur-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-slate-100 z-10 shadow-md">
      {/* Left: App Brand & Quick Search */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <Star className="w-4 h-4 text-amber-100 fill-amber-100" />
          </div>
          <div>
            <h1 className="font-extrabold text-sm text-slate-100 leading-tight flex items-center gap-1.5">
              백링크 시각화 대시보드
              <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] border border-amber-500/40">
                티어 수직 정렬
              </span>
            </h1>
            <span className="text-[10px] text-slate-400 font-mono">
              ⭐ 머니사이트 최상단 • PBN 고유 색상 1:1 매칭
            </span>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative w-44 sm:w-60 ml-2">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="사이트 URL / 명칭 검색..."
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-amber-400 focus:outline-none"
          />
        </div>
      </div>

      {/* Middle: Tier Legend Bar */}
      <div className="hidden lg:flex items-center gap-2 text-xs bg-slate-950 px-3.5 py-1.5 rounded-xl border border-slate-800 font-semibold">
        <div className="flex items-center gap-1 text-amber-300">
          <Star className="w-3.5 h-3.5 fill-amber-400" />
          <span>티어 0: 머니 ({moneyCount})</span>
        </div>
        <span className="text-slate-700">|</span>
        <div className="flex items-center gap-1 text-rose-400">
          <span className="w-2 h-2 rounded-full bg-rose-500 inline-block"></span>
          <span>티어 1 PBN</span>
        </div>
        <span className="text-slate-700">|</span>
        <div className="flex items-center gap-1 text-cyan-400">
          <span className="w-2 h-2 rounded-full bg-cyan-500 inline-block"></span>
          <span>티어 2 PBN</span>
        </div>
        <span className="text-slate-700">|</span>
        <div className="flex items-center gap-1 text-pink-400">
          <span className="w-2 h-2 rounded-full bg-pink-500 inline-block"></span>
          <span>티어 3 PBN</span>
        </div>
        <span className="text-slate-700">|</span>
        <div className="text-slate-300 font-mono">
          총 연결 선: <strong className="text-indigo-400">{edgeCount}</strong>개
        </div>
      </div>

      {/* Right: Actions & Panel Toggle */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setDirection(direction === 'TB' ? 'LR' : 'TB')}
          className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition-colors"
          title="정렬 방향 변경 (수직 / 수평)"
        >
          <ArrowUpDown className="w-3.5 h-3.5 text-amber-400" />
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
              ? 'bg-amber-500 text-slate-950 font-black ring-2 ring-amber-400/40'
              : 'bg-gradient-to-r from-amber-500 to-indigo-600 text-slate-950 font-black hover:from-amber-400 hover:to-indigo-500'
          }`}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>데이터 입력/관리</span>
        </button>
      </div>
    </div>
  );
}
