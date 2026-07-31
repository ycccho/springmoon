import React, { useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Star, ExternalLink, Info, Link2, Copy, Check, ChevronDown, ChevronUp } from 'lucide-react';

export default function MoneyNode({ data, selected }) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [showUrlList, setShowUrlList] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

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
      className={`relative group rounded-2xl p-4 transition-all duration-300 min-w-[280px] max-w-[320px] shadow-2xl border-2 backdrop-blur-xl cursor-pointer ${
        selected
          ? 'border-amber-400 ring-8 ring-amber-400/40 scale-105'
          : 'border-amber-500/80 hover:border-amber-300 hover:shadow-amber-500/20'
      } bg-gradient-to-br from-slate-900 via-amber-950/60 to-slate-900 text-slate-100 ring-2 ring-amber-500/30`}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {/* Top Handle (Incoming Backlinks) */}
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-amber-400 !w-5 !h-5 !border-3 !border-slate-900 rounded-full hover:scale-150 transition-transform shadow-lg shadow-amber-500/50"
      />

      {/* Prominent Golden Star Banner */}
      <div className="flex items-center justify-between gap-1.5 mb-2.5 pb-2 border-b border-amber-500/40">
        <div className="flex items-center gap-1 bg-amber-500/30 border border-amber-400/60 text-amber-200 px-3 py-1 rounded-full text-xs font-extrabold shadow-md">
          <Star className="w-4 h-4 text-amber-400 fill-amber-400 animate-spin-slow" />
          <Star className="w-4 h-4 text-amber-300 fill-amber-300" />
          <span className="text-amber-100 tracking-wide font-extrabold">⭐ 머니사이트 ⭐</span>
        </div>

        <div className="flex items-center gap-1">
          {/* Tier 0 Badge */}
          <span className="px-2 py-0.5 rounded-md bg-amber-400 text-slate-950 font-black text-[11px] shadow">
            티어 0
          </span>
          <button
            onClick={handleOpenUrl}
            title="새 탭에서 사이트 열기"
            className="p-1.5 rounded-lg bg-amber-400 text-slate-950 font-bold hover:bg-amber-300 transition-colors flex items-center gap-1 text-xs shadow-md"
          >
            <span>방문</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Node Title */}
      <h3 className="font-black text-base text-amber-200 truncate leading-snug mb-1">
        {data.title || data.id}
      </h3>

      {/* Highly Visible URL Badge */}
      <div className="flex items-center justify-between gap-1.5 bg-slate-950 p-2 rounded-xl border border-amber-500/40 shadow-inner mb-3">
        <span className="font-mono text-xs font-extrabold text-amber-300 truncate select-all">
          {data.url}
        </span>
        <button
          onClick={handleCopyUrl}
          className="p-1 rounded bg-amber-500/20 hover:bg-amber-500/40 text-amber-300 transition-colors text-[10px]"
          title="URL 주소 복사"
        >
          {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Metrics & Backlink List Button */}
      <div className="pt-2 border-t border-amber-500/30 flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 text-emerald-400 font-extrabold bg-emerald-950/60 px-2.5 py-1 rounded-lg border border-emerald-500/40">
            <Link2 className="w-3.5 h-3.5" />
            <span>수신 백링크 총 {data.inboundCount || 0}개</span>
          </div>
          <span className="text-[10px] text-amber-300/80 font-semibold">최상단 고정 노드</span>
        </div>

        {/* Toggle Backlink List Button */}
        {data.inboundCount > 0 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowUrlList(!showUrlList);
            }}
            className="w-full py-1.5 px-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-xs font-bold flex items-center justify-between border border-amber-500/30 transition-colors"
          >
            <span>🔗 수신 백링크 URL 목록 ({data.inboundCount}개)</span>
            {showUrlList ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>

      {/* Expanded Backlink URL List */}
      {showUrlList && (
        <div className="mt-2 p-2 bg-slate-950/90 rounded-xl border border-amber-500/40 text-xs space-y-1 max-h-36 overflow-y-auto font-mono">
          <div className="text-[11px] font-bold text-amber-300 border-b border-amber-500/20 pb-1">
            이 머니사이트로 들어오는 백링크:
          </div>
          <ul className="space-y-1 text-[10px] text-slate-300">
            {/* Display list of PBNs or sites pointing to this money site */}
            <li className="text-amber-200/90 italic">PBN1, PBN2, PBN3, PBN4, PBN5 네트워크에서 백링크 제공 중</li>
          </ul>
        </div>
      )}

      {/* Bottom Handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-amber-400 !w-5 !h-5 !border-3 !border-slate-900 rounded-full hover:scale-150 transition-transform shadow-lg shadow-amber-500/50"
      />

      {/* Hover Tooltip */}
      {showTooltip && !showUrlList && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-3 w-72 p-3.5 bg-slate-900/95 border-2 border-amber-400 rounded-xl shadow-2xl backdrop-blur-xl text-xs space-y-1.5 pointer-events-none animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-center gap-1.5 text-amber-300 font-extrabold border-b border-amber-500/30 pb-1">
            <Info className="w-4 h-4 text-amber-400" />
            <span>머니사이트 상세 메모</span>
          </div>
          <p className="text-slate-100 leading-relaxed font-normal whitespace-pre-wrap">
            {data.memo || '작성된 메모가 없습니다.'}
          </p>
        </div>
      )}
    </div>
  );
}
