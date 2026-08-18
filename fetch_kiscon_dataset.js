const fs = require('fs');
const https = require('https');
const path = require('path');

const SERVICE_KEY = '428c65198c3f96ac546f4075499a7a92f3a83f649a539553a437c8e0b46f1649';
const BASE_URL = 'https://apis.data.go.kr/1613000/ConAdminInfoSvc1/GongsiReg';

const S_DATE = '20100101';
const today = new Date();
const formatDigit = (n) => String(n).padStart(2, '0');
const E_DATE = `${today.getFullYear()}${formatDigit(today.getMonth() + 1)}${formatDigit(today.getDate())}`;

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed);
        } catch (e) {
          resolve(null);
        }
      });
    }).on('error', reject);
  });
}

function safeStr(val) {
  if (val === null || val === undefined) return '';
  return String(val).trim();
}

async function main() {
  console.log(`=== 국토교통부 KISCON 전국 전체기간(2010~${today.getFullYear()}) 면허 데이터 전수 추출 시작 ===`);
  
  let pageNo = 1;
  const numOfRows = 1000;
  let totalCount = 150030;
  let allItems = [];

  do {
    const url = `${BASE_URL}?serviceKey=${SERVICE_KEY}&sDate=${S_DATE}&eDate=${E_DATE}&pageNo=${pageNo}&numOfRows=${numOfRows}&_type=json`;
    
    let retry = 0;
    let json = null;
    while (retry < 3 && !json) {
      try {
        json = await fetchJson(url);
      } catch (e) {
        retry++;
        await new Promise(r => setTimeout(r, 500));
      }
    }

    if (!json || !json.response || !json.response.body) {
      console.warn(`[Page ${pageNo}] 응답 수신 실패, 다음 페이지 진행`);
      pageNo++;
      continue;
    }

    const body = json.response.body;
    if (body.totalCount) {
      totalCount = parseInt(body.totalCount) || totalCount;
    }

    let items = [];
    if (body.items && body.items.item) {
      items = Array.isArray(body.items.item) ? body.items.item : [body.items.item];
    }

    if (items.length === 0) {
      console.log(`[Page ${pageNo}] 데이터 항목 없음, 수집 종료`);
      break;
    }

    for (const item of items) {
      const name = safeStr(item.ncrGsKname || item.bzentyNm);
      if (!name) continue;

      allItems.push({
        n: name,
        m: safeStr(item.ncrGsMaster || item.reprsntativeNm),
        i: safeStr(item.ncrItemName || item.indutyNm) || '실내건축공사업',
        a: safeStr(item.ncrGsAddr || item.adres),
        t: safeStr(item.ncrOffTel || item.telno),
        d: safeStr(item.ncrGsRegdate || item.rgsDt || item.ncrGsDate),
        f: safeStr(item.ncrGsFlag) || '신규',
        r: safeStr(item.ncrGsReason) || '-',
        b: safeStr(item.ncrMasterNum || item.bizrno),
        g: safeStr(item.ncrAreaName) || ''
      });
    }

    const totalPages = Math.ceil(totalCount / numOfRows);
    console.log(`[Page ${pageNo}/${totalPages}] 수집 완료 (누적: ${allItems.length.toLocaleString()}건 / 전체: ${totalCount.toLocaleString()}건)`);

    if (allItems.length >= totalCount || items.length < numOfRows) {
      break;
    }

    pageNo++;
    await new Promise(r => setTimeout(r, 100)); // 100ms
  } while (pageNo <= 200);

  console.log(`\n=== 전체 수집 완료: 총 ${allItems.length.toLocaleString()}건 ===`);

  // 중복 제거
  const uniqueMap = new Map();
  allItems.forEach(item => {
    const key = `${item.n}_${item.i}_${item.b}_${item.d}`;
    if (!uniqueMap.has(key)) {
      uniqueMap.set(key, item);
    }
  });

  const finalDataset = Array.from(uniqueMap.values());
  console.log(`중복 제거 후 최종 등록 업체 수: ${finalDataset.length.toLocaleString()}건`);

  // 1. D:\my\springmoon에 저장
  const outPath1 = path.join(__dirname, 'kiscon_all_licenses.json');
  fs.writeFileSync(outPath1, JSON.stringify(finalDataset), 'utf8');
  console.log(`📁 저장 완료: ${outPath1} (${(fs.statSync(outPath1).size / (1024 * 1024)).toFixed(2)} MB)`);

  // 2. 메타데이터 저장
  const meta = {
    updatedAt: new Date().toISOString(),
    totalCount: finalDataset.length,
    period: `${S_DATE} ~ ${E_DATE}`,
    status: "COMPLETE"
  };
  fs.writeFileSync(path.join(__dirname, 'kiscon_meta.json'), JSON.stringify(meta, null, 2), 'utf8');
  console.log('📊 KISCON 전국 전수 데이터베이스 구축 완료!');
}

main().catch(console.error);
