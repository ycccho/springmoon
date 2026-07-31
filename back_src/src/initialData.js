// Default preset data requested by user

export const DEFAULT_MEMO = `📌 백링크 시각화 대시보드 프로젝트 진행 상황
- 대표 머니사이트: inde.co.kr (1개)
- PBN 네트워크: PBN1 ~ PBN6 (총 6개 구축 완료)
- 백링크 타겟: 머니사이트, 네이버 블로그, 인스타그램, 구글 사이트 등

[업데이트 메모]
- PBN4, PBN5 2차 티어 백링크 구조 적용 완료
- 노드 클릭 시 해당 URL로 새 탭이 열리며, 마우스 호버 시 상세 용도/메모가 표시됩니다.`;

export const INITIAL_SITES = [
  // 1. 머니 사이트
  {
    id: "inde.co.kr",
    url: "https://inde.co.kr/",
    title: "inde.co.kr (머니사이트)",
    type: "money",
    memo: "대표 머니사이트 - 인데인테리어 공식 웹사이트",
    targets: []
  },

  // 2. 타겟 / 소셜 / 외부 사이트 (백링크 수신처)
  {
    id: "blog.naver.com/dudu8882",
    url: "https://blog.naver.com/dudu8882",
    title: "네이버 블로그 (dudu8882)",
    type: "target",
    memo: "네이버 공식 브랜드 블로그 1",
    targets: []
  },
  {
    id: "instagram.com/inde.company",
    url: "https://instagram.com/inde.company",
    title: "인스타그램 (inde.company)",
    type: "target",
    memo: "공식 인스타그램 SNS 채널",
    targets: []
  },
  {
    id: "sites.google.com/view/inde-busan/",
    url: "https://sites.google.com/view/inde-busan/",
    title: "구글 사이트 (inde-busan)",
    type: "target",
    memo: "구글 사이트 백링크 Target 페이지",
    targets: []
  },
  {
    id: "blog.naver.com/inde_company",
    url: "https://blog.naver.com/inde_company",
    title: "네이버 블로그 (inde_company)",
    type: "target",
    memo: "네이버 브랜드 블로그 2",
    targets: []
  },

  // 3. PBN 사이트들
  {
    id: "busaninterior.kr",
    url: "https://busaninterior.kr/",
    title: "PBN1 - 부산인테리어",
    type: "pbn",
    memo: "부산 인테리어 전문 PBN 사이트 (1차 티어)",
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
    memo: "Cloudflare Pages PBN 네트워크 1 (1차 티어)",
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
    memo: "Cloudflare Pages PBN 네트워크 2 (2차 티어)",
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
    memo: "학원 인테리어 PBN 사이트 (2차 티어)",
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
    memo: "사무실 인테리어 PBN 사이트 (2차 티어)",
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
    memo: "티스토리 백링크 블로그 (3차 티어)",
    targets: [
      "https://blog.naver.com/inde_company",
      "https://blog.naver.com/dudu8882"
    ]
  }
];

// Helper to normalize URL for matching
export function normalizeUrl(url) {
  if (!url) return "";
  let clean = url.trim().toLowerCase();
  clean = clean.replace(/^https?:\/\//, "");
  clean = clean.replace(/\/$/, "");
  return clean;
}
