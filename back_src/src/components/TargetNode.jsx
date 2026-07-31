import React, { useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Target, ExternalLink, Info, Link2 } from 'lucide-react';

export default function TargetNode({ data, selected }) {
  const [showTooltip, setShowTooltip] = useState(false);

  const handleOpenUrl = (e) => {
    e.stopPropagation();
    if (data.url) {
      window.open(data.url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div
      className={`relative group rounded-xl p-4 transition-all duration-300 min-w-[240px] max-w-[280px] shadow-xl border-2 backdrop-blur-md cursor-pointer ${
        selected
          ? 'border-cyan-400 ring-4 ring-cyan-400/30 scale-105'
          : 'border-cyan-500/50 hover:border-cyan-400'
      } bg-gradient-to-br from-slate-900/95 via-cyan-950/30 to-slate-900/95 text-slate-100`}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {/* Top Handle */}
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-cyan-400 !w-3.5 !h-3.5 !border-2 !border-slate-900 rounded-full hover:scale-125 transition-transform"
      />

      {/* Badge Header */}
      <div className="flex items-center justify-between gap-2 mb-2 border-b border-cyan-500/20 pb-2">
        <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 text-xs font-bold tracking-wide">
          <Target className="w-3.5 h-3.5 text-cyan-400" />
          <span>타겟 / 소셜</span>
        </div>

        <button
          onClick={handleOpenUrl}
          title="새 탭에서 열기"
          className="p-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/40 text-cyan-300 transition-colors flex items-center gap-1 text-xs px-2"
        >
          <span>방문</span>
          <ExternalLink className="w-3 h-3" />
        </button>
      </div>

      {/* Node Content */}
      <div className="space-y-1">
        <h3 className="font-bold text-sm text-cyan-100 truncate leading-tight">
          {data.title || data.id}
        </h3>
        <p className="text-xs text-cyan-300/70 truncate font-mono bg-slate-950/60 px-2 py-0.5 rounded border border-cyan-500/20">
          {data.url}
        </p>
      </div>

      {/* Link Stats */}
      <div className="mt-3 pt-2 border-t border-cyan-500/20 flex items-center justify-between text-xs text-slate-300">
        <div className="flex items-center gap-1 text-emerald-400 font-medium">
          <Link2 className="w-3 h-3 text-emerald-400" />
          <span>수신 백링크 {data.inboundCount || 0}개</span>
        </div>
        <Info className="w-3.5 h-3.5 text-cyan-400/60" />
      </div>

      {/* Bottom Handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-cyan-400 !w-3.5 !h-3.5 !border-2 !border-slate-900 rounded-full hover:scale-125 transition-transform"
      />

      {/* Hover Tooltip */}
      {showTooltip && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-3 w-64 p-3 bg-slate-900/95 border border-cyan-400/60 rounded-xl shadow-2xl backdrop-blur-md text-xs space-y-1 pointer-events-none animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-center gap-1.5 text-cyan-300 font-bold border-b border-cyan-500/30 pb-1">
            <Info className="w-3.5 h-3.5 text-cyan-400" />
            <span>타겟 사이트 메모</span>
          </div>
          <p className="text-slate-200 leading-relaxed font-normal whitespace-pre-wrap">
            {data.memo || '작성된 메모가 없습니다.'}
          </p>
        </div>
      )}
    </div>
  );
}
