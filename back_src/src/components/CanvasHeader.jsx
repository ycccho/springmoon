import React from 'react';
import {
  Search,
  SlidersHorizontal,
  LayoutGrid,
  Crown,
  Layers,
  Target,
  ArrowUpDown,
  RefreshCw,
  HelpCircle,
  Network,
  Sparkles,
  Table,
  BookOpen
} from 'lucide-react';

export default function CanvasHeader({
  sites,
  searchTerm,
  setSearchTerm,
  direction,
  setDirection,
  onRelayout,
  isPanelOpen,
  setIsPanelOpen,
  activeView,
  setActiveView
}) {
  const moneyCount = sites.filter(s => s.type === 'money').length;
  const pbnCount = sites.filter(s => s.type === 'pbn').length;
  const targetCount = sites.filter(s => s.type === 'target').length;
  const edgeCount = sites.reduce((acc, s) => acc + (s.targets ? s.targets.length : 0), 0);

  return (
    <div className="flex flex-col border-b border-slate-800 bg-slate-900/95 backdrop-blur-xl text-slate-100 z-10 shadow-md">
      {/* 1. Main Navigation Bar */}
      <div className="px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
        {/* Left: App Brand & View Tabs */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Crown className="w-4 h-4 text-amber-100" />
            </div>
            <div>
              <h1 className="font-black text-sm text-slate-100 leading-tight flex items-center gap-1.5">
                백링크 통합 탐색기 & 시각화
                <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] font-bold border border-indigo-500/40">
                  v2.0 Pro
                </span>
              </h1>
              <span className="text-[10px] text-slate-400 font-mono">
                Cloudflare Pages • inde.co.kr & PBN 네트워크
              </span>
            </div>
          </div>

          {/* View Mode Tabs */}
          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 ml-2">
            <button
              onClick={() => setActiveView('live_search')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeView === 'live_search'
                  ? 'bg-gradient-to-r from-amber-500 to-indigo-600 text-slate-950 shadow font-extrabold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>실시간 백링크 조회</span>
            </button>

            <button
              onClick={() => setActiveView('graph')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeView === 'graph'
                  ? 'bg-indigo-600 text-white shadow font-extrabold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Network className="w-3.5 h-3.5" />
              <span>네트워크 그래프</span>
            </button>

            <button
              onClick={() => setActiveView('table')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeView === 'table'
                  ? 'bg-cyan-600 text-white shadow font-extrabold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Table className="w-3.5 h-3.5" />
              <span>데이터 테이블</span>
            </button>

            <button
              onClick={() => setActiveView('guide')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeView === 'guide'
                  ? 'bg-purple-600 text-white shadow font-extrabold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>PBN 전략 가이드</span>
            </button>
          </div>
        </div>

        {/* Middle: Summary Stats */}
        <div className="hidden xl:flex items-center gap-2 text-xs bg-slate-950 px-3.5 py-1.5 rounded-xl border border-slate-800 font-semibold">
          <div className="flex items-center gap-1 text-amber-300">
            <Crown className="w-3.5 h-3.5" />
            <span>머니 <strong>{moneyCount}</strong></span>
          </div>
          <span className="text-slate-700">|</span>
          <div className="flex items-center gap-1 text-indigo-300">
            <Layers className="w-3.5 h-3.5" />
            <span>PBN <strong>{pbnCount}</strong></span>
          </div>
          <span className="text-slate-700">|</span>
          <div className="flex items-center gap-1 text-cyan-300">
            <Target className="w-3.5 h-3.5" />
            <span>타겟 <strong>{targetCount}</strong></span>
          </div>
          <span className="text-slate-700">|</span>
          <div className="text-slate-300 font-mono">
            연결: <strong className="text-amber-400">{edgeCount}개</strong>
          </div>
        </div>

        {/* Right: Controls & Panel Toggle */}
        <div className="flex items-center gap-2">
          {activeView === 'graph' && (
            <>
              {/* Search Bar for Graph */}
              <div className="relative w-36 sm:w-48">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="노드 검색..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-amber-400 focus:outline-none"
                />
              </div>

              <button
                onClick={() => setDirection(direction === 'TB' ? 'LR' : 'TB')}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 border border-slate-700 transition-colors"
                title="수직 / 수평 정렬 전환"
              >
                <ArrowUpDown className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">{direction === 'TB' ? '상하' : '좌우'}</span>
              </button>

              <button
                onClick={onRelayout}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 border border-slate-700 transition-colors"
                title="캔버스 위치 자동 정렬"
              >
                <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline">자동 정렬</span>
              </button>
            </>
          )}

          <button
            onClick={() => setIsPanelOpen(!isPanelOpen)}
            className={`px-3 py-1.5 rounded-lg font-black text-xs flex items-center gap-1.5 shadow-md transition-all ${
              isPanelOpen
                ? 'bg-amber-500 text-slate-950 ring-2 ring-amber-400/40'
                : 'bg-gradient-to-r from-amber-500 to-indigo-600 text-slate-950 hover:from-amber-400 hover:to-indigo-500'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>사이트 관리</span>
          </button>
        </div>
      </div>

      {/* 2. Beginners Guide Strip */}
      {activeView === 'graph' && (
        <div className="bg-slate-950/90 border-t border-slate-800/80 px-4 py-1.5 flex items-center justify-between text-xs text-slate-300">
          <div className="flex items-center gap-2 font-medium">
            <HelpCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span>
              <strong>백링크 그래프 보는 법:</strong> 최상단 👑 [머니사이트]로 하단의 🥇 [PBN 사이트]들이 화살표 방향으로 백링크를 전달합니다. 각 노드에 마우스를 올리면 연결 경로만 하이라이트됩니다.
            </span>
          </div>
          <div className="hidden md:flex items-center gap-3 text-[11px] font-bold font-mono">
            <span className="text-amber-400">👑 [티어 0] 머니사이트</span>
            <span className="text-rose-400">🥇 [티어 1] 1차 PBN</span>
            <span className="text-cyan-400">🥈 [티어 2] 2차 PBN</span>
            <span className="text-pink-400">🥉 [티어 3] 3차 블로그</span>
          </div>
        </div>
      )}
    </div>
  );
}
