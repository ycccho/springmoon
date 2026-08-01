// Default preset data with ultra-clear human friendly titles and descriptions

export const DEFAULT_MEMO = `📌 백링크 연결 구조 개요
• 👑 최상단 (티어 0): 대표 머니사이트 (inde.co.kr) - 모든 백링크 파워가 최종 집결하는 핵심 웹사이트
• 🥇 1차 백링크 (티어 1): 머니사이트로 직접 링크를 주는 PBN1, PBN2 네트워크
• 🥈 2차 백링크 (티어 2): 1차 PBN 및 머니사이트를 지원하는 PBN3, PBN4, PBN5
• 🥉 3차 백링크 (티어 3): 하부에서 지원하는 PBN6 (zstree 티스토리)

💡 각 노드에 마우스를 올리면 해당 사이트와 연결된 선만 하이라이트되어 백링크 흐름을 한눈에 볼 수 있습니다.`;

export const PBN_COLORS = [
  { hex: '#f43f5e', name: 'PBN 1 (Crimson)', border: 'border-rose-500', bg: 'bg-rose-950/90', text: 'text-rose-300' },
  { hex: '#8b5cf6', name: 'PBN 2 (Purple)', border: 'border-purple-500', bg: 'bg-purple-950/90', text: 'text-purple-300' },
  { hex: '#06b6d4', name: 'PBN 3 (Cyan)', border: 'border-cyan-500', bg: 'bg-cyan-950/90', text: 'text-cyan-300' },
  { hex: '#f59e0b', name: 'PBN 4 (Amber)', border: 'border-amber-500', bg: 'bg-amber-950/90', text: 'text-amber-300' },
  { hex: '#10b981', name: 'PBN 5 (Emerald)', border: 'border-emerald-500', bg: 'bg-emerald-950/90', text: 'text-emerald-300' },
  { hex: '#ec4899', name: 'PBN 6 (Pink)', border: 'border-pink-500', bg: 'bg-pink-950/90', text: 'text-pink-300' }
];

export const INITIAL_SITES = [
  // 1. 머니 사이트 (티어 0 - 최상단)
  {
    id: "inde.co.kr",
    url: "https://inde.co.kr/",
    title: "👑 메인 머니사이트 (inde.co.kr)",
    type: "money",
    color: "#eab308", // Golden Yellow
    tier: 0,
    memo: "⭐ 메인 머니사이트 - 모든 PBN 백링크가 최종적으로 집결하는 핵심 대표 웹사이트입니다.",
    targets: []
  },

  // 2. 외부 주요 타겟 / 소셜 (티어 0)
  {
    id: "blog.naver.com/dudu8882",
    url: "https://blog.naver.com/dudu8882",
    title: "🎯 네이버 블로그 (dudu8882)",
    type: "target",
    color: "#38bdf8",
    tier: 0,
    memo: "네이버 브랜드 블로그 1 - 지원 백링크 수신처",
    targets: []
  },
  {
    id: "instagram.com/inde.company",
    url: "https://instagram.com/inde.company",
    title: "🎯 공식 인스타그램",
    type: "target",
    color: "#e1306c",
    tier: 0,
    memo: "공식 인스타그램 채널 - 브랜드 백링크 수신처",
    targets: []
  },
  {
    id: "sites.google.com/view/inde-busan/",
    url: "https://sites.google.com/view/inde-busan/",
    title: "🎯 구글 사이트 (inde-busan)",
    type: "target",
    color: "#4285f4",
    tier: 0,
    memo: "구글 사이트 백링크 페이지",
    targets: []
  },
  {
    id: "blog.naver.com/inde_company",
    url: "https://blog.naver.com/inde_company",
    title: "🎯 네이버 블로그 (inde_company)",
    type: "target",
    color: "#2db400",
    tier: 0,
    memo: "네이버 브랜드 블로그 2",
    targets: []
  },

  // 3. PBN 1차 ~ 3차 백링크 사이트
  {
    id: "busaninterior.kr",
    url: "https://busaninterior.kr/",
    title: "🥇 PBN 1 - 부산인테리어",
    type: "pbn",
    color: "#f43f5e", // Rose Red
    tier: 1,
    memo: "1차 직결 PBN: 머니사이트(inde.co.kr) 및 네이버블로그, 인스타로 백링크 전달",
    targets: [
      "https://inde.co.kr/",
      "https://blog.naver.com/dudu8882",
      "https://instagram.com/inde.company"
    ]
  },
  {
    id: "pbn-1.pages.dev",
    url: "https://pbn-1.pages.dev/",
    title: "🥇 PBN 2 - Pages.dev 1",
    type: "pbn",
    color: "#8b5cf6", // Purple
    tier: 1,
    memo: "1차 직결 PBN: 머니사이트(inde.co.kr), PBN1 및 네이버블로그로 백링크 전달",
    targets: [
      "https://inde.co.kr/",
      "https://blog.naver.com/dudu8882",
      "https://busaninterior.kr/"
    ]
  },
  {
    id: "pbn-2.pages.dev",
    url: "https://pbn-2.pages.dev/",
    title: "🥈 PBN 3 - Pages.dev 2",
    type: "pbn",
    color: "#06b6d4", // Cyan
    tier: 2,
    memo: "2차 지원 PBN: 머니사이트, PBN1, PBN2, 구글사이트로 백링크 파워 전달",
    targets: [
      "https://inde.co.kr/",
      "https://blog.naver.com/dudu8882",
      "https://busaninterior.kr/",
      "https://pbn-1.pages.dev/",
      "https://sites.google.com/view/inde-busan/"
    ]
  },
  {
    id: "academyinteriors.pages.dev",
    url: "https://academyinteriors.pages.dev/",
    title: "🥈 PBN 4 - 학원인테리어",
    type: "pbn",
    color: "#f59e0b", // Amber
    tier: 2,
    memo: "2차 지원 PBN: 머니사이트, PBN1, PBN2, PBN3, PBN6으로 백링크 전달",
    targets: [
      "https://inde.co.kr/",
      "https://blog.naver.com/dudu8882",
      "https://pbn-2.pages.dev/",
      "https://pbn-1.pages.dev/",
      "https://busaninterior.kr/",
      "https://zstree.tistory.com/"
    ]
  },
  {
    id: "officeinteriors.pages.dev",
    url: "https://officeinteriors.pages.dev/",
    title: "🥈 PBN 5 - 사무실인테리어",
    type: "pbn",
    color: "#10b981", // Emerald
    tier: 2,
    memo: "2차 지원 PBN: 머니사이트, PBN1, PBN2, PBN3으로 백링크 전달",
    targets: [
      "https://inde.co.kr/",
      "https://blog.naver.com/dudu8882",
      "https://busaninterior.kr/",
      "https://pbn-1.pages.dev/",
      "https://pbn-2.pages.dev/"
    ]
  },
  {
    id: "zstree.tistory.com",
    url: "https://zstree.tistory.com/",
    title: "🥉 PBN 6 - zstree 티스토리",
    type: "pbn",
    color: "#ec4899", // Hot Pink
    tier: 3,
    memo: "3차 하부 블로그: 네이버 브랜드 블로그로 기초 백링크 전달",
    targets: [
      "https://blog.naver.com/inde_company",
      "https://blog.naver.com/dudu8882"
    ]
  }
];

export function normalizeUrl(url) {
  if (!url) return "";
  let clean = url.trim().toLowerCase();
  clean = clean.replace(/^https?:\/\//, "");
  clean = clean.replace(/\/$/, "");
  return clean;
}
