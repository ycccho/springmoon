import React, { useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Layers, ExternalLink, Info, ArrowUpRight, ArrowDownLeft } from 'lucide-react';

export default function PBNNode({ data, selected }) {
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
          ? 'border-indigo-400 ring-4 ring-indigo-400/30 scale-105'
          : 'border-indigo-500/50 hover:border-indigo-400'
      } bg-gradient-to-br from-slate-900/95 via-indigo-950/30 to-slate-900/95 text-slate-100`}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {/* Top Handle */}
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-indigo-400 !w-3.5 !h-3.5 !border-2 !border-slate-900 rounded-full hover:scale-125 transition-transform"
      />

      {/* Badge Header */}
      <div className="flex items-center justify-between gap-2 mb-2 border-b border-indigo-500/20 pb-2">
        <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-400/40 text-indigo-300 text-xs font-bold tracking-wide">
          <Layers className="w-3.5 h-3.5 text-indigo-400" />
          <span>PBN 백링크</span>
        </div>

        <button
          onClick={handleOpenUrl}
          title="새 탭에서 열기"
          className="p-1 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/40 text-indigo-300 transition-colors flex items-center gap-1 text-xs px-2"
        >
          <span>방문</span>
          <ExternalLink className="w-3 h-3" />
        </button>
      </div>

      {/* Node Content */}
      <div className="space-y-1">
        <h3 className="font-bold text-sm text-indigo-100 truncate leading-tight">
          {data.title || data.id}
        </h3>
        <p className="text-xs text-indigo-300/70 truncate font-mono bg-slate-950/60 px-2 py-0.5 rounded border border-indigo-500/20">
          {data.url}
        </p>
      </div>

      {/* Link Stats */}
      <div className="mt-3 pt-2 border-t border-indigo-500/20 flex items-center justify-between text-xs text-slate-300">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-0.5 text-amber-400 bg-slate-950/50 px-1.5 py-0.5 rounded border border-indigo-500/20" title="발출 백링크 수">
            <ArrowUpRight className="w-3 h-3 text-amber-400" />
            <span>{data.outboundCount || 0}</span>
          </span>
          <span className="flex items-center gap-0.5 text-emerald-400 bg-slate-950/50 px-1.5 py-0.5 rounded border border-indigo-500/20" title="수신 백링크 수">
            <ArrowDownLeft className="w-3 h-3 text-emerald-400" />
            <span>{data.inboundCount || 0}</span>
          </span>
        </div>
        <Info className="w-3.5 h-3.5 text-indigo-400/60" />
      </div>

      {/* Bottom Handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-indigo-400 !w-3.5 !h-3.5 !border-2 !border-slate-900 rounded-full hover:scale-125 transition-transform"
      />

      {/* Hover Tooltip */}
      {showTooltip && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-3 w-64 p-3 bg-slate-900/95 border border-indigo-400/60 rounded-xl shadow-2xl backdrop-blur-md text-xs space-y-1 pointer-events-none animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-center gap-1.5 text-indigo-300 font-bold border-b border-indigo-500/30 pb-1">
            <Info className="w-3.5 h-3.5 text-indigo-400" />
            <span>PBN 사이트 메모</span>
          </div>
          <p className="text-slate-200 leading-relaxed font-normal whitespace-pre-wrap">
            {data.memo || '작성된 메모가 없습니다.'}
          </p>
          {data.targets && data.targets.length > 0 && (
            <div className="pt-1.5 border-t border-indigo-500/20 text-[11px] text-indigo-200/80">
              <span className="font-semibold text-amber-300">연결된 타겟 URL:</span>
              <ul className="list-disc list-inside mt-0.5 max-h-20 overflow-y-auto font-mono text-[10px] space-y-0.5">
                {data.targets.map((t, idx) => (
                  <li key={idx} className="truncate text-slate-300">{t}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
