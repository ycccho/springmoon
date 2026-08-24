import React, { useState } from 'react';
import {
  Table,
  Search,
  Download,
  ExternalLink,
  Crown,
  Layers,
  Target,
  ArrowUpDown,
  Filter,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';

export default function BacklinkTable({ sites, setSites, onSelectSiteForEdit }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all'); // 'all' | 'money' | 'pbn' | 'target'
  const [sortField, setSortField] = useState('title'); // 'title' | 'targets' | 'type'
  const [sortAsc, setSortAsc] = useState(true);

  // Statistics
  const totalSites = sites.length;
  const moneySites = sites.filter(s => s.type === 'money').length;
  const pbnSites = sites.filter(s => s.type === 'pbn').length;
  const targetSites = sites.filter(s => s.type === 'target').length;
  const totalEdges = sites.reduce((acc, s) => acc + (s.targets ? s.targets.length : 0), 0);

  // Filter & Sort
  const filteredSites = sites
    .filter(s => {
      const matchSearch =
        s.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.url.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.memo && s.memo.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchType = typeFilter === 'all' || s.type === typeFilter;
      return matchSearch && matchType;
    })
    .sort((a, b) => {
      let valA = a[sortField] || '';
      let valB = b[sortField] || '';
      if (sortField === 'targets') {
        valA = a.targets ? a.targets.length : 0;
        valB = b.targets ? b.targets.length : 0;
      }
      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });

  const handleExportCSV = () => {
    let csvContent = 'data:text/csv;charset=utf-8,\uFEFF';
    csvContent += '사이트ID,표시이름,유형,URL,보내는백링크수,연결타겟URL목록,메모\n';

    sites.forEach(s => {
      const targetsStr = (s.targets || []).join(' | ');
      const row = [
        `"${s.id}"`,
        `"${s.title.replace(/"/g, '""')}"`,
        `"${s.type}"`,
        `"${s.url}"`,
        s.targets ? s.targets.length : 0,
        `"${targetsStr.replace(/"/g, '""')}"`,
        `"${(s.memo || '').replace(/"/g, '""')}"`
      ].join(',');
      csvContent += row + '\n';
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `backlink_network_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex-1 w-full bg-slate-950 text-slate-100 overflow-y-auto p-4 sm:p-6 space-y-6">
      {/* Stat Cards */}
      <div className="max-w-6xl mx-auto grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 shadow">
          <span className="text-[11px] text-slate-400 font-bold block">전체 등록 사이트</span>
          <span className="text-xl font-black text-slate-100 block mt-1">{totalSites}개</span>
        </div>
        <div className="p-4 rounded-xl bg-slate-900 border border-amber-500/30 shadow">
          <span className="text-[11px] text-amber-400 font-bold block">👑 머니사이트</span>
          <span className="text-xl font-black text-amber-300 block mt-1">{moneySites}개</span>
        </div>
        <div className="p-4 rounded-xl bg-slate-900 border border-indigo-500/30 shadow">
          <span className="text-[11px] text-indigo-400 font-bold block">🥇 PBN 사이트</span>
          <span className="text-xl font-black text-indigo-300 block mt-1">{pbnSites}개</span>
        </div>
        <div className="p-4 rounded-xl bg-slate-900 border border-cyan-500/30 shadow">
          <span className="text-[11px] text-cyan-400 font-bold block">🎯 타겟 / 소셜</span>
          <span className="text-xl font-black text-cyan-300 block mt-1">{targetSites}개</span>
        </div>
        <div className="p-4 rounded-xl bg-slate-900 border border-emerald-500/30 shadow">
          <span className="text-[11px] text-emerald-400 font-bold block">총 백링크 연결선</span>
          <span className="text-xl font-black text-emerald-300 block mt-1">{totalEdges}개</span>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="max-w-6xl mx-auto bg-slate-900/90 rounded-2xl border border-slate-800 shadow-xl overflow-hidden space-y-4 p-5">
        {/* Controls Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <div className="relative w-full">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="사이트 명칭, 도메인, URL 또는 메모 검색..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-bold">
              {['all', 'money', 'pbn', 'target'].map(t => (
                <button
                  key={t}
                  onClick={() => setTypeFilter(t)}
                  className={`px-3 py-1.5 rounded-lg transition-colors capitalize ${
                    typeFilter === t ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {t === 'all' ? '전체' : t === 'money' ? '머니' : t === 'pbn' ? 'PBN' : '타겟'}
                </button>
              ))}
            </div>

            <button
              onClick={handleExportCSV}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>CSV 내보내기</span>
            </button>
          </div>
        </div>

        {/* Data Grid Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-left text-xs text-slate-200">
            <thead className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">구분</th>
                <th className="py-3 px-4 cursor-pointer hover:text-white" onClick={() => { setSortField('title'); setSortAsc(!sortAsc); }}>
                  <div className="flex items-center gap-1">
                    <span>사이트 명칭 & ID</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="py-3 px-4">사이트 URL</th>
                <th className="py-3 px-4 cursor-pointer hover:text-white" onClick={() => { setSortField('targets'); setSortAsc(!sortAsc); }}>
                  <div className="flex items-center gap-1">
                    <span>발신 백링크 ({totalEdges})</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="py-3 px-4">연결된 타겟 URL</th>
                <th className="py-3 px-4">메모</th>
                <th className="py-3 px-4 text-right">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
              {filteredSites.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    검색 조건과 일치하는 사이트가 없습니다.
                  </td>
                </tr>
              ) : (
                filteredSites.map((s, idx) => (
                  <tr key={s.id || idx} className="hover:bg-slate-800/50 transition-colors">
                    <td className="py-3 px-4 whitespace-nowrap">
                      {s.type === 'money' && (
                        <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold text-[10px]">
                          👑 머니
                        </span>
                      )}
                      {s.type === 'pbn' && (
                        <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 font-bold text-[10px]">
                          🥇 PBN
                        </span>
                      )}
                      {s.type === 'target' && (
                        <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold text-[10px]">
                          🎯 타겟
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-100 max-w-[160px] truncate">
                      {s.title}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-300 max-w-[200px] truncate">
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noreferrer"
                        className="hover:text-amber-400 flex items-center gap-1"
                      >
                        <span className="truncate">{s.url}</span>
                        <ExternalLink className="w-3 h-3 flex-shrink-0" />
                      </a>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded bg-slate-950 font-mono font-bold text-amber-400 border border-slate-800">
                        {s.targets ? s.targets.length : 0}개
                      </span>
                    </td>
                    <td className="py-3 px-4 max-w-[240px]">
                      {s.targets && s.targets.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {s.targets.map((t, tIdx) => (
                            <span
                              key={tIdx}
                              className="px-1.5 py-0.5 bg-slate-950 rounded text-[10px] font-mono text-indigo-300 border border-indigo-500/20 truncate max-w-[160px]"
                              title={t}
                            >
                              {t.replace(/^(https?:\/\/)?(www\.)?/, '')}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-500 text-[11px]">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-400 text-[11px] max-w-[180px] truncate">
                      {s.memo || '-'}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <button
                        onClick={() => onSelectSiteForEdit && onSelectSiteForEdit(s)}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-indigo-600 text-slate-200 hover:text-white font-bold text-[11px] transition-colors"
                      >
                        수정
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
  );
}
