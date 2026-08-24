// BB Backlink Intelligence Engine (Common Crawl + OpenPageRank + Cybokron/CrawlSEO DOM Parser)

export async function onRequestGet(context) {
  const { searchParams } = new URL(context.request.url);
  const rawInput = searchParams.get('domain') || searchParams.get('url') || '';

  if (!rawInput.trim()) {
    return new Response(JSON.stringify({ success: false, error: '도메인 또는 URL을 입력해주세요.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }

  // 1. Clean Domain & Base Target URL
  let cleanDomain = rawInput.trim().toLowerCase();
  cleanDomain = cleanDomain.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0].split('?')[0];
  const targetFullUrl = `https://${cleanDomain}`;
  const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

  const allBacklinks = [];
  const seenUrls = new Set();

  function addBacklink(item) {
    const key = `${item.sourceUrl}->${item.targetUrl}`;
    if (!seenUrls.has(key)) {
      seenUrls.add(key);
      allBacklinks.push(item);
    }
  }

  // 2. [Cybokron / CrawlSEO Live DOM Parser] Real-time Web Graph Crawling
  const seedNetworkSites = [
    'https://busaninterior.kr',
    'https://pbn-1.pages.dev',
    'https://pbn-2.pages.dev',
    'https://academyinteriors.pages.dev',
    'https://officeinteriors.pages.dev',
    'https://inde.co.kr',
    'https://zstree.tistory.com',
    'https://sites.google.com/view/inde-busan/'
  ];

  await Promise.allSettled(
    seedNetworkSites
      .filter(site => !site.includes(cleanDomain))
      .map(async (siteUrl) => {
        try {
          const res = await fetch(siteUrl, {
            headers: { 'User-Agent': userAgent },
            signal: AbortSignal.timeout(4000)
          });
          if (res.ok) {
            const html = await res.text();
            if (html.toLowerCase().includes(cleanDomain)) {
              const linkRegex = new RegExp(`<a\\s+([^>]*?)href=["']([^"']*${cleanDomain}[^"']*)["']([^>]*?)>(.*?)<\\/a>`, 'gis');
              let match;
              while ((match = linkRegex.exec(html)) !== null) {
                const targetHref = match[2];
                const rawAnchor = (match[4] || '').replace(/<[^>]+>/g, '').trim();
                const beforeAttrs = match[1] || '';
                const afterAttrs = match[3] || '';
                const combinedAttrs = (beforeAttrs + ' ' + afterAttrs).toLowerCase();
                const relMatch = combinedAttrs.match(/rel=["']([^"']+)["']/i);
                const rel = relMatch ? relMatch[1] : 'dofollow';
                const sourceHost = new URL(siteUrl).hostname.replace(/^www\./, '');

                addBacklink({
                  sourceDomain: sourceHost,
                  sourceUrl: siteUrl,
                  targetUrl: targetHref,
                  anchorText: rawAnchor || `${cleanDomain} 연결 링크`,
                  rel: rel,
                  engine: 'Cybokron Live Crawl',
                  engineType: 'live_crawl',
                  statusCode: 200
                });
              }
            }
          }
        } catch (e) {}
      })
  );

  // 3. [Common Crawl Index API Integration]
  try {
    const ccIndexUrl = `https://index.commoncrawl.org/CC-MAIN-2024-51-index?url=*.${encodeURIComponent(cleanDomain)}/*&output=json&limit=5`;
    const ccRes = await fetch(ccIndexUrl, {
      headers: { 'User-Agent': userAgent },
      signal: AbortSignal.timeout(3500)
    });
    if (ccRes.ok) {
      const ccText = await ccRes.text();
      const lines = ccText.split('\n').filter(Boolean);
      lines.forEach(line => {
        try {
          const record = JSON.parse(line);
          if (record.url) {
            const u = new URL(record.url);
            const sourceHost = u.hostname.replace(/^www\./, '');
            if (sourceHost !== cleanDomain) {
              addBacklink({
                sourceDomain: sourceHost,
                sourceUrl: record.url,
                targetUrl: targetFullUrl,
                anchorText: `Common Crawl 색인 [${record.mime || 'text/html'}]`,
                rel: 'dofollow',
                engine: 'Common Crawl Index',
                engineType: 'common_crawl',
                statusCode: record.status ? parseInt(record.status) : 200
              });
            }
          }
        } catch (e) {}
      });
    }
  } catch (e) {}

  // 4. [OpenPageRank API Integration]
  let pageRankInfo = { pageRankDecimal: 0, rank: 'N/A' };
  try {
    const oprKey = context.env.OPENPAGERANK_API_KEY || '48k4040ks8gw8goc0o8kocw8gwc0k08gogk44w8g';
    const oprRes = await fetch(`https://openpagerank.com/api/v1.0/getPageRank?domains%5B0%5D=${encodeURIComponent(cleanDomain)}`, {
      headers: { 'API-OPR': oprKey },
      signal: AbortSignal.timeout(3000)
    });
    if (oprRes.ok) {
      const oprData = await oprRes.json();
      if (oprData?.response?.[0]) {
        const item = oprData.response[0];
        pageRankInfo = {
          pageRankDecimal: item.page_rank_decimal || 0,
          rank: item.rank || 'N/A'
        };
      }
    }
  } catch (e) {}

  const uniqueDomains = Array.from(new Set(allBacklinks.map(b => b.sourceDomain)));
  const dofollowCount = allBacklinks.filter(b => b.rel.includes('dofollow') || !b.rel.includes('nofollow')).length;

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
        pageRank: pageRankInfo
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
