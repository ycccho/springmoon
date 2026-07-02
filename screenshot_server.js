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
  schedules: []
};

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf8');
      const loaded = JSON.parse(data);
      
      globalConfig = { ...globalConfig, ...loaded };
    }
    
    // Migrate legacy config format if schedules array is missing
    if (!globalConfig.schedules || !Array.isArray(globalConfig.schedules)) {
      globalConfig.schedules = [];
      if (globalConfig.scheduleTime) {
        globalConfig.schedules.push({
          id: 'legacy-default',
          enabled: !!globalConfig.scheduleEnabled,
          time: globalConfig.scheduleTime,
          naverKeywords: Array.isArray(globalConfig.naverKeywords) ? globalConfig.naverKeywords : [],
          googleKeywords: Array.isArray(globalConfig.googleKeywords) ? globalConfig.googleKeywords : [],
          ocrKeywords: [],
          saveFolder: 'D:\\search-rank',
          lastRunDate: globalConfig.lastRunDate || ''
        });
      }
    }

    // Bulletproof split and clean for each schedule
    if (Array.isArray(globalConfig.schedules)) {
      globalConfig.schedules.forEach(schedule => {
        if (Array.isArray(schedule.naverKeywords)) {
          schedule.naverKeywords = schedule.naverKeywords
            .flatMap(k => k.split(/[\n,]/))
            .map(k => k.trim())
            .filter(k => k.length > 0);
        } else {
          schedule.naverKeywords = [];
        }
        if (Array.isArray(schedule.googleKeywords)) {
          schedule.googleKeywords = schedule.googleKeywords
            .flatMap(k => k.split(/[\n,]/))
            .map(k => k.trim())
            .filter(k => k.length > 0);
        } else {
          schedule.googleKeywords = [];
        }
        if (Array.isArray(schedule.ocrKeywords)) {
          schedule.ocrKeywords = schedule.ocrKeywords
            .flatMap(k => k.split(/[\n,]/))
            .map(k => k.trim())
            .filter(k => k.length > 0);
        } else {
          schedule.ocrKeywords = [];
        }
      });
    }

    console.log(`[설정 로드] 총 ${globalConfig.schedules.length}개의 예약 설정 로드 완료`);
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
  const { schedules } = req.body;

  if (Array.isArray(schedules)) {
    for (const schedule of schedules) {
      if (schedule.time && !/^\d{2}:\d{2}$/.test(schedule.time)) {
        return res.status(400).json({ success: false, error: '시간 형식은 HH:MM 이어야 합니다.' });
      }

      // Preserve lastRunDate from existing config if matching ID
      const existing = globalConfig.schedules?.find(s => s.id === schedule.id);
      schedule.lastRunDate = existing ? existing.lastRunDate : '';

      // Reset run date to allow same-day testing when time or status changes
      if (existing && (existing.time !== schedule.time || existing.enabled !== schedule.enabled)) {
        schedule.lastRunDate = '';
      }
    }
    globalConfig.schedules = schedules;
  }

  saveConfig();
  console.log(`[설정 변경] 총 ${globalConfig.schedules.length}개의 예약 설정이 저장되었습니다.`);
  res.json({ success: true, config: globalConfig });
});

