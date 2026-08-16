/**
 * 네이버 플레이스 키워드 순위 추적 & 영구 기록 모듈 (Place Rank Tracker)
 * - 매일 아침 09:00 (KST) 자동 실행
 * - 지정된 키워드별 네이버 지도/플레이스 전체 순위(광고 제외) 측정
 * - 인디컴퍼니 및 타겟 업체 순위 영구 기록 (place_rank_history.json)
 */

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const HISTORY_FILE = path.join(__dirname, 'place_rank_history.json');
const BACKUP_FILE = path.join(__dirname, 'place_rank_history_backup.json');

// 기본 추적 키워드 및 타겟 업체
const DEFAULT_KEYWORDS = [
  "부산사무실인테리어",
  "부산상가인테리어",
  "부산병원인테리어",
  "부산학원인테리어"
];
const DEFAULT_TARGET_NAME = "인디컴퍼니";

// 1. 히스토리 로드 (영구 저장 보장)
function loadHistory() {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      const raw = fs.readFileSync(HISTORY_FILE, 'utf-8');
      const data = JSON.parse(raw);
      if (Array.isArray(data)) return data;
    }
  } catch (err) {
    console.error('[플레이스 순위] 히스토리 파일 읽기 실패, 백업 파일 시도:', err.message);
    try {
      if (fs.existsSync(BACKUP_FILE)) {
        const raw = fs.readFileSync(BACKUP_FILE, 'utf-8');
        const data = JSON.parse(raw);
        if (Array.isArray(data)) return data;
      }
    } catch (bErr) {
      console.error('[플레이스 순위] 백업 파일 로드 실패:', bErr.message);
    }
  }
  return [];
}

// 2. 히스토리 영구 저장 (Append-only & Backup)
function saveHistory(history) {
  try {
    const jsonStr = JSON.stringify(history, null, 2);
    // 1) Write main file
    fs.writeFileSync(HISTORY_FILE, jsonStr, 'utf-8');
    // 2) Write backup file
    fs.writeFileSync(BACKUP_FILE, jsonStr, 'utf-8');
    console.log(`[플레이스 순위] 총 ${history.length}건의 기록이 안전하게 영구 저장되었습니다.`);
    return true;
  } catch (err) {
    console.error('[플레이스 순위] 히스토리 저장 에러:', err.message);
    return false;
  }
}

