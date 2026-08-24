export async function onRequestGet(context) {
  const { searchParams } = new URL(context.request.url);
  const urlParam = searchParams.get("url") || "";
  const mode = searchParams.get("mode") || "all"; // 'all' | 'external' | 'internal'

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
  const targetHost = targetUrl.hostname.toLowerCase().replace(/^www\./, '');

  // Helper to extract links and anchor text from an HTML page
  function extractLinksWithDetails(html, baseUrlStr) {
    // Strip <script> and <style> tags
    const cleanHtml = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "");

    const linkRegex = /<a\s+([^>]*?)href=["']([^"']*)["']([^>]*?)>(.*?)<\/a>/gis;
    const results = [];
    const seenUrls = new Set();

    let match;
    while ((match = linkRegex.exec(cleanHtml)) !== null) {
      const beforeAttrs = match[1] || "";
      let rawHref = (match[2] || "").trim();
      const afterAttrs = match[3] || "";
      const rawAnchor = (match[4] || "").replace(/<[^>]+>/g, "").trim();
      const combinedAttrs = (beforeAttrs + " " + afterAttrs).toLowerCase();

      if (
        !rawHref ||
        rawHref.startsWith("javascript:") ||
        rawHref.startsWith("mailto:") ||
        rawHref.startsWith("tel:") ||
        rawHref.startsWith("#")
      ) {
        continue;
      }

      try {
        const resolvedUrl = new URL(rawHref, baseUrlStr);
        resolvedUrl.hash = ""; // Remove fragment
        const finalUrl = resolvedUrl.toString();

        if (seenUrls.has(finalUrl)) continue;
        seenUrls.add(finalUrl);

        const linkHost = resolvedUrl.hostname.toLowerCase().replace(/^www\./, '');
        const isExternal = linkHost !== targetHost && !linkHost.endsWith('.' + targetHost);

        // Rel attribute extraction
        let rel = "dofollow";
        const relMatch = combinedAttrs.match(/rel=["']([^"']+)["']/i);
        if (relMatch) {
          rel = relMatch[1];
        }

        // Filter out media files
        if (/\.(jpg|png|webp|gif|css|js|pdf|zip|svg|mp4|woff2?)$/i.test(resolvedUrl.pathname)) {
          continue;
        }

        results.push({
          url: finalUrl,
          domain: linkHost,
          anchor: rawAnchor || "(앵커 텍스트 없음 / 이미지)",
          rel: rel,
          isExternal: isExternal,
          sourceUrl: baseUrlStr
        });
      } catch (err) {
        // Ignore invalid URL
      }
    }

    return results;
  }

  // Helper to fetch a single URL and return text/html
  async function fetchPage(urlStr) {
    try {
      const response = await fetch(urlStr, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
        },
        redirect: "follow",
        signal: AbortSignal.timeout(6000)
      });

      if (!response.ok) return "";
      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("text/html") && !contentType.includes("text/plain")) return "";
      return await response.text();
    } catch (e) {
      return "";
    }
  }

  try {
    // 1. Fetch main page
    const mainHtml = await fetchPage(targetUrl.toString());
    if (!mainHtml) {
      return new Response(JSON.stringify({ error: "웹페이지를 불러올 수 없습니다. URL 및 접근 권한을 확인해주세요." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const mainPageLinks = extractLinksWithDetails(mainHtml, targetUrl.toString());
    const allLinksMap = new Map();

    mainPageLinks.forEach(link => {
      allLinksMap.set(link.url, link);
    });

    // 2. Identify top internal pages to crawl (up to 5 pages) to discover more outbound links
    const internalUrlsToCrawl = mainPageLinks
      .filter(l => !l.isExternal && l.url !== targetUrl.toString())
      .map(l => l.url)
      .slice(0, 5);

    if (internalUrlsToCrawl.length > 0) {
      const subHtmls = await Promise.all(internalUrlsToCrawl.map(url => fetchPage(url)));
      subHtmls.forEach((subHtml, idx) => {
        if (subHtml) {
          const subLinks = extractLinksWithDetails(subHtml, internalUrlsToCrawl[idx]);
          subLinks.forEach(link => {
            if (!allLinksMap.has(link.url)) {
              allLinksMap.set(link.url, link);
            }
          });
        }
      });
    }

    const allLinks = Array.from(allLinksMap.values());
    const externalLinks = allLinks.filter(l => l.isExternal);
    const internalLinks = allLinks.filter(l => !l.isExternal);

    let filteredLinks = allLinks;
    if (mode === "external") {
      filteredLinks = externalLinks;
    } else if (mode === "internal") {
      filteredLinks = internalLinks;
    }

    return new Response(JSON.stringify({
      success: true,
      targetUrl: targetUrl.toString(),
      targetDomain: targetHost,
      summary: {
        totalCount: allLinks.length,
        externalCount: externalLinks.length,
        internalCount: internalLinks.length,
        referringDomainsCount: new Set(externalLinks.map(l => l.domain)).size
      },
      externalLinks: externalLinks,
      internalLinks: internalLinks,
      links: filteredLinks
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: `오류가 발생했습니다: ${error.message}` }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
}
