export async function onRequestGet(context) {
  const urlParam = new URL(context.request.url).searchParams.get("url") || "";

  if (!urlParam) {
    return new Response(JSON.stringify({ error: "URL을 입력해주세요." }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  // Parse and normalize the input URL
  let targetUrl;
  try {
    let rawUrl = urlParam.trim();
    if (!/^https?:\/\//i.test(rawUrl)) {
      rawUrl = "http://" + rawUrl;
    }
    targetUrl = new URL(rawUrl);
  } catch (e) {
    return new Response(JSON.stringify({ error: "올바르지 않은 URL 형식입니다." }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  const targetOrigin = targetUrl.origin;
  const baseSegments = targetUrl.pathname.split("/").filter(Boolean).length;

  // Helper to extract links from an HTML page
  function extractLinksFromHtml(html, baseUrlStr) {
    // Strip <script> and <style> tags to avoid parsing template strings inside JS/CSS
    const cleanHtml = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "");

    const matches = cleanHtml.matchAll(/<a\s+[^>]*href=["']([^"']*)["']/gi);
    const links = new Set();
    
    for (const match of matches) {
      let rawHref = match[1].trim();
      if (!rawHref || rawHref.startsWith("javascript:") || rawHref.startsWith("mailto:") || rawHref.startsWith("tel:") || rawHref.startsWith("#")) {
        continue;
      }

      try {
        const resolvedUrl = new URL(rawHref, baseUrlStr);
        resolvedUrl.hash = "";
        
        if (resolvedUrl.origin === targetOrigin) {
          links.add(resolvedUrl.toString());
        }
      } catch (err) {
        // Ignore invalid URL
      }
    }
    return Array.from(links);
  }

  // Helper to fetch a single URL and return its text/html
  async function fetchPage(urlStr) {
    try {
      const response = await fetch(urlStr, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
        },
        redirect: "follow",
        signal: AbortSignal.timeout(5000) // 5 seconds timeout
      });

      if (!response.ok) return "";
      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("text/html")) return "";
      return await response.text();
    } catch (e) {
      return "";
    }
  }

  try {
    // 1. Fetch homepage (Level 1)
    const level1Html = await fetchPage(targetUrl.toString());
    if (!level1Html) {
      return new Response(JSON.stringify({ error: "홈페이지를 가져오는 데 실패했습니다." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const level1Links = extractLinksFromHtml(level1Html, targetUrl.toString());
    const allCrawledLinks = new Set(level1Links);

    // 2. Identify sub-pages to crawl (Level 2)
    const toCrawl = level1Links.filter(lnk => {
      try {
        const u = new URL(lnk);
        const segs = u.pathname.split("/").filter(Boolean).length;
        
        // Don't crawl targetUrl itself again
        if (u.toString() === targetUrl.toString()) return false;
        
        // Only crawl shallow URLs (depth <= baseSegments + 1)
        if (segs > baseSegments + 1) return false;

        // Skip obvious assets or post patterns
        if (/\.(jpg|png|webp|gif|css|js|pdf|zip|svg)$/i.test(u.pathname)) return false;
        if (/\/detail\//i.test(u.pathname) || /\/view\//i.test(u.pathname) || /\/post\//i.test(u.pathname) || /\/read\//i.test(u.pathname)) return false;

        return true;
      } catch (e) {
        return false;
      }
    });

    // Limit Level 2 fetch to maximum 10 URLs to prevent CF Worker timeout/resource limits
    const level2Urls = toCrawl.slice(0, 10);

    // Fetch Level 2 pages in parallel
    const level2Htmls = await Promise.all(level2Urls.map(url => fetchPage(url)));

    // Extract links from Level 2 pages
    for (let i = 0; i < level2Urls.length; i++) {
      const html = level2Htmls[i];
      if (html) {
        const links = extractLinksFromHtml(html, level2Urls[i]);
        for (const lnk of links) {
          allCrawledLinks.add(lnk);
        }
      }
    }

    // 3. Final Filtering of all extracted links
    const finalFilteredLinks = Array.from(allCrawledLinks).filter(lnk => {
      try {
        const u = new URL(lnk);
        const segments = u.pathname.split("/").filter(Boolean);
        const segsCount = segments.length;

        // Exclude типичный post/detail indicators in path
        if (/\/detail\//i.test(u.pathname) || /\/view\//i.test(u.pathname) || /\/post\//i.test(u.pathname) || /\/read\//i.test(u.pathname)) {
          return false;
        }

        // Exclude standard asset extensions
        if (/\.(jpg|png|webp|gif|css|js|pdf|zip|svg)$/i.test(u.pathname)) {
          return false;
        }

        // If any segment is purely numeric, it's highly likely a post/item detail ID
        if (segments.some(seg => /^\d+$/.test(seg))) {
          return false;
        }

        // Exclude sub-items under specific list-only categories (e.g. /blog/post-slug, /news/post-slug)
        const detailPrefixes = ['blog', 'news', 'notice', 'board', 'posts', 'article', 'articles', 'story', 'stories', 'qna', 'faq', 'event', 'events'];
        if (segments.length > 1 && detailPrefixes.includes(segments[0].toLowerCase())) {
          return false;
        }

        // Exclude deep paths (segments > baseSegments + 2)
        if (segsCount > baseSegments + 2) {
          return false;
        }

        // Exclude base URL matching exactly or trailing slash variations to only show actual subpages/subcategories
        const cleanedTarget = targetUrl.toString().replace(/\/$/, "");
        const cleanedLnk = lnk.replace(/\/$/, "");
        if (cleanedTarget === cleanedLnk) {
          return false;
        }

        return true;
      } catch (e) {
        return false;
      }
    }).sort();

    return new Response(JSON.stringify({ links: finalFilteredLinks, count: finalFilteredLinks.length }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: `요청 중 오류가 발생했습니다: ${error.message}` }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
}