// 블로그 전체 게시글 목록 가져오기 API
app.get('/api/blog-posts/list', async (req, res) => {
  const blogId = req.query.blogId;
  if (!blogId) {
    return res.status(400).json({ success: false, error: 'blogId가 누락되었습니다.' });
  }

  try {
    // 1페이지 호출하여 전체 글 개수 파악
    const fetchPage = async (p) => {
      const apiUrl = `https://blog.naver.com/PostTitleListAsync.naver?blogId=${encodeURIComponent(blogId)}&viewdate=&parentCategoryNo=&categoryNo=&itemcount=5&authorid=&userSelectMenu=&parentCategoryCode=&currentPage=${p}`;
      const response = await fetch(apiUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': `https://blog.naver.com/${encodeURIComponent(blogId)}`
        }
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const rawText = await response.text();
      const cleanedText = rawText.replace(/\\'/g, "'");
      return JSON.parse(cleanedText);
    };

    const firstPage = await fetchPage(1);
    if (firstPage.resultCode !== 'S' || !firstPage.postList) {
      return res.status(400).json({ success: false, error: firstPage.resultMessage || '블로그 포스트 정보를 가져오지 못했습니다.' });
    }

    const totalCount = parseInt(firstPage.totalCount, 10) || 0;
    const countPerPage = parseInt(firstPage.countPerPage, 10) || 5;
    let allPosts = [...firstPage.postList];

    if (totalCount > allPosts.length && countPerPage > 0) {
      const totalPages = Math.ceil(totalCount / countPerPage);
      
      // 소켓 과부하를 방지하기 위해 15페이지 단위로 나누어 순차 병렬 처리
      const batchSize = 15;
      for (let i = 2; i <= totalPages; i += batchSize) {
        const promises = [];
        for (let p = i; p < i + batchSize && p <= totalPages; p++) {
          promises.push(fetchPage(p).catch(err => {
            console.error(`Page ${p} fetch failed:`, err);
            return null;
          }));
        }
        const results = await Promise.all(promises);
        for (const pageData of results) {
          if (pageData && pageData.resultCode === 'S' && pageData.postList) {
            allPosts = allPosts.concat(pageData.postList);
          }
        }
        // 네이버 서버 부하 방지를 위한 미세한 대기
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // 제목 디코딩 및 링크 포맷팅
    const decodeNaverTitle = (title) => {
      try {
        return decodeURIComponent(title.replace(/\+/g, '%20'));
      } catch (e) {
        return title;
      }
    };

    const formattedPosts = allPosts.map(post => {
      const title = decodeNaverTitle(post.title);
      const link = `https://m.blog.naver.com/PostView.naver?blogId=${encodeURIComponent(blogId)}&logNo=${post.logNo}`;
      return {
        logNo: post.logNo,
        title: title,
        link: link,
        addDate: post.addDate || ''
      };
    });

    // 최신글이 위에 오도록 정렬
    formattedPosts.sort((a, b) => b.logNo.localeCompare(a.logNo));

    res.json({ success: true, totalCount, posts: formattedPosts });
  } catch (e) {
    console.error("블로그 포스트 목록 추출 실패:", e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// 단일 블로그 게시글 처리 API (텍스트 저장 및/또는 스크린샷 캡처)
app.post('/api/blog-posts/process-one', async (req, res) => {
  const { blogId, logNo, title, mode, saveFolder, ocrKeywords } = req.body;
  
  if (!blogId || !logNo || !title || !mode || !saveFolder) {
    return res.status(400).json({ success: false, error: '필수 파라미터가 누락되었습니다.' });
  }

  // 저장 경로 생성
  try {
    if (!fs.existsSync(saveFolder)) {
      fs.mkdirSync(saveFolder, { recursive: true });
    }
  } catch (e) {
    return res.status(500).json({ success: false, error: `폴더 생성 실패: ${e.message}` });
  }

  const safeTitle = title.replace(/[\\/:*?"<>|]/g, '_').trim().slice(0, 80);
  const postUrl = `https://m.blog.naver.com/PostView.naver?blogId=${encodeURIComponent(blogId)}&logNo=${logNo}`;

  try {
    // 1. 상세 페이지 HTML 가져오기 (절대 날짜 파싱 및 텍스트 추출용)
    const htmlResponse = await fetch(postUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Mobile Safari/537.36',
        'Referer': 'https://m.blog.naver.com/'
      }
    });

    if (!htmlResponse.ok) {
      throw new Error(`게시글 페이지 로드 실패 (HTTP ${htmlResponse.status})`);
    }

    const body = await htmlResponse.text();

    // Unix timestamp를 사용해 절대 날짜 추출
    let absoluteDate = '';
    const addDateMatch = body.match(/addDate="(\d+)"/i);
    if (addDateMatch) {
      const timestamp = parseInt(addDateMatch[1], 10);
      const date = new Date(timestamp);
      const kstOffset = 9 * 60 * 60 * 1000;
      const kstDate = new Date(date.getTime() + kstOffset);
      const yyyy = kstDate.getUTCFullYear();
      const mm = String(kstDate.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(kstDate.getUTCDate()).padStart(2, '0');
      absoluteDate = `${yyyy}.${mm}.${dd}`;
    } else {
      const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
      absoluteDate = `${now.getUTCFullYear()}.${String(now.getUTCMonth()+1).padStart(2, '0')}.${String(now.getUTCDate()).padStart(2, '0')}`;
    }

    let textSaved = false;
    let screenshotSaved = false;
    let savedFiles = [];

    // 1번(텍스트) 또는 4번(모두)의 경우 -> 본문 추출 및 저장
    if (mode === "1" || mode === "4") {
      let text = '';
      const parts = body.split(/class="se-main-container"/i);
      if (parts.length > 1) {
        let contentHtml = parts[1].split(/class="post_footer"|id="post_share"|<div class="aside|class="post_tag"|class="reply_area"|class="reply_wrap"/i)[0];
        if (contentHtml.startsWith('>')) contentHtml = contentHtml.slice(1);
        text = contentHtml
          .replace(/<style([\s\S]*?)<\/style>/gi, '')
          .replace(/<script([\s\S]*?)<\/script>/gi, '')
          .replace(/<[^>]*>/g, '\n')
          .replace(/&nbsp;/g, ' ')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&amp;/g, '&')
          .replace(/&quot;/g, '"')
          .replace(/&#039;/g, "'")
          .split('\n')
          .map(line => line.trim())
          .filter(line => line.length > 0)
          .join('\n');
      }

      const fileContent = `게시글 제목: ${title}\n게시글 작성 날짜: ${absoluteDate}\n\n게시글 내용:\n${text}`;
      const txtFilename = `${absoluteDate}-${blogId}-${safeTitle}.txt`;
      const txtPath = path.join(saveFolder, txtFilename);
      fs.writeFileSync(txtPath, fileContent, 'utf8');
      textSaved = true;
      savedFiles.push(txtFilename);
    }

    // 2번(스샷), 3번(스샷+OCR), 4번(모두)의 경우 -> Puppeteer 스샷 촬영
    if (mode === "2" || mode === "3" || mode === "4") {
      const browserPath = getBrowserPath();
      if (!browserPath) {
        throw new Error("시스템에서 Chrome 또는 Edge 브라우저를 찾을 수 없습니다.");
      }

      const browser = await puppeteer.launch({
        executablePath: browserPath,
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });

      try {
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        await page.setExtraHTTPHeaders({
          'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7'
        });
        await page.evaluateOnNewDocument(() => {
          Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        });
        // 모바일 해상도(가로 750px, 고화질 2배율)로 설정 시 모바일 블로그 뷰 캡처에 가장 알맞음
        await page.setViewport({ width: 750, height: 900, deviceScaleFactor: 2 });

        await page.goto(postUrl, { waitUntil: 'networkidle2', timeout: 60000 });
        await autoScroll(page);
        await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 1000)));

        const pngFilename = `${absoluteDate}-${blogId}-${safeTitle}.png`;
        const pngPath = path.join(saveFolder, pngFilename);

        let screenshotBuffer = await page.screenshot({
          type: 'png',
          fullPage: true
        });

        // 3번 또는 4번 모드이며 OCR 키워드가 입력되었을 때 동그라미 처리
        if (mode === "3" || mode === "4") {
          const cleanOcr = Array.isArray(ocrKeywords)
            ? ocrKeywords.flatMap(k => k.split(/[\n,]/)).map(k => k.trim()).filter(k => k.length > 0)
            : [];
          if (cleanOcr.length > 0) {
            const circledBuffer = await detectAndDrawRedCircles(browser, screenshotBuffer, cleanOcr, 'png');
            if (circledBuffer) {
              screenshotBuffer = circledBuffer;
            }
          }
        }

        fs.writeFileSync(pngPath, screenshotBuffer);
        screenshotSaved = true;
        savedFiles.push(pngFilename);
      } finally {
        await browser.close();
      }
    }

    res.json({
      success: true,
      absoluteDate,
      textSaved,
      screenshotSaved,
      savedFiles
    });

  } catch (err) {
    console.error(`게시글 ${logNo} 처리 중 에러:`, err);
    res.status(500).json({ success: false, error: err.message });
  }
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
    // Scroll back to top so that position:fixed elements (like the search header) align at the top of the screenshot!
    window.scrollTo(0, 0);
  });
}

// OCR 검출 및 매칭되는 단어에 빨간색 동그라미 그리기 함수
async function detectAndDrawRedCircles(browser, buffer, ocrKeywords, imageType = 'jpeg') {
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
      
      targetWords.forEach(target => {
        const cleanTarget = target.toLowerCase().replace(/[\s\-_.()]+/g, "");
        const text = (annotation.description || "").toLowerCase().replace(/[\s\-_.()]+/g, "");
        
        if (!text) return;

        // 1. Single token match
        if (text.includes(cleanTarget)) {
          if (annotation.boundingPoly && annotation.boundingPoly.vertices) {
            const vertices = annotation.boundingPoly.vertices;
            const xs = vertices.map(v => v.x || 0);
            const ys = vertices.map(v => v.y || 0);
            matchedBoxes.push({
              minX: Math.min(...xs),
              maxX: Math.max(...xs),
              minY: Math.min(...ys),
              maxY: Math.max(...ys),
              text: annotation.description || ""
            });
          }
          return;
        }

        // 2. Split token match (consecutive tokens merge loop)
        if (cleanTarget.startsWith(text)) {
          let mergedText = text;
          let tempIdx = i + 1;
          let matchedTokens = [annotation];

          while (tempIdx < textAnnotations.length) {
            const nextAnnotation = textAnnotations[tempIdx];
            const nextText = (nextAnnotation.description || "").toLowerCase().replace(/[\s\-_.()]+/g, "");
            mergedText += nextText;
            matchedTokens.push(nextAnnotation);

            if (mergedText.includes(cleanTarget)) {
              // Found consecutive match!
              const xs = [];
              const ys = [];
              matchedTokens.forEach(tok => {
                if (tok.boundingPoly && tok.boundingPoly.vertices) {
                  tok.boundingPoly.vertices.forEach(v => {
                    xs.push(v.x || 0);
                    ys.push(v.y || 0);
                  });
                }
              });
              matchedBoxes.push({
                minX: Math.min(...xs),
                maxX: Math.max(...xs),
                minY: Math.min(...ys),
                maxY: Math.max(...ys),
                text: mergedText
              });
              break;
            }

            if (!cleanTarget.startsWith(mergedText)) {
              break;
            }
            tempIdx++;
          }
        }
      });
    }

    if (matchedBoxes.length === 0) {
      console.log("[OCR 검출] 지정된 특정 단어가 발견되지 않았습니다.");
      return null;
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

    const screenshotOptions = {
      fullPage: true
    };
    if (imageType === 'png') {
      screenshotOptions.type = 'png';
    } else {
      screenshotOptions.type = 'jpeg';
      screenshotOptions.quality = 85;
    }
    const circledBuffer = await page.screenshot(screenshotOptions);

    await page.close();
    console.log("[OCR 검출] 빨간 동그라미 그리기 및 이미지 재저장 완료.");
    return circledBuffer;

  } catch (err) {
    console.error("[OCR 검출/그리기 실패]:", err);
    return null;
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
        const circledBuffer = await detectAndDrawRedCircles(browser, screenshotBuffer, ocrKeywords);

        if (circledBuffer) {
          fs.writeFileSync(filepath, circledBuffer);
          console.log(`[저장 완료] [${platform.toUpperCase()}] 파일 경로: ${filepath}`);
          results.push({ keyword: cleanKeyword, platform, success: true, skipped: false, path: filepath });
        } else {
          console.log(`[저장 제외] [${platform.toUpperCase()}] 키워드: "${cleanKeyword}" - 지정된 OCR 키워드가 이미지에 포함되지 않아 저장을 건너뜁니다.`);
          results.push({ keyword: cleanKeyword, platform, success: true, skipped: true, path: null });
        }
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
  const finalDir = 'D:\\search-rank';

  // Try creating D:\search-rank directory
  try {
    if (!fs.existsSync(finalDir)) {
      fs.mkdirSync(finalDir, { recursive: true });
    }
  } catch (e) {
    console.error(`지정된 경로(${finalDir}) 폴더 생성 실패:`, e);
    return res.status(500).json({ 
      success: false, 
      error: `D:\\search-rank 저장 폴더를 생성할 수 없습니다. 권한이 있는지 확인하세요. (오류: ${e.message})` 
    });
  }

  const cleanOcr = Array.isArray(ocrKeywords) 
    ? ocrKeywords.flatMap(k => k.split(/[\n,]/)).map(k => k.trim()).filter(k => k.length > 0)
    : [];
  const ocrList = cleanOcr.length > 0 ? cleanOcr : undefined;

  try {
    const results = await executeScreenshotList(tasks, finalDir, dateStr, ocrList);
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
  if (!Array.isArray(globalConfig.schedules) || globalConfig.schedules.length === 0) return;

  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60 * 1000);
  const kst = new Date(utc + (9 * 60 * 60 * 1000)); // KST

  const hour = String(kst.getHours()).padStart(2, '0');
  const minute = String(kst.getMinutes()).padStart(2, '0');
  const currentTimeStr = `${hour}:${minute}`;

  const dateStr = `${kst.getFullYear()}.${String(kst.getMonth() + 1).padStart(2, '0')}.${String(kst.getDate()).padStart(2, '0')}`;

  for (const schedule of globalConfig.schedules) {
    if (!schedule.enabled) continue;

    if (currentTimeStr === schedule.time && schedule.lastRunDate !== dateStr) {
      schedule.lastRunDate = dateStr;
      saveConfig();

      console.log(`[예약 자동 실행] 예정된 시각(${schedule.time})이 되어 수집을 자동 시작합니다.`);
      const finalDir = schedule.saveFolder || 'D:\\search-rank';
      try {
        if (!fs.existsSync(finalDir)) {
          fs.mkdirSync(finalDir, { recursive: true });
        }

        const tasks = [];
        if (Array.isArray(schedule.naverKeywords)) {
          schedule.naverKeywords.forEach(k => tasks.push({ keyword: k, platform: 'naver' }));
        }
        if (Array.isArray(schedule.googleKeywords)) {
          schedule.googleKeywords.forEach(k => tasks.push({ keyword: k, platform: 'google' }));
        }

        if (tasks.length > 0) {
          const ocrList = Array.isArray(schedule.ocrKeywords) && schedule.ocrKeywords.length > 0
            ? schedule.ocrKeywords
            : undefined;

          await executeScreenshotList(tasks, finalDir, dateStr, ocrList);
          console.log(`[예약 자동 실행] 예정 시각(${schedule.time})의 정기 키워드 수집을 성공적으로 완료하였습니다. (저장경로: ${finalDir})`);
        }
      } catch (err) {
        console.error(`[예약 자동 실행 실패 - 시각: ${schedule.time}]:`, err);
      }
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
  console.log(` 저장 기본 경로: D:\\search-rank [파일명: 키워드 YYYY.MM.DD.jpg 저장]`);
  console.log(` 실행 종료는 터미널에서 Ctrl+C를 눌러주세요.`);
  console.log(`================================================================`);
});
