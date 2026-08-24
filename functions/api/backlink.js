export async function onRequestGet(context) {
  const { searchParams } = new URL(context.request.url);
  const rawInput = searchParams.get('domain') || searchParams.get('url') || '';

  if (!rawInput.trim()) {
    return new Response(JSON.stringify({ success: false, error: '조회할 도메인 또는 URL을 입력해주세요.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Clean domain & base URL
  let cleanDomain = rawInput.trim().toLowerCase();
  cleanDomain = cleanDomain.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0].split('?')[0];

  const targetFullUrl = `https://${cleanDomain}`;
  const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

  const allBacklinks = [];
  const seenUrls = new Set();
  let googleFound = 0;
  let naverFound = 0;
  let pbnFound = 0;

  // 1. Check Known PBNs and Partner Sites in real-time
  const networkSites = [
    'https://pbn-1.pages.dev',
    'https://pbn-2.pages.dev',
    'https://academyinteriors.pages.dev',
    'https://officeinteriors.pages.dev',
    'https://busaninterior.kr',
    'https://inde.co.kr',
    'https://zstree.tistory.com',
    'https://sites.google.com/view/inde-busan/'
  ];

  await Promise.allSettled(
    networkSites
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
              // Extract matching <a> tags
              const regex = new RegExp(`<a\\s+([^>]*?)href=["']([^"']*${cleanDomain}[^"']*)["']([^>]*?)>(.*?)<\\/a>`, 'gis');
              let match;
              while ((match = regex.exec(html)) !== null) {
                const linkHref = match[2];
                const rawAnchor = (match[4] || '').replace(/<[^>]+>/g, '').trim();
                const beforeAttrs = match[1] || '';
                const afterAttrs = match[3] || '';
                const combined = (beforeAttrs + ' ' + afterAttrs).toLowerCase();
                const relMatch = combined.match(/rel=["']([^"']+)["']/i);
                const rel = relMatch ? relMatch[1] : 'dofollow';

                const sourceHost = new URL(siteUrl).hostname.replace(/^www\./, '');
                const uniqueKey = `${siteUrl}->${linkHref}`;

                if (!seenUrls.has(uniqueKey)) {
                  seenUrls.add(uniqueKey);
                  pbnFound++;
                  allBacklinks.push({
                    sourceDomain: sourceHost,
                    sourceUrl: siteUrl,
                    targetUrl: linkHref,
                    anchorText: rawAnchor || `${cleanDomain} 링크`,
                    rel: rel,
                    engine: 'PBN / Network Site',
                    engineType: 'pbn',
                    status: 'Active (200 OK)'
                  });
                }
              }
            }
          }
        } catch (e) {
          // ignore timeout
        }
      })
  );

  // 2. Naver Blog Search Scraping
  try {
    const naverBlogUrl = `https://search.naver.com/search.naver?ssc=tab.blog.all&query=${encodeURIComponent(`"${cleanDomain}"`)}`;
    const res = await fetch(naverBlogUrl, {
      headers: {
        'User-Agent': userAgent,
        'Referer': 'https://www.naver.com/'
      },
      signal: AbortSignal.timeout(4000)
    });

    if (res.ok) {
      const html = await res.text();
      const blogMatches = html.matchAll(/<a[^>]+href="(https?:\/\/blog\.naver\.com\/[^"]+)"[^>]*class="[^"]*(?:title_link|api_txt_lines)[^"]*"[^>]*>(.*?)<\/a>/gis);
      for (const bm of blogMatches) {
        const link = bm[1];
        const title = bm[2].replace(/<[^>]+>/g, '').trim();
        const uniqueKey = `naver->${link}`;
        if (!seenUrls.has(uniqueKey)) {
          seenUrls.add(uniqueKey);
          naverFound++;
          allBacklinks.push({
            sourceDomain: 'blog.naver.com',
            sourceUrl: link,
            targetUrl: targetFullUrl,
            anchorText: title || '네이버 블로그 백링크 멘션',
            rel: 'dofollow',
            engine: 'Naver Blog',
            engineType: 'naver',
            status: 'Indexed'
          });
        }
      }
    }
  } catch (e) {
    // ignore
  }

  // 3. Naver Web Search Scraping
  try {
    const naverWebUrl = `https://search.naver.com/search.naver?where=nexearch&query=${encodeURIComponent(`"${cleanDomain}" -site:${cleanDomain}`)}`;
    const res = await fetch(naverWebUrl, {
      headers: { 'User-Agent': userAgent },
      signal: AbortSignal.timeout(4000)
    });

    if (res.ok) {
      const html = await res.text();
      const webMatches = html.matchAll(/<a[^>]+href="(https?:\/\/[^"]+)"[^>]*class="[^"]*(?:link_tit|total_tit|api_txt_lines)[^"]*"[^>]*>(.*?)<\/a>/gis);
      for (const wm of webMatches) {
        const link = wm[1];
        const title = wm[2].replace(/<[^>]+>/g, '').trim();
        try {
          const u = new URL(link);
          const host = u.hostname.toLowerCase().replace(/^www\./, '');
          if (host !== cleanDomain && !host.endsWith('.' + cleanDomain) && !host.includes('naver.com')) {
            const uniqueKey = `naverweb->${link}`;
            if (!seenUrls.has(uniqueKey)) {
              seenUrls.add(uniqueKey);
              naverFound++;
              allBacklinks.push({
                sourceDomain: host,
                sourceUrl: link,
                targetUrl: targetFullUrl,
                anchorText: title || `${host} 웹 문서`,
                rel: 'dofollow',
                engine: 'Naver Web',
                engineType: 'naver',
                status: 'Indexed'
              });
            }
          }
        } catch (e) {}
      }
    }
  } catch (e) {}

  // 4. Google Custom Search API
  try {
    let apiKey = context.env.GOOGLE_VISION_API_KEY || 'AIzaSyA8IWoPG8vHeVQISBiI9i4-csuluwsV_no';
    const cx = 'f5cb5113d87ee4368';
    const query = `"${cleanDomain}" -site:${cleanDomain}`;
    const gcsUrl = `https://www.googleapis.com/customsearch/v1?key=${encodeURIComponent(apiKey)}&cx=${encodeURIComponent(cx)}&q=${encodeURIComponent(query)}`;

    const gcsRes = await fetch(gcsUrl, { signal: AbortSignal.timeout(3500) });
    if (gcsRes.ok) {
      const gcsData = await gcsRes.json();
      const items = gcsData.items || [];
      items.forEach(item => {
        const link = item.link;
        if (!link) return;
        try {
          const u = new URL(link);
          const host = u.hostname.toLowerCase().replace(/^www\./, '');
          if (host !== cleanDomain && !host.endsWith('.' + cleanDomain)) {
            const uniqueKey = `google->${link}`;
            if (!seenUrls.has(uniqueKey)) {
              seenUrls.add(uniqueKey);
              googleFound++;
              allBacklinks.push({
                sourceDomain: host,
                sourceUrl: link,
                targetUrl: targetFullUrl,
                anchorText: item.title || item.snippet || `${host} Google 색인 페이지`,
                rel: 'dofollow',
                engine: 'Google Index',
                engineType: 'google',
                status: 'Indexed'
              });
            }
          }
        } catch (e) {}
      });
    }
  } catch (e) {}

  // 5. OpenPageRank API
  let pageRankData = { pageRankDecimal: 0, rank: 'N/A' };
  try {
    const oprKey = context.env.OPENPAGERANK_API_KEY || '48k4040ks8gw8goc0o8kocw8gwc0k08gogk44w8g';
    const oprRes = await fetch(`https://openpagerank.com/api/v1.0/getPageRank?domains%5B0%5D=${encodeURIComponent(cleanDomain)}`, {
      headers: { 'API-OPR': oprKey },
      signal: AbortSignal.timeout(3000)
    });
    if (oprRes.ok) {
      const oprJson = await oprRes.json();
      if (oprJson && oprJson.response && oprJson.response[0]) {
        const item = oprJson.response[0];
        pageRankData = {
          pageRankDecimal: item.page_rank_decimal || 0,
          rank: item.rank || 'N/A'
        };
      }
    }
  } catch (e) {}

  const referringDomains = Array.from(new Set(allBacklinks.map(b => b.sourceDomain)));

  return new Response(
    JSON.stringify({
      success: true,
      query: rawInput,
      domain: cleanDomain,
      summary: {
        totalBacklinks: allBacklinks.length,
        referringDomainsCount: referringDomains.length,
        referringDomains: referringDomains,
        pbnCount: pbnFound,
        naverCount: naverFound,
        googleCount: googleFound,
        pageRank: pageRankData
      },
      backlinks: allBacklinks
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    }
  );
}
