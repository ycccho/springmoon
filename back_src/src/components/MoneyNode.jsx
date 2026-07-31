import React, { useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Crown, ExternalLink, Info, Link2 } from 'lucide-react';

export default function MoneyNode({ data, selected }) {
  const [showTooltip, setShowTooltip] = useState(false);

  const handleOpenUrl = (e) => {
    e.stopPropagation();
    if (data.url) {
      window.open(data.url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div
      className={`relative group rounded-xl p-4 transition-all duration-300 min-w-[240px] max-w-[280px] shadow-2xl border-2 backdrop-blur-md cursor-pointer ${
        selected
          ? 'border-amber-400 ring-4 ring-amber-400/30 scale-105'
          : 'border-amber-500/60 hover:border-amber-400'
      } bg-gradient-to-br from-slate-900/90 via-amber-950/40 to-slate-900/90 text-slate-100`}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {/* Top Handle (Incoming Backlinks) */}
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-amber-400 !w-4 !h-4 !border-2 !border-slate-900 rounded-full hover:scale-125 transition-transform"
      />

      {/* Badge Header */}
      <div className="flex items-center justify-between gap-2 mb-2 border-b border-amber-500/30 pb-2">
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border border-amber-400/50 text-amber-300 text-xs font-bold tracking-wide shadow-sm">
          <Crown className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
          <span>머니사이트</span>
        </div>

        <button
          onClick={handleOpenUrl}
          title="새 탭에서 열기"
          className="p-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/40 text-amber-300 transition-colors flex items-center gap-1 text-xs px-2"
        >
          <span>방문</span>
          <ExternalLink className="w-3 h-3" />
        </button>
      </div>

      {/* Node Content */}
      <div className="space-y-1">
        <h3 className="font-extrabold text-base text-amber-200 truncate leading-tight">
          {data.title || data.id}
        </h3>
        <p className="text-xs text-amber-300/70 truncate font-mono bg-slate-950/50 px-2 py-1 rounded border border-amber-500/20">
          {data.url}
        </p>
      </div>

      {/* Footer Metrics */}
      <div className="mt-3 pt-2 border-t border-amber-500/20 flex items-center justify-between text-xs text-slate-300">
        <div className="flex items-center gap-1 text-emerald-400 font-semibold bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-500/30">
          <Link2 className="w-3 h-3" />
          <span>수신 백링크 {data.inboundCount || 0}개</span>
        </div>
        <Info className="w-3.5 h-3.5 text-amber-400/60" />
      </div>

      {/* Bottom Handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-amber-400 !w-4 !h-4 !border-2 !border-slate-900 rounded-full hover:scale-125 transition-transform"
      />

      {/* Hover Tooltip */}
      {showTooltip && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-3 w-64 p-3 bg-slate-900/95 border border-amber-400/60 rounded-xl shadow-2xl backdrop-blur-md text-xs space-y-1 pointer-events-none animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-center gap-1.5 text-amber-300 font-bold border-b border-amber-500/30 pb-1">
            <Info className="w-3.5 h-3.5 text-amber-400" />
            <span>사이트 상세 메모</span>
          </div>
          <p className="text-slate-200 leading-relaxed font-normal whitespace-pre-wrap">
            {data.memo || '작성된 메모가 없습니다.'}
          </p>
          <div className="text-[10px] text-amber-400/60 text-right pt-1 font-mono">
            클릭하여 사이트 연결
          </div>
        </div>
      )}
    </div>
  );
}
