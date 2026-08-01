import React, { useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Layers, ExternalLink, Info, ArrowUpRight, ArrowDownLeft, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';

const HANDLE_POSITIONS = [12, 25, 38, 50, 62, 75, 88];

export default function PBNNode({ data, selected }) {
  const [showUrlList, setShowUrlList] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  const nodeColor = data.color || '#8b5cf6';
  const tier = data.tier !== undefined ? data.tier : 1;

  const tierBadgeText = tier === 1 ? '🥇 1차 백링크 PBN' : tier === 2 ? '🥈 2차 지원 PBN' : '🥉 3차 하부 PBN';

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
          ? `0 0 25px ${nodeColor}90, inset 0 0 15px ${nodeColor}30`
          : `0 8px 20px -4px ${nodeColor}40`
      }}
      className={`relative group rounded-2xl p-4 transition-all duration-300 min-w-[300px] max-w-[340px] border-2 backdrop-blur-xl cursor-pointer ${
        selected ? 'scale-105 ring-4' : 'hover:scale-[1.02]'
      } bg-slate-900/95 text-slate-100`}
    >
      {/* Target Handles Across Top */}
      {HANDLE_POSITIONS.map((pos, idx) => (
        <Handle
          key={`in-${idx}`}
          type="target"
          position={Position.Top}
          id={`in-${idx}`}
          style={{ left: `${pos}%`, backgroundColor: nodeColor }}
          className="!w-3.5 !h-3.5 !border-2 !border-slate-900 rounded-full shadow-md"
        />
      ))}

      {/* Header Bar with Human Friendly Tier Label */}
      <div className="flex items-center justify-between gap-1.5 mb-2 pb-2 border-b border-slate-800">
        <div
          style={{ backgroundColor: `${nodeColor}25`, color: nodeColor, borderColor: `${nodeColor}60` }}
          className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-xs font-black"
        >
          <Layers className="w-3.5 h-3.5" />
          <span>{tierBadgeText}</span>
        </div>

        <button
          onClick={handleOpenUrl}
          title="새 탭에서 사이트 열기"
          className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors flex items-center gap-1 text-xs px-2.5 border border-slate-700 font-bold"
        >
          <span>방문</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Main Title */}
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
          title="주소 복사"
        >
          {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Stats & Link Target Accordion */}
      <div className="pt-2 border-t border-slate-800/80 flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="flex items-center gap-1 text-amber-400 bg-amber-950/50 px-2 py-0.5 rounded border border-amber-500/30" title="이 사이트가 링크를 보냄">
            <ArrowUpRight className="w-3.5 h-3.5 text-amber-400" />
            <span>보내는 백링크: {data.outboundCount || 0}개</span>
          </span>
          <span className="flex items-center gap-1 text-emerald-400 bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-500/30" title="이 사이트로 링크가 들어옴">
            <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-400" />
            <span>받는 백링크: {data.inboundCount || 0}개</span>
          </span>
        </div>

        {/* Toggle Target URLs */}
        {data.targets && data.targets.length > 0 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowUrlList(!showUrlList);
            }}
            style={{ backgroundColor: `${nodeColor}20`, borderColor: `${nodeColor}50`, color: nodeColor }}
            className="w-full py-1.5 px-2.5 rounded-lg text-xs font-extrabold flex items-center justify-between border transition-colors mt-1"
          >
            <span>🔗 이 사이트가 링크를 보내는 백링크 목록 ({data.targets.length}개)</span>
            {showUrlList ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>

      {/* Target URL List Accordion */}
      {showUrlList && data.targets && data.targets.length > 0 && (
        <div className="mt-2 p-2 bg-slate-950 rounded-xl border border-slate-800 text-xs space-y-1 max-h-40 overflow-y-auto font-mono">
          <div className="text-[10px] font-bold text-slate-400 border-b border-slate-800 pb-1">
            연결된 백링크 타겟 URL:
          </div>
          <ul className="space-y-1 text-[10px]">
            {data.targets.map((t, idx) => (
              <li key={idx} className="flex items-center justify-between gap-1 p-1.5 bg-slate-900 rounded border border-slate-800 text-slate-200">
                <span className="truncate flex-1">{t}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(t, '_blank');
                  }}
                  className="text-slate-400 hover:text-white"
                  title="이 URL 방문"
                >
                  <ExternalLink className="w-3 h-3" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Source Handles Across Bottom */}
      {HANDLE_POSITIONS.map((pos, idx) => (
        <Handle
          key={`out-${idx}`}
          type="source"
          position={Position.Bottom}
          id={`out-${idx}`}
          style={{ left: `${pos}%`, backgroundColor: nodeColor }}
          className="!w-3.5 !h-3.5 !border-2 !border-slate-900 rounded-full shadow-md"
        />
      ))}
    </div>
  );
}