// 3. 단일 키워드 순위 체크 함수
async function scrapeKeywordPlace(browser, keyword, targetName = DEFAULT_TARGET_NAME) {
  console.log(`[플레이스 순위] 키워드 검색 시작: [${keyword}]`);
  const page = await browser.newPage();
  try {
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

    const searchUrl = `https://map.naver.com/p/search/${encodeURIComponent(keyword)}`;
    await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 3500));

    const frames = page.frames();
    let searchFrame = frames.find(f => f.name() === 'searchIframe' || (f.url() && f.url().includes('place/list')));

    if (!searchFrame) {
      const el = await page.$('#searchIframe');
      if (el) searchFrame = await el.contentFrame();
    }

    if (!searchFrame) {
      throw new Error('searchIframe 프레임을 찾을 수 없습니다.');
    }

    const frameHtml = await searchFrame.content();

    // Apollo State 파싱
    let orderedIds = [];
    let state = {};
    const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
    let m;

    while ((m = scriptRegex.exec(frameHtml)) !== null) {
      const content = m[1];
      if (content.includes('__APOLLO_STATE__') || content.includes('PlaceListBusinessesItem')) {
        const jsonMatch = content.match(/window\.__APOLLO_STATE__\s*=\s*(\{[\s\S]*?\});/) ||
                           content.match(/(\{[\s\S]*"PlaceListBusinessesItem[\s\S]*\})/);
        if (jsonMatch) {
          try {
            state = JSON.parse(jsonMatch[1]);
            const rootQuery = state.ROOT_QUERY || {};
            for (const k of Object.keys(rootQuery)) {
              if (k.includes('businesses') || k.includes('places') || k.includes('items')) {
                const val = rootQuery[k];
                if (val && val.items) {
                  orderedIds = val.items.map(item => item.__ref || item.id);
                }
              }
            }
            if (orderedIds.length === 0) {
              orderedIds = Object.keys(state).filter(k => k.startsWith('PlaceListBusinessesItem:'));
            }
          } catch(e){}
        }
      }
    }

    let organicRank = 0;
    let targetRank = null;
    let targetInfo = null;
    const topCompetitors = [];
    const adsList = [];

    orderedIds.forEach((id) => {
      const item = state[id] || {};
      const name = item.name || item.title || id;
      const isAd = !!(item.isAd || item.isAdvertisement || item.ad || (item.adMeta && item.adMeta.isAd));
      const category = item.category || item.categoryName || '인테리어디자인';
      const address = item.roadAddress || item.address || item.commonAddress || '';
      const phone = item.virtualPhone || item.phone || '';

      if (isAd) {
        adsList.push({ name, category, address, phone });
      } else {
        organicRank++;
        if (organicRank <= 5) {
          topCompetitors.push({ rank: organicRank, name, category, address });
        }
        if (name.includes(targetName) || name.includes('인디')) {
          if (!targetRank) {
            targetRank = organicRank;
            targetInfo = {
              rank: organicRank,
              name,
              category,
              address,
              phone,
              fullAddress: item.fullAddress || address,
              bookingUrl: item.bookingUrl || null,
              talktalkUrl: item.talktalkUrl || null,
              imageUrl: item.imageUrl || null
            };
          }
        }
      }
    });

    const now = new Date();
    const kst = new Date(now.getTime() + (9 * 60 * 60 * 1000));
    const dateStr = `${kst.getUTCFullYear()}-${String(kst.getUTCMonth() + 1).padStart(2, '0')}-${String(kst.getUTCDate()).padStart(2, '0')}`;
    const timeStr = `${String(kst.getUTCHours()).padStart(2, '0')}:${String(kst.getUTCMinutes()).padStart(2, '0')}:${String(kst.getUTCSeconds()).padStart(2, '0')}`;

    const record = {
      id: `rank_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      date: dateStr,
      time: timeStr,
      timestamp: kst.toISOString(),
      keyword,
      targetName,
      targetRank: targetRank || null,
      targetFound: !!targetRank,
      totalOrganicCount: organicRank,
      totalItemsCount: orderedIds.length,
      targetInfo: targetInfo || {
        rank: null,
        name: targetName,
        category: "인테리어디자인",
        address: "순위권 외",
        phone: "-"
      },
      topCompetitors,
      adsCount: adsList.length,
      adsList
    };

    console.log(`[플레이스 순위] ✅ [${keyword}] 측정 완료: ${targetRank ? targetRank + '위' : '순위 밖 (전체 ' + organicRank + '개 중)'}`);
    return record;
  } catch (err) {
    console.error(`[플레이스 순위] ❌ [${keyword}] 측정 실패:`, err.message);
    const now = new Date();
    const kst = new Date(now.getTime() + (9 * 60 * 60 * 1000));
    return {
      id: `rank_${Date.now()}_err`,
      date: `${kst.getUTCFullYear()}-${String(kst.getUTCMonth() + 1).padStart(2, '0')}-${String(kst.getUTCDate()).padStart(2, '0')}`,
      time: `${String(kst.getUTCHours()).padStart(2, '0')}:${String(kst.getUTCMinutes()).padStart(2, '0')}`,
      timestamp: kst.toISOString(),
      keyword,
      targetName,
      targetRank: null,
      targetFound: false,
      error: err.message,
      totalOrganicCount: 0,
      targetInfo: null,
      topCompetitors: []
    };
  } finally {
    await page.close().catch(() => {});
  }
}

// 4. 전체 키워드 일괄 순위 체크 실행
async function runPlaceRankCheck(keywords = DEFAULT_KEYWORDS, targetName = DEFAULT_TARGET_NAME) {
  console.log(`\n==================================================`);
  console.log(`[플레이스 순위] 일괄 순위 체크 시작 (키워드 ${keywords.length}개, 대상: ${targetName})`);
  console.log(`==================================================`);

  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath: CHROME_PATH,
      headless: "new",
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080']
    });
  } catch (err) {
    console.error('[플레이스 순위] 브라우저 실행 실패:', err.message);
    throw err;
  }

  const results = [];
  try {
    for (const kw of keywords) {
      if (!kw || !kw.trim()) continue;
      const res = await scrapeKeywordPlace(browser, kw.trim(), targetName);
      results.push(res);
      await new Promise(r => setTimeout(r, 1200));
    }
  } finally {
    if (browser) await browser.close().catch(() => {});
  }

  // 기존 히스토리에 누적 (영구 저장)
  const history = loadHistory();
  
  // 새 결과 추가 (기존 기록은 절대 삭제/변경하지 않음)
  results.forEach(item => {
    history.push(item);
  });

  saveHistory(history);

  console.log(`==================================================`);
  console.log(`[플레이스 순위] 일괄 순위 체크 완료 (${results.length}건 누적 저장)`);
  console.log(`==================================================\n`);

  return results;
}

// 5. Express 라우터 및 스케줄러 등록 함수
let lastScheduledDate = '';

function setupPlaceRankRoutes(app) {
  // 1) 히스토리 및 최신 순위 조회
  app.get('/api/place-rank/history', (req, res) => {
    try {
      const history = loadHistory();
      
      // Calculate latest status for each keyword
      const latestMap = {};
      const previousMap = {};

      // Sort history chronologically
      const sorted = [...history].sort((a, b) => new Date(a.timestamp || a.date).getTime() - new Date(b.timestamp || b.date).getTime());
      
      sorted.forEach(item => {
        const kw = item.keyword;
        if (latestMap[kw]) {
          previousMap[kw] = latestMap[kw];
        }
        latestMap[kw] = item;
      });

      // Compute rank change (diff)
      const summaryList = Object.keys(latestMap).map(kw => {
        const current = latestMap[kw];
        const prev = previousMap[kw];
        let diff = 0;
        let diffText = '-';

        if (current && prev && current.targetRank && prev.targetRank) {
          diff = prev.targetRank - current.targetRank; // positive means rank up (e.g. 5위 -> 3위 = +2)
          if (diff > 0) diffText = `▲ ${diff}`;
          else if (diff < 0) diffText = `▼ ${Math.abs(diff)}`;
          else diffText = '-';
        }

        return {
          ...current,
          diff,
          diffText,
          previousRank: prev ? prev.targetRank : null
        };
      });

      res.json({
        success: true,
        totalRecords: history.length,
        monitoredKeywords: DEFAULT_KEYWORDS,
        targetName: DEFAULT_TARGET_NAME,
        summary: summaryList,
        latestMap,
        history: sorted.reverse() // Most recent first for table
      });
    } catch (err) {
      console.error('[플레이스 순위] 조회 에러:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 2) 수동 1회 즉시 실행
  app.post('/api/place-rank/check', async (req, res) => {
    try {
      const keywords = (req.body && Array.isArray(req.body.keywords) && req.body.keywords.length > 0)
        ? req.body.keywords
        : DEFAULT_KEYWORDS;
      const targetName = (req.body && req.body.targetName) ? req.body.targetName : DEFAULT_TARGET_NAME;

      console.log(`[플레이스 순위] 사용자 요청에 의한 수동 순위 체크 시작...`);
      const results = await runPlaceRankCheck(keywords, targetName);
      
      res.json({
        success: true,
        count: results.length,
        results
      });
    } catch (err) {
      console.error('[플레이스 순위] 즉시 실행 에러:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 3) 백그라운드 스케줄러 (매일 오전 09:00 KST 자동 실행)
  setInterval(async () => {
    const now = new Date();
    const kst = new Date(now.getTime() + (9 * 60 * 60 * 1000));
    const hour = String(kst.getUTCHours()).padStart(2, '0');
    const minute = String(kst.getUTCMinutes()).padStart(2, '0');
    const currentTime = `${hour}:${minute}`;
    const currentDate = `${kst.getUTCFullYear()}-${String(kst.getUTCMonth() + 1).padStart(2, '0')}-${String(kst.getUTCDate()).padStart(2, '0')}`;

    // 매일 아침 09:00에 1회 자동 실행
    if (currentTime === "09:00" && lastScheduledDate !== currentDate) {
      lastScheduledDate = currentDate;
      console.log(`[플레이스 정기 스케줄러] ⏰ 오전 09:00 정기 플레이스 순위 자동 측정을 시작합니다.`);
      try {
        await runPlaceRankCheck(DEFAULT_KEYWORDS, DEFAULT_TARGET_NAME);
        console.log(`[플레이스 정기 스케줄러] ✅ 오전 09:00 정기 순위 측정 및 저장이 성공적으로 완료되었습니다.`);
      } catch (e) {
        console.error(`[플레이스 정기 스케줄러] ❌ 정기 순위 측정 실패:`, e.message);
      }
    }
  }, 30000); // 30초마다 확인
}

module.exports = {
  loadHistory,
  saveHistory,
  runPlaceRankCheck,
  setupPlaceRankRoutes,
  DEFAULT_KEYWORDS,
  DEFAULT_TARGET_NAME
};
