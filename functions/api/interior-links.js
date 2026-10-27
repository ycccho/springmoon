/**
 * Cloudflare Pages Function: /api/interior-links
 * 1) GET /api/interior-links?action=sync
 *    - Live-fetches https://koreainteriormap.com/links
 *    - Parses all categories and vendor links to detect newly added items
 * 2) GET /api/interior-links?action=detail&slug=...
 *    - Live-fetches https://koreainteriormap.com/links/{slug}
 *    - Extracts the unredacted RSC detail payload (links, branches, phone, hours, map coords)
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store, no-cache, must-revalidate"
};

function decodeHtmlEntities(str) {
  if (!str) return "";
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&nbsp;/g, " ")
    .trim();
}

function parseLinksHtml(rawHtml) {
  const bodyMatch = rawHtml.match(/<body[^>]*>([\s\S]*?)<script/i);
  const body = bodyMatch ? bodyMatch[1] : rawHtml;

  const catRegex = /<div id="(c-\d+)" data-cat="\1"[^>]*><h3[^>]*>([\s\S]*?)<span[^>]*>(\d+)<\/span>[\s\S]*?<\/h3><ul[^>]*>([\s\S]*?)<\/ul>/gi;
  const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  const aRegex = /<a\s+([^>]+)>([\s\S]*?)<\/a>/gi;

  const categories = [];
  let total = 0;
  let cm;

  while ((cm = catRegex.exec(body)) !== null) {
    const cid = cm[1];
    const cname = decodeHtmlEntities(cm[2].replace(/<[^>]+>/g, ""));
    const ulHtml = cm[4];
    const items = [];

    let lm;
    liRegex.lastIndex = 0;
    while ((lm = liRegex.exec(ulHtml)) !== null) {
      const liInner = lm[1];
      const anchors = [];
      let am;
      aRegex.lastIndex = 0;
      while ((am = aRegex.exec(liInner)) !== null) {
        anchors.push({ attrs: am[1], text: decodeHtmlEntities(am[2].replace(/<[^>]+>/g, "")) });
      }
      if (anchors.length === 0) continue;

      const firstHrefMatch = anchors[0].attrs.match(/href="([^"]+)"/i);
      let url = firstHrefMatch ? decodeHtmlEntities(firstHrefMatch[1]) : "";
      const name = anchors[0].text;
      let slug = "";

      if (anchors.length > 1) {
        const secHrefMatch = anchors[1].attrs.match(/href="\/links\/([^"]+)"/i);
        if (secHrefMatch) slug = secHrefMatch[1];
      }
      if (url.startsWith("/links/")) {
        if (!slug) slug = url.replace("/links/", "");
        url = "";
      }

      items.push({ name, url, slug });
    }

    total += items.length;
    categories.push({
      id: cid,
      name: cname,
      count: items.length,
      items
    });
  }

  return { total, categories };
}

function parseDetailRsc(rawHtml, slug) {
  const scripts = [];
  const scriptRegex = /self\.__next_f\.push\((\[[\s\S]*?\])\s*\)\s*<\/script>/gi;
  let m;
  while ((m = scriptRegex.exec(rawHtml)) !== null) {
    try {
      const parsed = JSON.parse(m[1]);
      if (Array.isArray(parsed) && typeof parsed[1] === "string") {
        scripts.push(parsed[1]);
      }
    } catch (_) {}
  }

  const combined = scripts.join("\n");

  let title = decodeURIComponent(slug);
  const titleMatch = combined.match(/"h1",null,\{"className":"[^"]*","children":"([^"]+)"\}/);
  if (titleMatch) title = titleMatch[1];

  let subtitle = "";
  const subMatch = combined.match(/"p",null,\{"className":"mt-1 text-xs","children":"([^"]+)"\}/);
  if (subMatch) subtitle = subMatch[1];

  const links = [];
  const linkItemRegex = /\["\$","span",null,\{"className":"w-16 shrink-0","children":"([^"]+)"\}\],\["\$","\$L[0-9a-f]+",null,\{"href":"([^"]+)"/g;
  let lm;
  while ((lm = linkItemRegex.exec(combined)) !== null) {
    links.push({ label: lm[1], url: lm[2] });
  }

  const branches = [];
  const branchBlockMatch = combined.match(/"children":\["지점 ",\d+\]\}\],\["\$","ul",null,\{"className":"[^"]*","children":(\[[\s\S]*?\])\}\]\],\["\$","h2"/);
  if (branchBlockMatch) {
    const rawBranch = branchBlockMatch[1];
    const liChunks = rawBranch.split(/\["\$","li",/);
    for (let i = 1; i < liChunks.length; i++) {
      const chunk = liChunks[i];
      const texts = [];
      const divRegex = /\["\$","div",null,\{"children":"([^"]+)"\}\]/g;
      let dm;
      while ((dm = divRegex.exec(chunk)) !== null) {
        texts.push(dm[1]);
      }
      const telMatch = chunk.match(/"href":"tel:([^"]+)","className":"[^"]*","children":"([^"]+)"/);
      branches.push({
        lines: texts,
        phone: telMatch ? telMatch[2] : "",
        telHref: telMatch ? `tel:${telMatch[1]}` : ""
      });
    }
  }

  const points = [];
  const pointsMatch = combined.match(/"points":(\[\{[\s\S]*?\}\])/);
  if (pointsMatch) {
    try {
      const pts = JSON.parse(pointsMatch[1]);
      if (Array.isArray(pts)) points.push(...pts);
    } catch (_) {}
  }

  return {
    title,
    subtitle,
    links,
    branches,
    points,
    sourceUrl: `https://koreainteriormap.com/links/${slug}`
  };
}

export async function onRequest(context) {
  const { request } = context;

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const url = new URL(request.url);
  const action = url.searchParams.get("action") || "sync";

  try {
    if (action === "detail") {
      const slug = url.searchParams.get("slug") || "";
      if (!slug) {
        return new Response(JSON.stringify({ ok: false, error: "Missing slug" }), {
          status: 400,
          headers: CORS_HEADERS
        });
      }
      const targetUrl = `https://koreainteriormap.com/links/${slug}`;
      const resp = await fetch(targetUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml"
        }
      });
      if (!resp.ok) {
        throw new Error(`Upstream detail fetch failed: HTTP ${resp.status}`);
      }
      const rawHtml = await resp.text();
      const detail = parseDetailRsc(rawHtml, slug);
      return new Response(JSON.stringify({ ok: true, detail }), {
        status: 200,
        headers: CORS_HEADERS
      });
    }

    // Default: action === "sync"
    const resp = await fetch("https://koreainteriormap.com/links", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml",
        "Cache-Control": "no-cache"
      }
    });
    if (!resp.ok) {
      throw new Error(`Upstream sync fetch failed: HTTP ${resp.status}`);
    }
    const rawHtml = await resp.text();
    const parsed = parseLinksHtml(rawHtml);

    return new Response(
      JSON.stringify({
        ok: true,
        fetchedAt: new Date().toISOString(),
        total: parsed.total,
        categories: parsed.categories
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: err.message || String(err)
      }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
