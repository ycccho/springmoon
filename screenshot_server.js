// Naver & Google Search Full-Page Screenshot Helper & Local Web Server
// Starts a local HTTP server on port 3888 to bypass browser filesystem sandbox limitations.
// Auto-installs its own dependencies if missing.

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 1. Auto-install required packages if missing
try {
  require('express');
  require('cors');
  require('puppeteer-core');
} catch (e) {
  console.log("==================================================");
  console.log(" [안내] 필수 패키지(express, cors, puppeteer-core)가 없습니다.");
  console.log(" 자동 설치를 진행하고 있습니다. 약 10초 이내에 완료됩니다...");
  console.log("==================================================");
  try {
    execSync('npm install express cors puppeteer-core --no-audit --no-fund', { stdio: 'inherit' });
    console.log("\n>>> 패키지 설치 완료! 서버를 시작합니다.\n");
  } catch (err) {
    console.error("패키지 자동 설치 실패. 터미널에서 'npm install express cors puppeteer-core'를 직접 입력해 주세요.", err);
    process.exit(1);
  }
}

const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer-core');

const app = express();
app.use(cors());

// Bypass Chrome Private Network Access (PNA) restrictions when accessed from public HTTPS sites
// MUST be registered BEFORE cors() so it attaches to preflight OPTIONS requests!
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Private-Network', 'true');
  next();
});

app.use(cors());
app.use(express.json({ limit: '50mb' })); // support large OCR payloads

// Serve index.html directly from local port 3888 (same origin)
app.use(express.static(__dirname));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// --- Scheduling configuration load/save ---
const CONFIG_FILE = path.join(__dirname, 'config.json');
let globalConfig = {
  scheduleEnabled: false,
  scheduleTime: '09:00',
  naverKeywords: [],
  googleKeywords: [],
  lastRunDate: ''
};

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf8');
      const loaded = JSON.parse(data);
      
      // Backward compatibility mapping for old 'keywords' array
      if (loaded.keywords && Array.isArray(loaded.keywords) && loaded.naverKeywords === undefined) {
        loaded.naverKeywords = loaded.keywords;
      }

      globalConfig = { ...globalConfig, ...loaded };

      // Bulletproof split in case string elements contain newlines/commas
      if (Array.isArray(globalConfig.naverKeywords)) {
        globalConfig.naverKeywords = globalConfig.naverKeywords
          .flatMap(k => k.split(/[\n,]/))
          .map(k => k.trim())
          .filter(k => k.length > 0);
      }
      if (Array.isArray(globalConfig.googleKeywords)) {
        globalConfig.googleKeywords = globalConfig.googleKeywords
          .flatMap(k => k.split(/[\n,]/))
          .map(k => k.trim())
          .filter(k => k.length > 0);
      }

      console.log(`[설정 로드] 자동 예약 실행 상태: ${globalConfig.scheduleEnabled ? '활성화 (' + globalConfig.scheduleTime + ')' : '비활성화'}`);
    }
  } catch (e) {
    console.error("config.json 로드 실패:", e);
  }
}

function saveConfig() {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(globalConfig, null, 2), 'utf8');
  } catch (e) {
    console.error("config.json 저장 실패:", e);
  }
}

loadConfig();

// Get config endpoint
app.get('/api/config', (req, res) => {
  res.json({ success: true, config: globalConfig });
});

// Save config endpoint
app.post('/api/config', (req, res) => {
  const { scheduleEnabled, scheduleTime, naverKeywords, googleKeywords } = req.body;

  if (scheduleTime && !/^\d{2}:\d{2}$/.test(scheduleTime)) {
    return res.status(400).json({ success: false, error: '시간 형식은 HH:MM 이어야 합니다.' });
  }

  if (globalConfig.scheduleTime !== scheduleTime || globalConfig.scheduleEnabled !== !!scheduleEnabled) {
    globalConfig.lastRunDate = ''; // Reset run date to allow same-day testing when time or status changes
  }
  globalConfig.scheduleEnabled = !!scheduleEnabled;
  if (scheduleTime) globalConfig.scheduleTime = scheduleTime;
  if (Array.isArray(naverKeywords)) {
    globalConfig.naverKeywords = naverKeywords.flatMap(k => k.split(/[\n,]/)).map(k => k.trim()).filter(k => k.length > 0);
  }
  if (Array.isArray(googleKeywords)) {
    globalConfig.googleKeywords = googleKeywords.flatMap(k => k.split(/[\n,]/)).map(k => k.trim()).filter(k => k.length > 0);
  }

  saveConfig();
  console.log(`[설정 변경] 예약 상태: ${globalConfig.scheduleEnabled ? '활성화 (' + globalConfig.scheduleTime + ')' : '비활성화'}, 네이버: ${globalConfig.naverKeywords.length}개, 구글: ${globalConfig.googleKeywords.length}개`);
  res.json({ success: true, config: globalConfig });
});

