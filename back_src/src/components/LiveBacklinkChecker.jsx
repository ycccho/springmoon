import React, { useState, useEffect } from 'react';
import {
  Search,
  Globe,
  ExternalLink,
  Download,
  Copy,
  Check,
  Sparkles,
  RefreshCw,
  Layers,
  Crown,
  TrendingUp,
  ShieldCheck,
  ArrowRight,
  Filter,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

export default function LiveBacklinkChecker({ defaultDomain = 'busaninterior.kr', onSwitchToGraph }) {
  const [queryInput, setQueryInput] = useState(defaultDomain);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [searchData, setSearchData] = useState(null);
  
  // Table filters & sorting
  const [tableFilter, setTableFilter] = useState('all'); // 'all' | 'pbn' | 'naver' | 'google'
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedUrl, setCopiedUrl] = useState(null);

  // Quick Preset Domains
  const PRESET_DOMAINS = [
    { label: '🥇 busaninterior.kr (PBN 1)', val: 'busaninterior.kr' },
    { label: '👑 inde.co.kr (머니사이트)', val: 'inde.co.kr' },
    { label: '🥇 pbn-1.pages.dev (PBN 2)', val: 'pbn-1.pages.dev' },
    { label: '🥈 pbn-2.pages.dev (PBN 3)', val: 'pbn-2.pages.dev' },
    { label: '🥈 academyinteriors.pages.dev', val: 'academyinteriors.pages.dev' },
    { label: '🥈 officeinteriors.pages.dev', val: 'officeinteriors.pages.dev' }
  ];

  const handleSearch = async (overrideQuery) => {
    const q = overrideQuery || queryInput;
    if (!q || !q.trim()) {
      setErrorMsg('조회할 URL 또는 도메인을 입력해주세요.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/backlink?domain=${encodeURIComponent(q.trim())}`);
      if (!res.ok) {
        throw new Error(`백링크 조회 서버 오류 (HTTP ${res.status})`);
      }
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || '백링크 조회에 실패했습니다.');
      }
      setSearchData(data);
    } catch (err) {
      setErrorMsg(err.message || '백링크 조회 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // Auto search on initial mount
  useEffect(() => {
    handleSearch('busaninterior.kr');
  }, []);

  const handleCopy = (url) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  const handleExportCSV = () => {
    if (!searchData || !searchData.backlinks || searchData.backlinks.length === 0) return;
    let csvContent = 'data:text/csv;charset=utf-8,\uFEFF';
    csvContent += '번호,출처도메인,백링크페이지URL,앵커텍스트및타이틀,수집엔진,타겟URL,링크유형\n';

    searchData.backlinks.forEach((b, idx) => {
      const row = [
        idx + 1,
        `"${b.sourceDomain}"`,
        `"${b.sourceUrl}"`,
        `"${(b.anchorText || '').replace(/"/g, '""')}"`,
        `"${b.engine}"`,
        `"${b.targetUrl}"`,
        `"${b.rel || 'dofollow'}"`
      ].join(',');
      csvContent += row + '\n';
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `backlinks_${searchData.domain}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter backlinks
  const filteredBacklinks = (searchData?.backlinks || []).filter(b => {
    const matchFilter =
      tableFilter === 'all' ||
      (tableFilter === 'pbn' && b.engineType === 'pbn') ||
      (tableFilter === 'naver' && b.engineType === 'naver') ||
      (tableFilter === 'google' && b.engineType === 'google');

    const matchSearch =
      !searchTerm.trim() ||
      b.sourceDomain.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.sourceUrl.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (b.anchorText && b.anchorText.toLowerCase().includes(searchTerm.toLowerCase()));

    return matchFilter && matchSearch;
  });

  return (
    <div className="flex-1 w-full bg-slate-950 text-slate-100 overflow-y-auto p-4 sm:p-8 space-y-6">
      {/* 1. Main Search Header Box */}
      <div className="max-w-6xl mx-auto bg-gradient-to-br from-slate-900 via-indigo-950/80 to-slate-900 p-6 sm:p-8 rounded-3xl border border-indigo-500/30 shadow-2xl space-y-5">
        <div className="text-center space-y-2 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/40 text-indigo-300 text-xs font-bold shadow">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>실시간 인바운드 백링크 전수 조회 엔진</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-100 tracking-tight">
            어떤 사이트의 백링크를 조회할까요?
          </h2>
          <p className="text-xs sm:text-sm text-slate-400">
            조회할 도메인 또는 URL을 입력하면, 인터넷에서 <strong>이 사이트를 언급하고 링크를 보낸 모든 외부 웹페이지(인바운드 백링크)</strong>를 실시간으로 검색하여 추출합니다.
          </p>
        </div>

        {/* Search Input Bar */}
        <div className="max-w-3xl mx-auto">
          <div className="flex flex-col sm:flex-row gap-2 bg-slate-950 p-2 rounded-2xl border border-indigo-500/40 shadow-inner">
            <div className="relative flex-1 flex items-center">
              <Globe className="w-5 h-5 text-indigo-400 absolute left-3.5" />
              <input
                type="text"
                value={queryInput}
                onChange={e => setQueryInput(e.target.value)}
                placeholder="도메인 또는 URL 입력 (예: https://busaninterior.kr 또는 inde.co.kr)"
                className="w-full bg-transparent pl-11 pr-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none font-mono"
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <button
              onClick={() => handleSearch()}
              disabled={isLoading}
              className="px-8 py-3 bg-gradient-to-r from-amber-500 via-indigo-600 to-violet-600 hover:from-amber-400 hover:via-indigo-500 hover:to-violet-500 text-slate-950 font-black text-sm rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 flex-shrink-0"
            >
              {isLoading ? <RefreshCw className="w-4 h-4 animate-spin text-slate-950" /> : <Search className="w-4 h-4 text-slate-950" />}
              <span>{isLoading ? '실시간 스캔 중...' : '백링크 실시간 조회'}</span>
            </button>
          </div>
        </div>

        {/* Quick Presets */}
        <div className="max-w-3xl mx-auto flex flex-wrap items-center justify-center gap-2 pt-1">
          <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
            <TrendingUp className="w-3 h-3 text-amber-400" />
            빠른 검수:
          </span>
          {PRESET_DOMAINS.map((p, idx) => (
            <button
              key={idx}
              onClick={() => {
                setQueryInput(p.val);
                handleSearch(p.val);
              }}
              className="px-2.5 py-1 rounded-lg bg-slate-900/90 hover:bg-indigo-900/80 border border-slate-800 hover:border-indigo-500/40 text-[11px] font-mono text-slate-300 hover:text-white transition-colors"
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="max-w-3xl mx-auto p-3 bg-rose-950/60 border border-rose-800/60 rounded-xl text-rose-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
      </div>

      {/* 2. Results Section */}
      {searchData && (
        <div className="max-w-6xl mx-auto space-y-5 animate-in fade-in duration-300">
          {/* Summary Stat Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-2xl bg-slate-900/90 border border-indigo-500/30 shadow-lg space-y-1">
              <span className="text-[11px] font-bold text-slate-400 block">총 발견된 인바운드 백링크</span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-amber-400">
                  {searchData.summary?.totalBacklinks || 0}
                </span>
                <span className="text-xs text-slate-400">개 연결</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-lg space-y-1">
              <span className="text-[11px] font-bold text-slate-400 block">고유 참조 도메인 (Referring Domains)</span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-cyan-400">
                  {searchData.summary?.referringDomainsCount || 0}
                </span>
                <span className="text-xs text-slate-400">개 도메인</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-lg space-y-1">
              <span className="text-[11px] font-bold text-slate-400 block">네트워크 PBN 백링크</span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-emerald-400">
                  {searchData.summary?.pbnCount || 0}
                </span>
                <span className="text-xs text-slate-400">개 직결</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-lg space-y-1">
              <span className="text-[11px] font-bold text-slate-400 block">OpenPageRank 신뢰도 지수</span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-purple-400">
                  {searchData.summary?.pageRank?.pageRankDecimal || '0.00'}
                </span>
                <span className="text-[11px] text-slate-400 font-mono">/ 10</span>
              </div>
            </div>
          </div>

          {/* Backlink Data Table Container */}
          <div className="bg-slate-900/90 rounded-3xl border border-slate-800 shadow-2xl overflow-hidden space-y-4 p-5 sm:p-6">
            {/* Header & Table Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
              <div>
                <h3 className="text-base font-extrabold text-slate-100 flex items-center gap-2">
                  <span>인바운드 백링크 전수 목록</span>
                  <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-mono font-bold">
                    {filteredBacklinks.length}개 표시 중
                  </span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5 font-mono">
                  대상 사이트: <strong className="text-amber-300">{searchData.domain}</strong>
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Search in Table */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    placeholder="결과 내 검색..."
                    className="bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-100 focus:border-indigo-500 focus:outline-none w-36 sm:w-48 font-mono"
                  />
                </div>

                {/* Filter Pills */}
                <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-bold">
                  {[
                    { key: 'all', label: '전체' },
                    { key: 'pbn', label: 'PBN 직결' },
                    { key: 'naver', label: '네이버' },
                    { key: 'google', label: '구글 색인' }
                  ].map(f => (
                    <button
                      key={f.key}
                      onClick={() => setTableFilter(f.key)}
                      className={`px-2.5 py-1 rounded-lg transition-colors text-[11px] ${
                        tableFilter === f.key
                          ? 'bg-indigo-600 text-white shadow'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                {/* Export CSV */}
                <button
                  onClick={handleExportCSV}
                  className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>CSV 다운로드</span>
                </button>
              </div>
            </div>

            {/* Backlink Data Grid */}
            <div className="overflow-x-auto rounded-2xl border border-slate-800">
              <table className="w-full text-left text-xs text-slate-200">
                <thead className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3.5 px-4 w-12 text-center">#</th>
                    <th className="py-3.5 px-4">출처 도메인 (Referring Domain)</th>
                    <th className="py-3.5 px-4">백링크 발견 페이지 (Source URL)</th>
                    <th className="py-3.5 px-4">앵커 텍스트 (Anchor Text) / 타이틀</th>
                    <th className="py-3.5 px-4">수집 엔진</th>
                    <th className="py-3.5 px-4">연결 타겟 URL</th>
                    <th className="py-3.5 px-4 text-center">링크 열기</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
                  {filteredBacklinks.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-500 text-xs">
                        검색 조건과 일치하는 인바운드 백링크가 없습니다.
                      </td>
                    </tr>
                  ) : (
                    filteredBacklinks.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/50 transition-colors">
                        <td className="py-3.5 px-4 font-mono text-slate-500 text-center text-[11px]">
                          {idx + 1}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className="px-2.5 py-1 rounded-lg bg-indigo-950/80 border border-indigo-500/30 text-indigo-300 font-mono font-bold text-xs">
                            {item.sourceDomain}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 max-w-[260px]">
                          <div className="flex items-center gap-1.5 font-mono text-slate-300">
                            <span className="truncate select-all" title={item.sourceUrl}>
                              {item.sourceUrl}
                            </span>
                            <button
                              onClick={() => handleCopy(item.sourceUrl)}
                              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors flex-shrink-0"
                              title="URL 복사"
                            >
                              {copiedUrl === item.sourceUrl ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 max-w-[220px]">
                          <div className="font-bold text-slate-100 truncate" title={item.anchorText}>
                            "{item.anchorText}"
                          </div>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                              item.engineType === 'pbn'
                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-black'
                                : item.engineType === 'naver'
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
                            }`}
                          >
                            {item.engine}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-amber-300/90 text-[11px] max-w-[180px] truncate">
                          {item.targetUrl}
                        </td>
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          <button
                            onClick={() => window.open(item.sourceUrl, '_blank', 'noopener,noreferrer')}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white transition-colors"
                            title="새 탭에서 열기"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
