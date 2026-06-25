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

  try {
    // Fetch target URL with user-agent
    const response = await fetch(targetUrl.toString(), {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
      },
      redirect: "follow"
    });

    if (!response.ok) {
      return new Response(JSON.stringify({ error: `페이지를 가져오는 데 실패했습니다. (상태 코드: ${response.status})` }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) {
      return new Response(JSON.stringify({ error: "HTML 페이지가 아닙니다." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const html = await response.text();
    
    // Strip <script> and <style> tags to avoid parsing template strings inside JS/CSS
    const cleanHtml = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "");

    // Extract links using regex matching href inside anchor tags
    const matches = cleanHtml.matchAll(/<a\s+[^>]*href=["']([^"']*)["']/gi);
    const uniqueLinks = new Set();
    const targetOrigin = targetUrl.origin;

    for (const match of matches) {
      let rawHref = match[1].trim();
      if (!rawHref || rawHref.startsWith("javascript:") || rawHref.startsWith("mailto:") || rawHref.startsWith("tel:") || rawHref.startsWith("#")) {
        continue;
      }

      try {
        // Resolve relative paths relative to base targetUrl
        const resolvedUrl = new URL(rawHref, targetUrl.toString());
        // Clean fragment
        resolvedUrl.hash = "";
        
        // Check if same origin (sub URL of the homepage domain)
        if (resolvedUrl.origin === targetOrigin) {
          let finalHref = resolvedUrl.toString();
          uniqueLinks.add(finalHref);
        }
      } catch (err) {
        // Skip invalid urls
      }
    }

    const resultList = Array.from(uniqueLinks).sort();

    return new Response(JSON.stringify({ links: resultList, count: resultList.length }), {
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
