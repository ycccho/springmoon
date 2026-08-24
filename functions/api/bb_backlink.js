// Open-Source Backlink Intelligence Engine powered by Common Crawl & Cybokron

export async function onRequestGet(context) {
  const { searchParams } = new URL(context.request.url);
  const rawInput = searchParams.get('domain') || searchParams.get('url') || '';

  if (!rawInput.trim()) {
    return new Response(JSON.stringify({ success: false, error: '도메인 또는 URL을 입력해주세요.' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }

  // 1. Normalize domain
  let cleanDomain = rawInput.trim().toLowerCase();
  cleanDomain = cleanDomain.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0].split('?')[0];
  const targetFullUrl = `https://${cleanDomain}`;
  const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

  const allBacklinks = [];
  const seenKeys = new Set();

  function addLink(item) {
    const key = `${item.sourceUrl}->${item.targetUrl}`;
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      allBacklinks.push(item);
    }
  }

  // 2. Common Crawl Index Query
  const ccIndexes = ['CC-MAIN-2024-51-index', 'CC-MAIN-2024-38-index', 'CC-MAIN-2024-30-index'];
  for (const ccIdx of ccIndexes) {
    try {
      const ccQueryUrl = `https://index.commoncrawl.org/${ccIdx}?url=*.${encodeURIComponent(cleanDomain)}/*&output=json&limit=30`;
      const ccRes = await fetch(ccQueryUrl, {
        headers: { 'User-Agent': userAgent },
        signal: AbortSignal.timeout(4000)
      });
      if (ccRes.ok) {
        const text = await ccRes.text();
        const lines = text.split('\n').filter(Boolean);
        lines.forEach(line => {
          try {
            const row = JSON.parse(line);
            if (row.url) {
              const u = new URL(row.url);
              const host = u.hostname.replace(/^www\./, '');
              addLink({
                sourceDomain: host,
                sourceUrl: row.url,
                targetUrl: targetFullUrl,
                anchorText: `${host} 웹 인덱스 레코드 [${row.mime || 'text/html'}]`,
                rel: 'dofollow',
                statusCode: row.status ? parseInt(row.status) : 200,
                engine: `Common Crawl (${ccIdx.split('-')[1]})`,
                timestamp: row.timestamp || ''
              });
            }
          } catch(e) {}
        });
        if (allBacklinks.length > 0) break; // Found records in latest index
      }
    } catch(e) {}
  }

  // 3. Cybokron & CrawlSEO Real-time Deep DOM Inspection
  // If target domain has known referring web graphs or user wants live crawl verification
  try {
    const testTargetRes = await fetch(targetFullUrl, {
      headers: { 'User-Agent': userAgent },
      signal: AbortSignal.timeout(3500)
    });
    if (testTargetRes.ok) {
      const targetHtml = await testTargetRes.text();
      // Extract outgoing partner nodes to map reciprocal/inbound graph
      const linkMatches = targetHtml.matchAll(/<a\s+[^>]*?href=["'](https?:\/\/[^"']+)["'][^>]*?>(.*?)<\/a>/gis);
      const candidates = [];
      for (const lm of linkMatches) {
        const outUrl = lm[1];
        try {
          const outHost = new URL(outUrl).hostname.replace(/^www\./, '');
          if (outHost !== cleanDomain && !outHost.includes('google.') && !outHost.includes('naver.') && !outHost.includes('facebook.')) {
            candidates.push(outUrl);
          }
        } catch(e) {}
      }

      // Crawl candidate nodes to find inbound backlinks back to cleanDomain
      await Promise.allSettled(
        candidates.slice(0, 8).map(async (candUrl) => {
          try {
            const candRes = await fetch(candUrl, {
              headers: { 'User-Agent': userAgent },
              signal: AbortSignal.timeout(3000)
            });
            if (candRes.ok) {
              const candHtml = await candRes.text();
              if (candHtml.toLowerCase().includes(cleanDomain)) {
                const inboundRegex = new RegExp(`<a\\s+([^>]*?)href=["']([^"']*${cleanDomain}[^"']*)["']([^>]*?)>(.*?)<\\/a>`, 'gis');
                let match;
                while ((match = inboundRegex.exec(candHtml)) !== null) {
                  const targetHref = match[2];
                  const rawAnchor = (match[4] || '').replace(/<[^>]+>/g, '').trim();
                  const beforeAttrs = match[1] || '';
                  const afterAttrs = match[3] || '';
                  const combinedAttrs = (beforeAttrs + ' ' + afterAttrs).toLowerCase();
                  const relMatch = combinedAttrs.match(/rel=["']([^"']+)["']/i);
                  const rel = relMatch ? relMatch[1] : 'dofollow';
                  const candHost = new URL(candUrl).hostname.replace(/^www\./, '');

                  addLink({
                    sourceDomain: candHost,
                    sourceUrl: candUrl,
                    targetUrl: targetHref,
                    anchorText: rawAnchor || `${cleanDomain} 연결 링크`,
                    rel: rel,
                    statusCode: 200,
                    engine: 'Cybokron Live Crawler',
                    timestamp: new Date().toISOString().slice(0, 10)
                  });
                }
              }
            }
          } catch(e) {}
        })
      );
    }
  } catch(e) {}

  // 4. Calculate OpenPageRank Score Algorithm
  const uniqueDomains = Array.from(new Set(allBacklinks.map(b => b.sourceDomain)));
  const dofollowCount = allBacklinks.filter(b => b.rel.includes('dofollow') || !b.rel.includes('nofollow')).length;

  // PageRank formula simulation: base (0.15) + logarithmic inbound graph weight
  let pageRankDecimal = "0.00";
  if (allBacklinks.length > 0) {
    const rawScore = 0.15 + (Math.log10(allBacklinks.length + 1) * 1.85) + (uniqueDomains.length * 0.2);
    pageRankDecimal = Math.min(10.0, rawScore).toFixed(2);
  }

  return new Response(
    JSON.stringify({
      success: true,
      query: rawInput,
      domain: cleanDomain,
      summary: {
        totalBacklinks: allBacklinks.length,
        referringDomainsCount: uniqueDomains.length,
        referringDomains: uniqueDomains,
        dofollowCount: dofollowCount,
        nofollowCount: allBacklinks.length - dofollowCount,
        pageRank: {
          pageRankDecimal: pageRankDecimal,
          rank: allBacklinks.length > 0 ? `${(10000000 / (allBacklinks.length * 50)).toFixed(0)}` : 'N/A'
        }
      },
      backlinks: allBacklinks
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    }
  );
}
