// Naver Search Full-Page Screenshot Helper Server
// Starts a local HTTP server on port 3888 to bypass browser filesystem sandbox limitations.
// Auto-installs its own dependencies if missing.

const { execSync } = require('child_process');

// 1. Auto-install required packages if missing
try {
  require('express');
  require('cors');
  require('puppeteer');
} catch (e) {
  console.log("==================================================");
  console.log(" [안내] 필수 패키지(express, cors, puppeteer)가 없습니다.");
  console.log(" 자동 설치를 진행하고 있습니다. 약 1~2분 소요될 수 있습니다...");
  console.log("==================================================");
  try {
    execSync('npm install express cors puppeteer --no-audit --no-fund', { stdio: 'inherit' });
    console.log("\n>>> 패키지 설치 완료! 서버를 시작합니다.\n");
  } catch (err) {
    console.error("패키지 자동 설치 실패. 터미널에서 'npm install express cors puppeteer'를 직접 입력해 주세요.", err);
    process.exit(1);
  }
}

const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Helper: Get today's date in Korean Standard Time (KST) formatted as YYYY.MM.DD
function getKstDateString() {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60 * 1000);
  const kst = new Date(utc + (9 * 60 * 60 * 1000));
  
  const yyyy = kst.getFullYear();
  const mm = String(kst.getMonth() + 1).padStart(2, '0');
  const dd = String(kst.getDate()).padStart(2, '0');
  
  return `${yyyy}.${mm}.${dd}`;
}

// Scroll to bottom gradually to trigger all Naver lazy-loaded content/images
async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let totalHeight = 0;
      const distance = 400; // Scroll 400px per step
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;

        if (totalHeight >= scrollHeight - window.innerHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 120); // 120ms interval
    });
  });
}

app.post('/api/screenshot', async (req, res) => {
  const { keywords, saveDir } = req.body;

  if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
    return res.status(400).json({ success: false, error: 'Keywords list is required' });
  }

  const dateStr = getKstDateString();
  let baseDir = saveDir ? saveDir.trim() : 'D:\\';
  
  // Normalize Windows path suffix
  if (!baseDir.endsWith('\\') && !baseDir.endsWith('/')) {
    baseDir += '\\';
  }

  const finalDir = path.join(baseDir, dateStr);

  // Try creating directory
  try {
    if (!fs.existsSync(finalDir)) {
      fs.mkdirSync(finalDir, { recursive: true });
    }
  } catch (e) {
    console.error(`지정된 경로(${finalDir}) 폴더 생성 실패:`, e);
    return res.status(500).json({ 
      success: false, 
      error: `저장 폴더를 생성할 수 없습니다. 경로가 올바르며 D: 드라이브 접근 권한이 있는지 확인하세요. (오류: ${e.message})` 
    });
  }

  const results = [];
  let browser = null;

  try {
    browser = await puppeteer.launch({
      headless: "new",
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    // Use desktop viewport
    await page.setViewport({ width: 1350, height: 900 });

    for (const keyword of keywords) {
      const cleanKeyword = keyword.trim();
      if (!cleanKeyword) continue;

      try {
        console.log(`[작업 진행] 검색 및 스크롤: "${cleanKeyword}"`);
        const url = `https://search.naver.com/search.naver?query=${encodeURIComponent(cleanKeyword)}`;
        
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
        
        // Scroll step-by-step to load lazy images
        await autoScroll(page);
        
        // Wait another second for final image rendering
        await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 1500)));

        const safeFilename = cleanKeyword.replace(/[\\/:*?"<>|]/g, '_');
        const filepath = path.join(finalDir, `${safeFilename}.png`);

        await page.screenshot({
          path: filepath,
          fullPage: true
        });

        console.log(`[저장 완료] 파일 경로: ${filepath}`);
        results.push({ keyword: cleanKeyword, success: true, path: filepath });
      } catch (err) {
        console.error(`[작업 실패] 키워드: "${cleanKeyword}", 사유:`, err);
        results.push({ keyword: cleanKeyword, success: false, error: err.message });
      }
    }
  } catch (e) {
    console.error("Puppeteer 기동 오류:", e);
    return res.status(500).json({ success: false, error: `브라우저 제어 모듈 실행 실패: ${e.message}` });
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  res.json({
    success: true,
    folder: finalDir,
    results
  });
});

// OPTIONS preflight endpoint for client checks
app.options('/api/screenshot', cors(), (req, res) => {
  res.sendStatus(200);
});

const PORT = 3888;
app.listen(PORT, () => {
  console.log(`================================================================`);
  console.log(` [네이버 키워드 검색 풀스크린 캡처 헬퍼 백서버가 시작되었습니다]`);
  console.log(` 로컬 접속 포트: ${PORT}`);
  console.log(` API Endpoint : http://localhost:${PORT}/api/screenshot`);
  console.log(` 저장 기본 경로: D:\\ [실행 날짜 YYYY.MM.DD 폴더로 저장]`);
  console.log(` 실행 종료는 터미널에서 Ctrl+C를 눌러주세요.`);
  console.log(`================================================================`);
});
