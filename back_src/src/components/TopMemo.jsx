import React, { useState } from 'react';
import { StickyNote, ChevronDown, ChevronUp, Save, Check, Copy, Trash2 } from 'lucide-react';

export default function TopMemo({ memo, setMemo }) {
  const [isOpen, setIsOpen] = useState(true);
  const [copied, setCopied] = useState(false);
  const [savedStatus, setSavedStatus] = useState(false);

  const handleChange = (e) => {
    setMemo(e.target.value);
    setSavedStatus(true);
    setTimeout(() => setSavedStatus(false), 2000);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(memo);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClear = () => {
    if (window.confirm('상단 메모장의 모든 내용을 지우시겠습니까?')) {
      setMemo('');
    }
  };

  return (
    <div className="w-full bg-slate-900/90 border-b border-indigo-500/20 backdrop-blur-md shadow-xl transition-all duration-300">
      {/* Header Bar */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between cursor-pointer hover:bg-slate-800/50 transition-colors select-none"
      >
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-indigo-500/20 border border-indigo-400/30 text-indigo-300">
            <StickyNote className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              전체 프로젝트 진행 상황 & 메모장
              {savedStatus && (
                <span className="text-[11px] font-normal text-emerald-400 flex items-center gap-1 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-500/30">
                  <Check className="w-3 h-3" /> 저장됨
                </span>
              )}
            </h2>
            <p className="text-[11px] text-slate-400">
              {isOpen ? '클릭하여 메모장 접기' : '클릭하여 메모장 펼치기 (자동 저장됨)'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400 font-mono hidden sm:inline">
            {memo.length} 글자
          </span>
          <button
            type="button"
            className="p-1 rounded-lg bg-slate-800 text-slate-300 hover:text-white transition-colors"
          >
            {isOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Collapsible Content */}
      {isOpen && (
        <div className="max-w-7xl mx-auto px-4 pb-4 animate-in slide-in-from-top-2 duration-200">
          <div className="relative">
            <textarea
              value={memo}
              onChange={handleChange}
              placeholder="프로젝트 진행 상황, 백링크 구성 내역, 업데이트 노트 등을 자유롭게 기록하세요. (브라우저 로컬 스토리지에 자동 저장됩니다)"
              rows={4}
              className="w-full bg-slate-950/80 text-slate-100 text-sm font-sans p-3.5 rounded-xl border border-indigo-500/30 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 focus:outline-none resize-y placeholder:text-slate-500 leading-relaxed shadow-inner"
            />

            {/* Quick Actions inside Textarea */}
            <div className="absolute bottom-3 right-3 flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopy}
                className="px-2.5 py-1 text-xs rounded-md bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1 transition-colors"
                title="복사하기"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? '복사됨' : '복사'}</span>
              </button>
              <button
                type="button"
                onClick={handleClear}
                className="px-2 py-1 text-xs rounded-md bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800/50 flex items-center gap-1 transition-colors"
                title="지우기"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
