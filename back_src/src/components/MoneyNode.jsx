import React, { useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Crown, ExternalLink, Info, Link2, Copy, Check, ChevronDown, ChevronUp } from 'lucide-react';

const HANDLE_POSITIONS = [12, 25, 38, 50, 62, 75, 88];

export default function MoneyNode({ data, selected }) {
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
      className={`relative group rounded-2xl p-4 transition-all duration-300 min-w-[310px] max-w-[350px] border-3 backdrop-blur-xl cursor-pointer ${
        selected
          ? 'border-amber-400 ring-8 ring-amber-400/40 scale-105 shadow-2xl'
          : 'border-amber-400/90 hover:border-amber-300 hover:scale-[1.02] shadow-xl'
      } bg-gradient-to-br from-slate-900 via-amber-950/80 to-slate-950 text-slate-100 ring-2 ring-amber-500/40`}
    >
      {/* Target Handles Across Top */}
      {HANDLE_POSITIONS.map((pos, idx) => (
        <Handle
          key={`in-${idx}`}
          type="target"
          position={Position.Top}
          id={`in-${idx}`}
          style={{ left: `${pos}%` }}
          className="!bg-amber-400 !w-4 !h-4 !border-2 !border-slate-900 rounded-full shadow-md"
        />
      ))}

      {/* Golden Crown Badge Header */}
      <div className="flex items-center justify-between gap-1.5 mb-2.5 pb-2 border-b border-amber-500/40">
        <div className="flex items-center gap-1.5 bg-gradient-to-r from-amber-500/30 to-yellow-500/30 border border-amber-400/60 text-amber-200 px-3 py-1 rounded-full text-xs font-black shadow">
          <Crown className="w-4 h-4 text-amber-300 animate-pulse" />
          <span className="text-amber-100 font-extrabold tracking-wide">👑 최상단 대표 머니사이트</span>
        </div>

        <button
          onClick={handleOpenUrl}
          title="새 탭에서 사이트 열기"
          className="p-1.5 rounded-lg bg-amber-400 text-slate-950 font-black hover:bg-amber-300 transition-colors flex items-center gap-1 text-xs shadow-md"
        >
          <span>바로가기</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Node Main Title */}
      <h3 className="font-black text-base text-amber-200 truncate leading-snug mb-1">
        {data.title || data.id}
      </h3>

      {/* Highly Visible URL Box */}
      <div className="flex items-center justify-between gap-1.5 bg-slate-950 p-2.5 rounded-xl border border-amber-500/50 shadow-inner mb-3">
        <span className="font-mono text-xs font-extrabold text-amber-300 truncate select-all">
          {data.url}
        </span>
        <button
          onClick={handleCopyUrl}
          className="p-1 rounded bg-amber-500/20 hover:bg-amber-500/40 text-amber-300 transition-colors text-[10px]"
          title="주소 복사"
        >
          {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Summary Note & Inbound Backlink Accordion */}
      <div className="pt-2 border-t border-amber-500/30 flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 text-emerald-400 font-black bg-emerald-950/70 px-2.5 py-1 rounded-lg border border-emerald-500/50">
            <Link2 className="w-4 h-4" />
            <span>수신 백링크 총 {data.inboundCount || 0}개</span>
          </div>
          <span className="text-[11px] font-bold text-amber-300 bg-slate-950 px-2 py-0.5 rounded border border-amber-500/30">
            [최종 목표 사이트]
          </span>
        </div>

        {/* Toggle Backlink List */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowUrlList(!showUrlList);
          }}
          className="w-full py-1.5 px-2.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-xs font-extrabold flex items-center justify-between border border-amber-500/40 transition-colors"
        >
          <span>📥 연결된 PBN 목록 보기 ({data.inboundCount}개 수신 중)</span>
          {showUrlList ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Expanded PBN List */}
      {showUrlList && (
        <div className="mt-2 p-2.5 bg-slate-950 rounded-xl border border-amber-500/50 text-xs space-y-1.5 max-h-48 overflow-y-auto font-mono">
          <div className="text-[11px] font-extrabold text-amber-300 border-b border-amber-500/20 pb-1">
            이 머니사이트로 백링크를 보내는 PBN ({data.inboundSites ? data.inboundSites.length : 0}개):
          </div>
          {data.inboundSites && data.inboundSites.length > 0 ? (
            <ul className="space-y-1 text-[10px] text-slate-200">
              {data.inboundSites.map((site, sIdx) => (
                <li
                  key={sIdx}
                  className="p-1.5 bg-slate-900 hover:bg-slate-800 rounded border border-slate-800 flex justify-between items-center transition-colors"
                >
                  <div className="flex items-center gap-1.5 truncate flex-1 min-w-0 pr-2">
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: site.color || '#6366f1' }}
                    />
                    <span className="truncate font-semibold">{site.title || site.id}</span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(site.url, '_blank');
                    }}
                    className="text-amber-400 hover:text-amber-300 flex-shrink-0"
                    title="방문하기"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[10px] text-slate-500 py-1 text-center">연결된 PBN이 없습니다.</p>
          )}
        </div>
      )}

      {/* Source Handles Across Bottom */}
      {HANDLE_POSITIONS.map((pos, idx) => (
        <Handle
          key={`out-${idx}`}
          type="source"
          position={Position.Bottom}
          id={`out-${idx}`}
          style={{ left: `${pos}%` }}
          className="!bg-amber-400 !w-4 !h-4 !border-2 !border-slate-900 rounded-full shadow-md"
        />
      ))}
    </div>
  );
}
