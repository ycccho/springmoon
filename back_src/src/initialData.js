// Default preset data requested by user with unique color assignments & Tier info

export const DEFAULT_MEMO = `📌 백링크 시각화 대시보드 프로젝트 진행 상황
- ⭐ 대표 머니사이트: inde.co.kr (티어 0 최상단 고정)
- 🎨 PBN 네트워크: PBN1 ~ PBN6 (각 PBN별 고유 시그니처 색상 & 연결 선 색상 적용)
- 📐 티어 구별: 티어 0(머니사이트) -> 티어 1(1차 PBN) -> 티어 2(2차 PBN) -> 티어 3(3차 PBN)

[주요 기능 안내]
- 각 노드에서 [🔗 백링크 URL 목록] 버튼을 클릭하면 연결된 백링크 전체 주소를 한눈에 확인할 수 있습니다.
- 노드의 고유 색상과 연결 선(Edge)의 색상이 1:1로 일치하여 백링크 유입 경로를 직관적으로 파악 가능합니다.`;

// Unique Color Palette for PBNs & Nodes
export const PBN_COLORS = [
  { hex: '#f43f5e', name: 'Crimson Rose', border: 'border-rose-500', bg: 'bg-rose-950/40', text: 'text-rose-300', badge: 'bg-rose-500/20 text-rose-300 border-rose-500/40' },
  { hex: '#8b5cf6', name: 'Royal Purple', border: 'border-purple-500', bg: 'bg-purple-950/40', text: 'text-purple-300', badge: 'bg-purple-500/20 text-purple-300 border-purple-500/40' },
  { hex: '#06b6d4', name: 'Teal Cyan', border: 'border-cyan-500', bg: 'bg-cyan-950/40', text: 'text-cyan-300', badge: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40' },
  { hex: '#f59e0b', name: 'Warm Amber', border: 'border-amber-500', bg: 'bg-amber-950/40', text: 'text-amber-300', badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40' },
  { hex: '#10b981', name: 'Emerald Green', border: 'border-emerald-500', bg: 'bg-emerald-950/40', text: 'text-emerald-300', badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' },
  { hex: '#ec4899', name: 'Hot Pink', border: 'border-pink-500', bg: 'bg-pink-950/40', text: 'text-pink-300', badge: 'bg-pink-500/20 text-pink-300 border-pink-500/40' },
  { hex: '#3b82f6', name: 'Vibrant Blue', border: 'border-blue-500', bg: 'bg-blue-950/40', text: 'text-blue-300', badge: 'bg-blue-500/20 text-blue-300 border-blue-500/40' },
  { hex: '#a855f7', name: 'Bright Violet', border: 'border-violet-500', bg: 'bg-violet-950/40', text: 'text-violet-300', badge: 'bg-violet-500/20 text-violet-300 border-violet-500/40' }
];

export const INITIAL_SITES = [
  // 1. 머니 사이트 (티어 0)
  {
    id: "inde.co.kr",
    url: "https://inde.co.kr/",
    title: "inde.co.kr (머니사이트)",
    type: "money",
    color: "#eab308", // Golden Star
    tier: 0,
    memo: "⭐ 대표 머니사이트 - 인데인테리어 공식 웹사이트 (최상단 고정)",
    targets: []
  },

  // 2. 타겟 / 소셜 / 외부 사이트 (백링크 수신처, 티어 0)
  {
    id: "blog.naver.com/dudu8882",
    url: "https://blog.naver.com/dudu8882",
    title: "네이버 블로그 (dudu8882)",
    type: "target",
    color: "#38bdf8", // Sky Blue
    tier: 0,
    memo: "네이버 공식 브랜드 블로그 1",
    targets: []
  },
  {
    id: "instagram.com/inde.company",
    url: "https://instagram.com/inde.company",
    title: "인스타그램 (inde.company)",
    type: "target",
    color: "#e1306c", // Instagram Pink
    tier: 0,
    memo: "공식 인스타그램 SNS 채널",
    targets: []
  },
  {
    id: "sites.google.com/view/inde-busan/",
    url: "https://sites.google.com/view/inde-busan/",
    title: "구글 사이트 (inde-busan)",
    type: "target",
    color: "#4285f4", // Google Blue
    tier: 0,
    memo: "구글 사이트 백링크 Target 페이지",
    targets: []
  },
  {
    id: "blog.naver.com/inde_company",
    url: "https://blog.naver.com/inde_company",
    title: "네이버 블로그 (inde_company)",
    type: "target",
    color: "#2db400", // Naver Green
    tier: 0,
    memo: "네이버 브랜드 블로그 2",
    targets: []
  },

  // 3. PBN 사이트들 (티어 1, 티어 2, 티어 3)
  {
    id: "busaninterior.kr",
    url: "https://busaninterior.kr/",
    title: "PBN1 - 부산인테리어",
    type: "pbn",
    color: "#f43f5e", // Crimson Rose (고유색상 1)
    tier: 1,
    memo: "부산 인테리어 전문 PBN 사이트 (1차 티어 PBN)",
    targets: [
      "https://inde.co.kr/",
      "https://blog.naver.com/dudu8882",
      "https://instagram.com/inde.company"
    ]
  },
  {
    id: "pbn-1.pages.dev",
    url: "https://pbn-1.pages.dev/",
    title: "PBN2 - Pages.dev 1",
    type: "pbn",
    color: "#8b5cf6", // Royal Purple (고유색상 2)
    tier: 1,
    memo: "Cloudflare Pages PBN 네트워크 1 (1차 티어 PBN)",
    targets: [
      "https://inde.co.kr/",
      "https://blog.naver.com/dudu8882",
      "https://busaninterior.kr/"
    ]
  },
  {
    id: "pbn-2.pages.dev",
    url: "https://pbn-2.pages.dev/",
    title: "PBN3 - Pages.dev 2",
    type: "pbn",
    color: "#06b6d4", // Teal Cyan (고유색상 3)
    tier: 2,
    memo: "Cloudflare Pages PBN 네트워크 2 (2차 티어 PBN)",
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
    title: "PBN4 - 학원인테리어",
    type: "pbn",
    color: "#f59e0b", // Warm Amber (고유색상 4)
    tier: 2,
    memo: "학원 인테리어 PBN 사이트 (2차 티어 PBN)",
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
    title: "PBN5 - 사무실인테리어",
    type: "pbn",
    color: "#10b981", // Emerald Green (고유색상 5)
    tier: 2,
    memo: "사무실 인테리어 PBN 사이트 (2차 티어 PBN)",
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
    title: "PBN6 - zstree 티스토리",
    type: "pbn",
    color: "#ec4899", // Hot Pink (고유색상 6)
    tier: 3,
    memo: "티스토리 백링크 블로그 (3차 티어 PBN)",
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
