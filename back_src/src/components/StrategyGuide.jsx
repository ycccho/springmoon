import React from 'react';
import {
  BookOpen,
  Shield,
  Layers,
  Crown,
  TrendingUp,
  Cpu,
  Globe,
  Database,
  ExternalLink,
  CheckCircle2
} from 'lucide-react';

export default function StrategyGuide() {
  return (
    <div className="flex-1 w-full bg-slate-950 text-slate-100 overflow-y-auto p-4 sm:p-6 space-y-6">
      {/* Banner */}
      <div className="max-w-5xl mx-auto bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-950 p-6 rounded-2xl border border-indigo-500/30 shadow-2xl">
        <div className="flex items-center gap-2.5 mb-2">
          <BookOpen className="w-5 h-5 text-indigo-400" />
          <h2 className="text-xl font-black text-slate-100">
            3-Tier PBN 백링크 구축 및 SEO 아키텍처 가이드
          </h2>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed max-w-3xl">
          구글(Googlebot) 및 네이버 검색 알고리즘에 최적화된 안전한 계층형 백링크 네트워크(Link Wheel / Pyramid) 설계 원칙과 오픈소스 기술 스택 활용법을 안내합니다.
        </p>
      </div>

      {/* 3-Tier Diagram & Cards */}
      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Tier 0 */}
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-amber-500/40 shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-black">
              👑 티어 0 (Tier 0)
            </span>
            <Crown className="w-5 h-5 text-amber-400" />
          </div>
          <h3 className="text-base font-extrabold text-slate-100">메인 머니사이트</h3>
          <p className="text-xs text-slate-300 leading-relaxed">
            실제 매출과 전환이 일어나는 핵심 브랜드 사이트(예: inde.co.kr). 모든 하부 PBN의 링크 주스(Link Juice)가 최종 집중되는 최종 목적지입니다.
          </p>
          <ul className="text-[11px] text-slate-400 space-y-1 pt-2 border-t border-slate-800">
            <li>• 최상급 고품질 콘텐츠 유지</li>
            <li>• 내부 링크 구조(Silo Architecture) 최적화</li>
            <li>• 자연스러운 앵커 텍스트 비율 유지</li>
          </ul>
        </div>

        {/* Tier 1 */}
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-rose-500/40 shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-xs font-black">
              🥇 티어 1 (Tier 1)
            </span>
            <Layers className="w-5 h-5 text-rose-400" />
          </div>
          <h3 className="text-base font-extrabold text-slate-100">1차 직결 PBN 네트워크</h3>
          <p className="text-xs text-slate-300 leading-relaxed">
            머니사이트로 직접 단방향 dofollow 링크를 전달하는 독립 도메인 PBN (예: busaninterior.kr, pbn-1.pages.dev).
          </p>
          <ul className="text-[11px] text-slate-400 space-y-1 pt-2 border-t border-slate-800">
            <li>• 독립된 C-Class IP 분산 (Cloudflare CDN 활용)</li>
            <li>• 머니사이트와 주제 연관성 100% 일치</li>
            <li>• 과도한 상호 맞교환(Link Exchange) 금지</li>
          </ul>
        </div>

        {/* Tier 2 & 3 */}
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-cyan-500/40 shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-xs font-black">
              🥈🥉 티어 2~3 (Tier 2/3)
            </span>
            <TrendingUp className="w-5 h-5 text-cyan-400" />
          </div>
          <h3 className="text-base font-extrabold text-slate-100">하부 지원 블로그 & 소셜</h3>
          <p className="text-xs text-slate-300 leading-relaxed">
            1차 PBN에 강력한 지수와 트래픽을 밀어주는 지원형 사이트(Pages.dev, 티스토리, 네이버 블로그, 구글 사이트 등).
          </p>
          <ul className="text-[11px] text-slate-400 space-y-1 pt-2 border-t border-slate-800">
            <li>• 대량 백링크 흡수 및 필터링 완충 역할</li>
            <li>• 1차 PBN의 PageRank 상승 견인</li>
            <li>• 머니사이트로의 직접 페널티 전이 원천 차단</li>
          </ul>
        </div>
      </div>

      {/* Open Source SEO Tech Stack Integration */}
      <div className="max-w-5xl mx-auto bg-slate-900/90 p-6 rounded-2xl border border-slate-800 shadow-xl space-y-4">
        <h3 className="text-sm font-extrabold text-slate-100 flex items-center gap-2">
          <Cpu className="w-4 h-4 text-indigo-400" />
          <span>오픈소스 백링크 분석 및 데이터셋 기술 스택</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between font-bold text-amber-300">
              <span>Common Crawl (Web Graph)</span>
              <Database className="w-4 h-4" />
            </div>
            <p className="text-[11px] text-slate-400">
              전 세계 수십억 개 웹페이지의 링크 관계를 페타바이트급 오픈 데이터셋으로 제공. DuckDB 및 서버리스 쿼리와 결합하여 무료 백링크 인덱싱 구축 가능.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between font-bold text-cyan-300">
              <span>OpenPageRank API</span>
              <TrendingUp className="w-4 h-4" />
            </div>
            <p className="text-[11px] text-slate-400">
              Ahrefs DR이나 Moz DA를 대체할 수 있는 공개 PageRank 알고리즘 API. 도메인의 신뢰도와 랭크 순위를 수치화하여 모니터링.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between font-bold text-emerald-300">
              <span>CrawlSEO / Cybokron Engine</span>
              <Globe className="w-4 h-4" />
            </div>
            <p className="text-[11px] text-slate-400">
              깃허브 오픈소스 기반 고속 DOM 크롤러. 웹페이지의 본문 태그를 파싱하여 인바운드/아웃바운드 링크와 앵커 텍스트를 실시간 추출.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between font-bold text-indigo-300">
              <span>Google Search Console 연계</span>
              <Shield className="w-4 h-4" />
            </div>
            <p className="text-[11px] text-slate-400">
              구글봇이 직접 색인 완료하고 스팸 필터를 통과한 최상위 신뢰 백링크만 수집. CSV 임포트를 통해 시각화 캔버스에 즉시 반영.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
