export async function onRequestGet(context) {
  const { searchParams } = new URL(context.request.url);
  const domain = searchParams.get('domain');

  if (!domain) {
    return new Response(JSON.stringify({ success: false, error: 'domain is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Clean domain name (e.g. remove http:// or https://)
  const cleanDomain = domain.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0].toLowerCase();

  const results = [];
  let googleBlocked = false;
  let naverBlocked = false;

  const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36';

  // 1. Scrap Naver Site Search
  try {
    const naverUrl = `https://search.naver.com/search.naver?ssc=tab.blog.all&query=site%3A${encodeURIComponent(cleanDomain)}`;
    const res = await fetch(naverUrl, {
      headers: {
        'User-Agent': userAgent,
        'Referer': 'https://www.naver.com/'
      }
    });

    if (res.ok) {
      const html = await res.text();
      if (html.includes('Captcha') || html.includes('IP restriction')) {
        naverBlocked = true;
      } else {
        // Parse blog titles and links
        // Look for links that don't belong to the search domain
        const hrefMatches = html.matchAll(/href="([^"]+)"[^>]*class="[^"]*(?:title_link|api_txt_lines)[^"]*"/g);
        for (const match of hrefMatches) {
          let url = match[1];
          if (url.startsWith('//')) url = 'https:' + url;
          if (url.startsWith('/') || url.includes('naver.com/search') || url.includes(cleanDomain)) continue;
          
          results.push({
            url,
            title: 'Naver Blog Post',
            source: 'Naver'
          });
        }
      }
    } else {
      naverBlocked = true;
    }
  } catch (e) {
    console.error("Naver backlink scrape error:", e);
    naverBlocked = true;
  }

  // 2. Scrap Google Exact Mentions
  try {
    const googleUrl = `https://www.google.com/search?q=%22${encodeURIComponent(cleanDomain)}%22`;
    const res = await fetch(googleUrl, {
      headers: {
        'User-Agent': userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.8,en-US;q=0.5,en;q=0.3'
      }
    });

    if (res.ok) {
      const html = await res.text();
      if (res.status === 429 || html.includes('/sorry/index') || html.includes('captcha')) {
        googleBlocked = true;
      } else {
        // Extract Google search result URLs
        // Typically inside <a href="/url?q=..." or direct <a href="...
        const linkMatches = html.matchAll(/<a href="\/url\?q=([^&"]+)/g);
        for (const match of linkMatches) {
          const rawUrl = decodeURIComponent(match[1]);
          if (rawUrl.startsWith('/') || rawUrl.includes('google.com') || rawUrl.includes(cleanDomain)) continue;

          results.push({
            url: rawUrl,
            title: 'Web Mention',
            source: 'Google'
          });
        }

        // Direct links match (sometimes google returns direct URLs)
        const directMatches = html.matchAll(/<a href="(https?:\/\/[^"]+)"/g);
        for (const match of directMatches) {
          const url = match[1];
          if (url.includes('google.com') || url.includes('gstatic.com') || url.includes(cleanDomain)) continue;

          results.push({
            url,
            title: 'Web Mention',
            source: 'Google'
          });
        }
      }
    } else {
      googleBlocked = true;
    }
  } catch (e) {
    console.error("Google backlink scrape error:", e);
    googleBlocked = true;
  }

  // Filter duplicate URLs
  const uniqueUrls = new Set();
  const filteredResults = [];
  for (const item of results) {
    const normalized = item.url.replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/$/, '');
    if (!uniqueUrls.has(normalized)) {
      uniqueUrls.add(normalized);
      filteredResults.push(item);
    }
  }

  // Limit to max 30 results
  const limitedResults = filteredResults.slice(0, 30);

  return new Response(JSON.stringify({
    success: true,
    domain: cleanDomain,
    links: limitedResults,
    googleBlocked,
    naverBlocked,
    warning: (googleBlocked || naverBlocked) ? '일부 검색 엔진에서 봇 탐지로 인해 자동 조회가 제한되었습니다. 하단의 수동 조회 링크를 사용해 주세요.' : null
  }), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}
