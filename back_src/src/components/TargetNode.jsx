import React, { useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Target, ExternalLink, Info, Link2, Copy, Check } from 'lucide-react';

export default function TargetNode({ data, selected }) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  const nodeColor = data.color || '#38bdf8';

  const handleOpenUrl = (e) => {
    e.stopPropagation();
    if (data.url) {
      window.open(data.url, '_blank', 'noopener,noreferrer');
    }
  };

  const handleCopyUrl = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(data.url);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  return (
    <div
      style={{
        borderColor: nodeColor,
        boxShadow: selected
          ? `0 0 25px ${nodeColor}80, inset 0 0 15px ${nodeColor}30`
          : `0 8px 24px -6px ${nodeColor}30`
      }}
      className={`relative group rounded-2xl p-4 transition-all duration-300 min-w-[280px] max-w-[320px] border-2 backdrop-blur-xl cursor-pointer ${
        selected ? 'scale-105 ring-4' : 'hover:scale-[1.02]'
      } bg-slate-900/95 text-slate-100`}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {/* Top Handle */}
      <Handle
        type="target"
        position={Position.Top}
        style={{ backgroundColor: nodeColor }}
        className="!w-4 !h-4 !border-2 !border-slate-900 rounded-full hover:scale-150 transition-transform shadow-md"
      />

      {/* Header Bar */}
      <div className="flex items-center justify-between gap-1.5 mb-2 pb-2 border-b border-slate-800">
        <div
          style={{ backgroundColor: `${nodeColor}25`, color: nodeColor, borderColor: `${nodeColor}50` }}
          className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-xs font-bold"
        >
          <Target className="w-3.5 h-3.5" />
          <span>타겟 / 소셜</span>
        </div>

        <div className="flex items-center gap-1">
          <span className="px-2 py-0.5 rounded bg-slate-800 text-cyan-300 border border-cyan-500/40 font-bold text-[11px]">
            수신 타겟
          </span>
          <button
            onClick={handleOpenUrl}
            title="새 탭에서 열기"
            className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors flex items-center gap-1 text-xs px-2 border border-slate-700"
          >
            <span>방문</span>
            <ExternalLink className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Title */}
      <h3 className="font-extrabold text-sm text-slate-100 truncate leading-tight mb-1">
        {data.title || data.id}
      </h3>

      {/* Highly Visible URL Badge */}
      <div className="flex items-center justify-between gap-1.5 bg-slate-950 p-2 rounded-xl border border-slate-800 shadow-inner mb-2.5">
        <span
          style={{ color: nodeColor }}
          className="font-mono text-xs font-extrabold truncate select-all"
        >
          {data.url}
        </span>
        <button
          onClick={handleCopyUrl}
          className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors text-[10px]"
          title="URL 주소 복사"
        >
          {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Metrics */}
      <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-300">
        <div className="flex items-center gap-1 text-emerald-400 font-bold bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-500/30">
          <Link2 className="w-3.5 h-3.5" />
          <span>수신 백링크 {data.inboundCount || 0}개</span>
        </div>
        <Info className="w-3.5 h-3.5 text-slate-500" />
      </div>

      {/* Bottom Handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ backgroundColor: nodeColor }}
        className="!w-4 !h-4 !border-2 !border-slate-900 rounded-full hover:scale-150 transition-transform shadow-md"
      />

      {/* Hover Tooltip */}
      {showTooltip && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-3 w-72 p-3 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl backdrop-blur-xl text-xs space-y-1.5 pointer-events-none animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-center gap-1.5 font-bold border-b border-slate-800 pb-1" style={{ color: nodeColor }}>
            <Info className="w-4 h-4" />
            <span>타겟 사이트 용도 / 메모</span>
          </div>
          <p className="text-slate-200 leading-relaxed font-normal whitespace-pre-wrap">
            {data.memo || '작성된 메모가 없습니다.'}
          </p>
        </div>
      )}
    </div>
  );
}