// Proxy helper function
async function handleProxy(req, res, targetUrl) {
  try {
    const options = {
      method: req.method,
      headers: {
        'content-type': 'application/json',
        'accept': 'application/json, text/plain, */*'
      }
    };
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      options.body = JSON.stringify(req.body);
    }
    const response = await fetch(targetUrl, options);
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await response.json();
      res.status(response.status).json(data);
    } else {
      const data = await response.text();
      res.status(response.status).send(data);
    }
  } catch (err) {
    console.error(`Proxy to ${targetUrl} failed:`, err);
    res.status(500).json({ error: `Proxy failed: ${err.message}` });
  }
}

// Proxied Routes to Cloudflare Pages production serverless functions
app.all('/api/powercontent', (req, res) => {
  const target = 'https://springmoons.pages.dev/api/powercontent' + (req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '');
  handleProxy(req, res, target);
});

app.all('/api/vision-ocr', (req, res) => {
  const target = 'https://springmoons.pages.dev/api/vision-ocr';
  handleProxy(req, res, target);
});

app.all('/api/backlink', (req, res) => {
  const target = 'https://springmoons.pages.dev/api/backlink' + (req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '');
  handleProxy(req, res, target);
});

// Helper: Find Google Chrome or Microsoft Edge on Windows
function getBrowserPath() {
  const chromePaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    path.join(process.env.LOCALAPPDATA || 'C:\\Users\\' + (process.env.USERNAME || 'Default') + '\\AppData\\Local', 'Google\\Chrome\\Application\\chrome.exe')
  ];
  for (const p of chromePaths) {
    if (fs.existsSync(p)) {
      console.log(`[감지] 사용 브라우저: Chrome (${p})`);
      return p;
    }
  }

  const edgePaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', // fallback in case
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
  ];
  for (const p of edgePaths) {
    if (fs.existsSync(p)) {
      console.log(`[감지] 사용 브라우저: Microsoft Edge (${p})`);
      return p;
    }
  }

  return null;
}

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

// Scroll to bottom gradually to trigger all Naver/Google lazy-loaded content/images
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

