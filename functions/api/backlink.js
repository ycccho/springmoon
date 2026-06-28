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

  // Get Custom Search API Key from environment or fallback
  let apiKey = context.env.GOOGLE_VISION_API_KEY;
  if (!apiKey) {
    apiKey = "AIzaSyA8IWoPG8vHeVQISBiI9i4-csuluwsV_no";
  }
  const cx = "f5cb5113d87ee4368";

  // 1. Google Custom Search JSON API
  try {
    const query = `"${cleanDomain}" -site:${cleanDomain}`;
    const gcsUrl = `https://www.googleapis.com/customsearch/v1?key=${encodeURIComponent(apiKey)}&cx=${encodeURIComponent(cx)}&q=${encodeURIComponent(query)}`;
    
    const res = await fetch(gcsUrl);
    if (res.ok) {
      const data = await res.json();
      const items = data.items || [];
      
      items.forEach(item => {
        const url = item.link;
        if (!url) return;
        
        try {
          const urlObj = new URL(url);
          const hostname = urlObj.hostname.toLowerCase();
          
          // Exclude target domain and all its subdomains
          if (hostname === cleanDomain || hostname.endsWith('.' + cleanDomain)) {
            return;
          }
          
          results.push({
            url: url,
            domain: hostname.replace(/^www\./, ''),
            title: item.title || 'Mention Page',
            source: 'Google'
          });
        } catch (e) {
          // ignore invalid URLs
        }
      });
    } else {
      const errText = await res.text();
      console.error("Google GCS API error response:", errText);
      googleBlocked = true;
    }
  } catch (e) {
    console.error("Google GCS API request error:", e);
    googleBlocked = true;
  }

  // 2. Scrap Naver Blog search as secondary fallback (still kept, but safe if blocked)
  try {
    const naverUrl = `https://search.naver.com/search.naver?ssc=tab.blog.all&query=%22${encodeURIComponent(cleanDomain)}%22+-site%3A${encodeURIComponent(cleanDomain)}`;
    const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36';
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
        const hrefMatches = html.matchAll(/href="([^"]+)"[^>]*class="[^"]*(?:title_link|api_txt_lines)[^"]*"/g);
        for (const match of hrefMatches) {
          let url = match[1];
          if (url.startsWith('//')) url = 'https:' + url;
          
          try {
            const urlObj = new URL(url);
            const hostname = urlObj.hostname.toLowerCase();
            
            // Exclude target domain and all subdomains
            if (hostname === cleanDomain || hostname.endsWith('.' + cleanDomain)) {
              continue;
            }
            
            results.push({
              url,
              domain: hostname.replace(/^www\./, ''),
              title: 'Naver Blog Post',
              source: 'Naver'
            });
          } catch(e) {}
        }
      }
    } else {
      naverBlocked = true;
    }
  } catch (e) {
    console.error("Naver backlink scrape error:", e);
    naverBlocked = true;
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
    naverBlocked
  }), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}
