import React, { useState } from 'react';
import {
  Plus,
  List,
  RotateCcw,
  Download,
  Upload,
  Trash2,
  Edit2,
  ExternalLink,
  Crown,
  Layers,
  Target,
  Search,
  Check,
  X,
  SlidersHorizontal,
  ChevronRight,
  ChevronLeft
} from 'lucide-react';
import { INITIAL_SITES, DEFAULT_MEMO, normalizeUrl } from '../initialData';

export default function SidePanel({
  sites,
  setSites,
  setMemo,
  editingSite,
  setEditingSite,
  isOpen,
  setIsOpen
}) {
  const [activeTab, setActiveTab] = useState('add'); // 'add' | 'list' | 'settings'

  // Form State
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [type, setType] = useState('pbn'); // 'money' | 'pbn' | 'target'
  const [selectedTargets, setSelectedTargets] = useState([]);
  const [customTargetInput, setCustomTargetInput] = useState('');
  const [memoText, setMemoText] = useState('');

  // Search Filter in List tab
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  // Populate form if editingSite changes
  React.useEffect(() => {
    if (editingSite) {
      setUrl(editingSite.url || '');
      setTitle(editingSite.title || '');
      setType(editingSite.type || 'pbn');
      setSelectedTargets(editingSite.targets || []);
      setMemoText(editingSite.memo || '');
      setActiveTab('add');
    }
  }, [editingSite]);

  const resetForm = () => {
    setUrl('');
    setTitle('');
    setType('pbn');
    setSelectedTargets([]);
    setCustomTargetInput('');
    setMemoText('');
    setEditingSite(null);
  };

  const handleTargetToggle = (targetUrl) => {
    if (selectedTargets.includes(targetUrl)) {
      setSelectedTargets(selectedTargets.filter(t => t !== targetUrl));
    } else {
      setSelectedTargets([...selectedTargets, targetUrl]);
    }
  };

  const handleAddCustomTarget = () => {
    if (!customTargetInput.trim()) return;
    let target = customTargetInput.trim();
    if (!target.startsWith('http://') && !target.startsWith('https://')) {
      target = 'https://' + target;
    }
    if (!selectedTargets.includes(target)) {
      setSelectedTargets([...selectedTargets, target]);
    }
    setCustomTargetInput('');
  };

  const handleSubmitForm = (e) => {
    e.preventDefault();
    if (!url.trim()) {
      alert('사이트 URL을 입력해 주세요.');
      return;
    }

    let formattedUrl = url.trim();
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = 'https://' + formattedUrl;
    }

    const siteId = normalizeUrl(formattedUrl);
    const newSite = {
      id: siteId,
      url: formattedUrl,
      title: title.trim() || siteId,
      type: type,
      memo: memoText.trim(),
      targets: selectedTargets
    };

    if (editingSite) {
      // Update
      setSites(sites.map(s => (s.id === editingSite.id ? newSite : s)));
    } else {
      // Check if exists
      const exists = sites.some(s => s.id === siteId);
      if (exists) {
        setSites(sites.map(s => (s.id === siteId ? newSite : s)));
      } else {
        setSites([...sites, newSite]);
      }
    }

    resetForm();
    alert(editingSite ? '사이트 정보가 수정되었습니다.' : '신규 사이트가 추가되었습니다.');
  };

  const handleDeleteSite = (siteId) => {
    if (window.confirm(`'${siteId}' 사이트를 정말 삭제하시겠습니까?`)) {
      setSites(sites.filter(s => s.id !== siteId));
      if (editingSite && editingSite.id === siteId) {
        resetForm();
      }
    }
  };

  const handleResetPreset = () => {
    if (window.confirm('초기 데이터(머니사이트 1개, PBN 6개 및 백링크 세트)로 복원하시겠습니까? 현 수정내역은 초기화됩니다.')) {
      setSites(INITIAL_SITES);
      setMemo(DEFAULT_MEMO);
      resetForm();
      alert('초기 설정으로 복원되었습니다.');
    }
  };

  const handleExportJSON = () => {
    const dataStr = JSON.stringify({ sites, memo: DEFAULT_MEMO }, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `backlink_dashboard_${new Date().toISOString().slice(0,10)}.json`;
    link.click();
  };

  const handleImportJSON = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        if (parsed.sites && Array.isArray(parsed.sites)) {
          setSites(parsed.sites);
          if (parsed.memo) setMemo(parsed.memo);
          alert('데이터를 성공적으로 불러왔습니다.');
        } else {
          alert('올바르지 않은 JSON 데이터 형식입니다.');
        }
      } catch (err) {
        alert('JSON 파일 읽기 오류: ' + err.message);
      }
    };
    reader.readAsText(file);
  };

  // Filter sites for list tab
  const filteredSites = sites.filter(s => {
    const matchesSearch = s.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          s.url.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (s.memo && s.memo.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesType = typeFilter === 'all' || s.type === typeFilter;
    return matchesSearch && matchesType;
  });

  return (
    <div
      className={`fixed right-0 top-0 bottom-0 z-40 bg-slate-900/95 border-l border-indigo-500/20 backdrop-blur-xl shadow-2xl transition-all duration-300 flex flex-col ${
        isOpen ? 'w-96' : 'w-0 overflow-hidden border-none'
      }`}
    >
      {/* Drawer Header */}
      <div className="p-4 border-b border-indigo-500/20 flex items-center justify-between bg-slate-950/60">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-5 h-5 text-indigo-400" />
          <h2 className="font-extrabold text-slate-100 text-base">데이터 관리 패널</h2>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="p-1 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Tabs Header */}
      <div className="flex border-b border-indigo-500/20 bg-slate-950/40 p-1.5 gap-1">
        <button
          onClick={() => setActiveTab('add')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'add'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{editingSite ? '사이트 수정' : '사이트 추가'}</span>
        </button>
        <button
          onClick={() => setActiveTab('list')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'list'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <List className="w-3.5 h-3.5" />
          <span>목록 ({sites.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'settings'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>설정/백업</span>
        </button>
      </div>

      {/* Drawer Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs text-slate-200">
        {/* TAB 1: ADD / EDIT FORM */}
        {activeTab === 'add' && (
          <form onSubmit={handleSubmitForm} className="space-y-4">
            {editingSite && (
              <div className="p-2.5 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-200 flex items-center justify-between">
                <span>'<strong>{editingSite.title}</strong>' 수정 중</span>
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-xs text-amber-400 underline hover:text-amber-200"
                >
                  취소
                </button>
              </div>
            )}

            {/* Site Type */}
            <div>
              <label className="block text-slate-300 font-bold mb-1.5">사이트 구분</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setType('money')}
                  className={`py-2 px-2 rounded-lg font-bold border flex flex-col items-center gap-1 transition-all ${
                    type === 'money'
                      ? 'bg-amber-500/20 border-amber-400 text-amber-300 shadow'
                      : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <Crown className="w-4 h-4 text-amber-400" />
                  <span>머니사이트</span>
                </button>
                <button
                  type="button"
                  onClick={() => setType('pbn')}
                  className={`py-2 px-2 rounded-lg font-bold border flex flex-col items-center gap-1 transition-all ${
                    type === 'pbn'
                      ? 'bg-indigo-500/20 border-indigo-400 text-indigo-300 shadow'
                      : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <Layers className="w-4 h-4 text-indigo-400" />
                  <span>PBN 백링크</span>
                </button>
                <button
                  type="button"
                  onClick={() => setType('target')}
                  className={`py-2 px-2 rounded-lg font-bold border flex flex-col items-center gap-1 transition-all ${
                    type === 'target'
                      ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow'
                      : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <Target className="w-4 h-4 text-cyan-400" />
                  <span>타겟/소셜</span>
                </button>
              </div>
            </div>

            {/* URL Input */}
            <div>
              <label className="block text-slate-300 font-bold mb-1">사이트 URL *</label>
              <input
                type="text"
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="https://inde.co.kr/"
                className="w-full bg-slate-950/80 border border-indigo-500/30 rounded-lg p-2.5 text-slate-100 placeholder:text-slate-600 focus:border-indigo-400 focus:outline-none font-mono"
                required
              />
            </div>

            {/* Title Input */}
            <div>
              <label className="block text-slate-300 font-bold mb-1">사이트 명칭 (표시 이름)</label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="예: 부산인테리어 PBN1"
                className="w-full bg-slate-950/80 border border-indigo-500/30 rounded-lg p-2.5 text-slate-100 placeholder:text-slate-600 focus:border-indigo-400 focus:outline-none"
              />
            </div>

            {/* Target URLs (Multi-select from existing sites + Custom input) */}
            <div>
              <label className="block text-slate-300 font-bold mb-1">
                연결될 타겟 URL (이 사이트가 링크를 주는 부모 노드)
              </label>
              <p className="text-[11px] text-slate-400 mb-2">
                아래 사이트 목록에서 이 사이트가 백링크를 주고 있는 대상 사이트들을 체크하세요.
              </p>

              <div className="max-h-36 overflow-y-auto space-y-1 bg-slate-950/60 p-2 rounded-lg border border-indigo-500/20">
                {sites.map(s => (
                  <label
                    key={s.id}
                    className="flex items-center gap-2 p-1.5 rounded hover:bg-slate-800/60 cursor-pointer select-none"
                  >
                    <input
                      type="checkbox"
                      checked={selectedTargets.includes(s.url)}
                      onChange={() => handleTargetToggle(s.url)}
                      className="rounded bg-slate-900 border-indigo-500 text-indigo-600 focus:ring-0"
                    />
                    <span className="truncate flex-1 font-medium">{s.title}</span>
                    <span className="text-[10px] text-slate-500 font-mono truncate max-w-[120px]">{s.url}</span>
                  </label>
                ))}
              </div>

              {/* Add Custom Target URL if not in list */}
              <div className="mt-2 flex gap-1.5">
                <input
                  type="text"
                  value={customTargetInput}
                  onChange={e => setCustomTargetInput(e.target.value)}
                  placeholder="외부 URL 직접 입력 (https://...)"
                  className="flex-1 bg-slate-950/80 border border-indigo-500/30 rounded-lg p-2 text-slate-100 font-mono text-[11px]"
                />
                <button
                  type="button"
                  onClick={handleAddCustomTarget}
                  className="px-3 py-1.5 bg-indigo-600/80 hover:bg-indigo-600 text-white rounded-lg font-bold transition-colors"
                >
                  추가
                </button>
              </div>

              {/* Selected Target Pills */}
              {selectedTargets.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {selectedTargets.map((t, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 bg-indigo-950/80 border border-indigo-500/40 text-indigo-200 px-2 py-0.5 rounded-full text-[10px] font-mono"
                    >
                      <span className="truncate max-w-[140px]">{t}</span>
                      <button
                        type="button"
                        onClick={() => handleTargetToggle(t)}
                        className="hover:text-rose-400"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Memo / Description Input */}
            <div>
              <label className="block text-slate-300 font-bold mb-1">사이트 메모 (용도 / 성격 설명)</label>
              <textarea
                value={memoText}
                onChange={e => setMemoText(e.target.value)}
                placeholder="마우스 호버 시 툴팁으로 표시될 사이트 설명 및 메모를 입력하세요."
                rows={3}
                className="w-full bg-slate-950/80 border border-indigo-500/30 rounded-lg p-2.5 text-slate-100 placeholder:text-slate-600 focus:border-indigo-400 focus:outline-none"
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="w-full py-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-extrabold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>{editingSite ? '사이트 정보 수정 완료' : '신규 사이트 등록'}</span>
            </button>
          </form>
        )}

        {/* TAB 2: LIST & MANAGEMENT */}
        {activeTab === 'list' && (
          <div className="space-y-3">
            {/* Filter controls */}
            <div className="space-y-2">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-500 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="사이트 명칭 / URL 검색..."
                  className="w-full bg-slate-950/80 border border-indigo-500/30 rounded-lg pl-8 pr-3 py-2 text-slate-100 placeholder:text-slate-600 focus:border-indigo-400 focus:outline-none"
                />
              </div>

              <div className="flex gap-1">
                {['all', 'money', 'pbn', 'target'].map(t => (
                  <button
                    key={t}
                    onClick={() => setTypeFilter(t)}
                    className={`flex-1 py-1 rounded-md text-[11px] font-bold capitalize transition-colors ${
                      typeFilter === t
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-950/40 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    {t === 'all' ? '전체' : t === 'money' ? '머니' : t === 'pbn' ? 'PBN' : '타겟'}
                  </button>
                ))}
              </div>
            </div>

            {/* Site Cards List */}
            <div className="space-y-2 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
              {filteredSites.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  검색 결과가 없습니다.
                </div>
              ) : (
                filteredSites.map(s => (
                  <div
                    key={s.id}
                    className="p-3 rounded-xl bg-slate-950/60 border border-indigo-500/20 hover:border-indigo-500/50 transition-all space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          {s.type === 'money' && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">머니</span>
                          )}
                          {s.type === 'pbn' && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-indigo-500/20 text-indigo-300 font-bold border border-indigo-500/30">PBN</span>
                          )}
                          {s.type === 'target' && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30">타겟</span>
                          )}
                          <h4 className="font-bold text-slate-100 text-xs truncate max-w-[150px]">
                            {s.title}
                          </h4>
                        </div>
                        <p className="text-[11px] text-slate-400 font-mono truncate max-w-[180px] mt-0.5">
                          {s.url}
                        </p>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setEditingSite(s)}
                          className="p-1 rounded bg-slate-800 text-indigo-300 hover:bg-indigo-600 hover:text-white transition-colors"
                          title="수정"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteSite(s.id)}
                          className="p-1 rounded bg-slate-800 text-rose-400 hover:bg-rose-600 hover:text-white transition-colors"
                          title="삭제"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {s.memo && (
                      <p className="text-[11px] text-slate-300 bg-slate-900/80 p-1.5 rounded border border-indigo-500/10 italic">
                        "{s.memo}"
                      </p>
                    )}

                    {s.targets && s.targets.length > 0 && (
                      <div className="text-[10px] text-slate-400">
                        <span className="font-bold text-indigo-300">연결 백링크 ({s.targets.length}개):</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {s.targets.map((t, idx) => (
                            <span key={idx} className="bg-slate-900 px-1.5 py-0.5 rounded text-[10px] font-mono text-slate-300 truncate max-w-[140px]">
                              {t}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 3: SETTINGS & BACKUP */}
        {activeTab === 'settings' && (
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-indigo-950/30 border border-indigo-500/30 space-y-2">
              <h3 className="font-bold text-indigo-200 text-sm flex items-center gap-1.5">
                <RotateCcw className="w-4 h-4 text-indigo-400" />
                <span>초기 데이터 복원</span>
              </h3>
              <p className="text-slate-300 text-xs leading-relaxed">
                최초 등록했던 머니사이트(1개), PBN(6개) 및 관련 백링크 데이터 구조로 언제든 복원할 수 있습니다.
              </p>
              <button
                onClick={handleResetPreset}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5"
              >
                <RotateCcw className="w-4 h-4" />
                <span>기본 프리셋 데이터로 복원</span>
              </button>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/60 border border-indigo-500/20 space-y-3">
              <h3 className="font-bold text-slate-200 text-sm flex items-center gap-1.5">
                <Download className="w-4 h-4 text-slate-400" />
                <span>데이터 백업 & 복구</span>
              </h3>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleExportJSON}
                  className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5"
                >
                  <Download className="w-4 h-4 text-emerald-400" />
                  <span>JSON 내보내기</span>
                </button>

                <label className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer">
                  <Upload className="w-4 h-4 text-cyan-400" />
                  <span>JSON 가져오기</span>
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImportJSON}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-rose-950/20 border border-rose-800/40 space-y-2">
              <h3 className="font-bold text-rose-300 text-sm flex items-center gap-1.5">
                <Trash2 className="w-4 h-4 text-rose-400" />
                <span>데이터 전체 초기화</span>
              </h3>
              <p className="text-rose-200/80 text-xs">
                등록된 모든 사이트 데이터 및 메모를 삭제하고 빈 화면으로 만듭니다.
              </p>
              <button
                onClick={() => {
                  if (window.confirm('정말 모든 데이터를 삭제하시겠습니까?')) {
                    setSites([]);
                    setMemo('');
                    resetForm();
                  }
                }}
                className="w-full py-2 bg-rose-900/60 hover:bg-rose-800 text-rose-200 font-bold rounded-lg transition-colors"
              >
                전체 데이터 삭제
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