// OCR 검출 및 매칭되는 단어에 빨간색 동그라미 그리기 함수
async function detectAndDrawRedCircles(browser, buffer, ocrKeywords) {
  try {
    const base64Image = buffer.toString('base64');
    const apiKey = "AIzaSyA8IWoPG8vHeVQISBiI9i4-csuluwsV_no";
    const googleUrl = `https://vision.googleapis.com/v1/images:annotate?key=${encodeURIComponent(apiKey)}`;
    
    console.log("[OCR 검출] Google Vision API 호출 중...");
    const googleResponse = await fetch(googleUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [
          {
            image: { content: base64Image },
            features: [{ type: 'DOCUMENT_TEXT_DETECTION' }]
          }
        ]
      })
    });

    if (!googleResponse.ok) {
      const errText = await googleResponse.text();
      console.error(`Google Vision API 오류: ${googleResponse.status} - ${errText}`);
      return buffer;
    }

    const data = await googleResponse.json();
    const responses = data.responses || [];
    const response = responses[0] || {};
    const textAnnotations = response.textAnnotations || [];
    
    if (textAnnotations.length === 0) {
      console.log("[OCR 검출] 이미지에서 텍스트가 발견되지 않았습니다.");
      return buffer;
    }

    const targetWords = (ocrKeywords && ocrKeywords.length > 0) ? ocrKeywords : ["인디컴퍼니", "inde.co.kr"];
    const matchedBoxes = [];

    for (let i = 1; i < textAnnotations.length; i++) {
      const annotation = textAnnotations[i];
      const originalText = annotation.description || "";
      const text = originalText.toLowerCase().replace(/[\s\-_]+/g, "");

      const matches = targetWords.some(target => {
        const cleanTarget = target.toLowerCase().replace(/[\s\-_]+/g, "");
        return text === cleanTarget;
      });

      if (matches && annotation.boundingPoly && annotation.boundingPoly.vertices) {
        const vertices = annotation.boundingPoly.vertices;
        const v = vertices.map(vertex => ({
          x: vertex.x || 0,
          y: vertex.y || 0
        }));

        const xs = v.map(pt => pt.x);
        const ys = v.map(pt => pt.y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);

        matchedBoxes.push({ minX, maxX, minY, maxY, text: originalText });
      }
    }

    if (matchedBoxes.length === 0) {
      console.log("[OCR 검출] 지정된 특정 단어가 발견되지 않았습니다.");
      return buffer;
    }

    console.log(`[OCR 검출] 특정 단어 발견! 매칭 개수: ${matchedBoxes.length}. 빨간 동그라미 그리기 시작...`);

    const page = await browser.newPage();
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { margin: 0; padding: 0; overflow: hidden; background: white; }
          canvas { display: block; }
        </style>
      </head>
      <body>
        <canvas id="canvas"></canvas>
        <script>
          window.drawImageAndCircles = function(base64Data, boxes) {
            return new Promise((resolve, reject) => {
              const img = new Image();
              img.src = 'data:image/jpeg;base64,' + base64Data;
              img.onload = function() {
                const canvas = document.getElementById('canvas');
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;
                
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);

                ctx.strokeStyle = 'red';
                ctx.lineWidth = 6;

                boxes.forEach(box => {
                  const width = box.maxX - box.minX;
                  const height = box.maxY - box.minY;
                  const centerX = box.minX + width / 2;
                  const centerY = box.minY + height / 2;
                  const radius = Math.max(width, height) / 2 + 12;

                  ctx.beginPath();
                  ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
                  ctx.stroke();
                });
                
                resolve({ width: canvas.width, height: canvas.height });
              };
              img.onerror = function(err) {
                reject(err);
              };
            });
          };
        </script>
      </body>
      </html>
    `;

    await page.setContent(htmlContent);
    
    const dimensions = await page.evaluate(async (imgBase64, boxes) => {
      return await window.drawImageAndCircles(imgBase64, boxes);
    }, base64Image, matchedBoxes);

    await page.setViewport({
      width: dimensions.width,
      height: dimensions.height,
      deviceScaleFactor: 1
    });

    const circledBuffer = await page.screenshot({
      type: 'jpeg',
      quality: 85,
      fullPage: true
    });

    await page.close();
    console.log("[OCR 검출] 빨간 동그라미 그리기 및 이미지 재저장 완료.");
    return circledBuffer;

  } catch (err) {
    console.error("[OCR 검출/그리기 실패]:", err);
    return buffer;
  }
}

// Shared capture method
async function executeScreenshotList(tasks, finalDir, dateStr, ocrKeywords) {
  // tasks: Array of { keyword: string, platform: 'naver' | 'google' }
  const results = [];
  let browser = null;

  try {
    const browserPath = getBrowserPath();
    if (!browserPath) {
      throw new Error("시스템에서 Chrome 또는 Edge 브라우저를 찾을 수 없습니다.");
    }

    browser = await puppeteer.launch({
      executablePath: browserPath,
      headless: "new",
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7'
    });
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });
    await page.setViewport({ width: 1350, height: 900 });

    for (const task of tasks) {
      const cleanKeyword = task.keyword.trim();
      if (!cleanKeyword) continue;
      const platform = task.platform || 'naver';

      try {
        console.log(`[작업 진행] [${platform.toUpperCase()}] 검색 및 스크롤: "${cleanKeyword}"`);
        if (platform === 'google') {
          // Safe human-like navigation starting from the main search page
          await page.goto('https://www.google.com', { waitUntil: 'networkidle2', timeout: 60000 });
          
          // Google Cookie Consent Bypass if exists
          try {
            const consentBtn = await page.$('button[aria-label="Accept all"], button[aria-label="동의"], #L2AGLb');
            if (consentBtn) {
              await consentBtn.click();
              await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 5000 }).catch(() => null);
            }
          } catch (e) {}

          const searchBoxSelector = 'textarea[name="q"], input[name="q"]';
          await page.waitForSelector(searchBoxSelector, { timeout: 10000 });
          await page.click(searchBoxSelector);
          
          // Human-like typing with random character delays
          for (const char of cleanKeyword) {
            await page.type(searchBoxSelector, char);
            await new Promise(resolve => setTimeout(resolve, 60 + Math.random() * 80));
          }
          await page.keyboard.press('Enter');
          await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => null);
        } else {
          const url = `https://search.naver.com/search.naver?query=${encodeURIComponent(cleanKeyword)}`;
          await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
        }

        await autoScroll(page);
        await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 1500)));

        const safeFilename = cleanKeyword.replace(/[\\/:*?"<>|]/g, '_');
        
        // File saved as:
        // Naver: [Keyword] [YYYY.MM.DD].jpg
        // Google: [Keyword] 구글 [YYYY.MM.DD].jpg
        let filename = '';
        if (platform === 'naver') {
          filename = `${safeFilename} ${dateStr}.jpg`;
        } else {
          filename = `${safeFilename} 구글 ${dateStr}.jpg`;
        }
        const filepath = path.join(finalDir, filename);

        let screenshotBuffer = await page.screenshot({
          type: 'jpeg',
          quality: 85,
          fullPage: true
        });

        // Run OCR and draw red circles on it if target words are found
        screenshotBuffer = await detectAndDrawRedCircles(browser, screenshotBuffer, ocrKeywords);

        fs.writeFileSync(filepath, screenshotBuffer);

        console.log(`[저장 완료] [${platform.toUpperCase()}] 파일 경로: ${filepath}`);
        results.push({ keyword: cleanKeyword, platform, success: true, path: filepath });
      } catch (err) {
        console.error(`[작업 실패] [${platform.toUpperCase()}] 키워드: "${cleanKeyword}", 사유:`, err);
        results.push({ keyword: cleanKeyword, platform, success: false, error: err.message });
      }
    }
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  return results;
}

app.post('/api/screenshot', async (req, res) => {
  const { naverKeywords, googleKeywords, ocrKeywords } = req.body;

  const tasks = [];
  if (Array.isArray(naverKeywords)) {
    const cleanNaver = naverKeywords.flatMap(k => k.split(/[\n,]/)).map(k => k.trim()).filter(k => k.length > 0);
    cleanNaver.forEach(k => tasks.push({ keyword: k, platform: 'naver' }));
  }
  if (Array.isArray(googleKeywords)) {
    const cleanGoogle = googleKeywords.flatMap(k => k.split(/[\n,]/)).map(k => k.trim()).filter(k => k.length > 0);
    cleanGoogle.forEach(k => tasks.push({ keyword: k, platform: 'google' }));
  }

  if (tasks.length === 0) {
    return res.status(400).json({ success: false, error: '수집할 키워드가 없습니다.' });
  }

  const dateStr = getKstDateString();
  const finalDir = 'D:\\rank';

  // Try creating D:\rank directory
  try {
    if (!fs.existsSync(finalDir)) {
      fs.mkdirSync(finalDir, { recursive: true });
    }
  } catch (e) {
    console.error(`지정된 경로(${finalDir}) 폴더 생성 실패:`, e);
    return res.status(500).json({ 
      success: false, 
      error: `D:\\rank 저장 폴더를 생성할 수 없습니다. 권한이 있는지 확인하세요. (오류: ${e.message})` 
    });
  }

  try {
    const results = await executeScreenshotList(tasks, finalDir, dateStr, ocrKeywords);
    res.json({
      success: true,
      folder: finalDir,
      results
    });
  } catch (e) {
    console.error("작업 기동 에러:", e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// Background automation scheduler loop (checks every 30 seconds)
setInterval(async () => {
  if (!globalConfig.scheduleEnabled) return;

  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60 * 1000);
  const kst = new Date(utc + (9 * 60 * 60 * 1000)); // KST

  const hour = String(kst.getHours()).padStart(2, '0');
  const minute = String(kst.getMinutes()).padStart(2, '0');
  const currentTimeStr = `${hour}:${minute}`;

  const dateStr = `${kst.getFullYear()}.${String(kst.getMonth() + 1).padStart(2, '0')}.${String(kst.getDate()).padStart(2, '0')}`;

  // If time matches and not run today yet
  if (currentTimeStr === globalConfig.scheduleTime && globalConfig.lastRunDate !== dateStr) {
    globalConfig.lastRunDate = dateStr;
    saveConfig();

    console.log(`[예약 자동 실행] 예정된 시각(${globalConfig.scheduleTime})이 되어 수집을 자동 시작합니다.`);
    const finalDir = 'D:\\rank';
    try {
      if (!fs.existsSync(finalDir)) {
        fs.mkdirSync(finalDir, { recursive: true });
      }

      const tasks = [];
      if (Array.isArray(globalConfig.naverKeywords)) {
        globalConfig.naverKeywords.forEach(k => tasks.push({ keyword: k, platform: 'naver' }));
      }
      if (Array.isArray(globalConfig.googleKeywords)) {
        globalConfig.googleKeywords.forEach(k => tasks.push({ keyword: k, platform: 'google' }));
      }

      if (tasks.length > 0) {
        await executeScreenshotList(tasks, finalDir, dateStr);
        console.log(`[예약 자동 실행] 하루 1회 정기 키워드 수집을 성공적으로 완료하였습니다.`);
      }
    } catch (err) {
      console.error("[예약 자동 실행 실패]:", err);
    }
  }
}, 30000);

// OPTIONS preflight endpoint for client checks
app.options('/api/screenshot', cors(), (req, res) => {
  res.sendStatus(200);
});

const PORT = 3888;
app.listen(PORT, () => {
  console.log(`================================================================`);
  console.log(` [네이버/구글 키워드 검색 풀스크린 캡처 통합 서버 시작되었습니다]`);
  console.log(` 접속용 웹페이지 주소: http://127.0.0.1:${PORT}`);
  console.log(` API Endpoint : http://127.0.0.1:${PORT}/api/screenshot`);
  console.log(` 저장 기본 경로: D:\\rank [파일명: 키워드 YYYY.MM.DD.jpg 저장]`);
  console.log(` 실행 종료는 터미널에서 Ctrl+C를 눌러주세요.`);
  console.log(`================================================================`);
});
