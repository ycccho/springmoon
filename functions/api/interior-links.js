/**
 * Cloudflare Pages Function: /api/interior-links
 *
 * [ABSOLUTE IMMUTABILITY & PERMANENT STORAGE CONTRACT]
 * - User-added items (`customItems`) and synced upstream items (`syncedItems`)
 *   are permanently stored in Cloudflare KV (`POWER_CONTENT_KV` / `EDAM_SITE_KV`)
 *   under key `interior_links_immutable_vault_v1` (and backup key `interior_links_immutable_vault_backup_v1`).
 * - APPEND-ONLY LOCK: Existing items in `customItems` can NEVER be modified,
 *   overwritten, or deleted by any API call, sync check, or future feature update.
 *
 * Endpoints:
 * 1) GET  /api/interior-links?action=vault
 *    - Returns the permanently stored `{ customItems, syncedItems }` from Cloudflare KV.
 * 2) POST /api/interior-links?action=add
 *    - Permanently appends new item(s) to Cloudflare KV (append-only, immutable lock).
 * 3) GET  /api/interior-links?action=sync
 *    - Live-fetches https://koreainteriormap.com/links, parses all categories/items,
 *      and returns both live categories and the KV vault.
 * 4) GET  /api/interior-links?action=detail&slug=...
 *    - Live-fetches https://koreainteriormap.com/links/{slug} and extracts detail info.
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store, no-cache, must-revalidate"
};

const VAULT_PRIMARY_KEY = "interior_links_immutable_vault_v1";
const VAULT_BACKUP_KEY = "interior_links_immutable_vault_backup_v1";

function getKvNamespaces(env) {
  const list = [];
  if (env && env.POWER_CONTENT_KV) list.push(env.POWER_CONTENT_KV);
  if (env && env.EDAM_SITE_KV && env.EDAM_SITE_KV !== env.POWER_CONTENT_KV) {
    list.push(env.EDAM_SITE_KV);
  }
  return list;
}

function normalizeItemIdentity(catId, name) {
  return `${String(catId || "").trim().toLowerCase()}::${String(name || "").trim().toLowerCase()}`;
}

async function readImmutableVault(env) {
  const kvs = getKvNamespaces(env);
  const emptyVault = {
    version: 1,
    updatedAt: null,
    customItems: [],
    syncedItems: []
  };
  if (kvs.length === 0) return emptyVault;

  let mergedCustom = [];
  let mergedSynced = [];
  const seenCustom = new Set();
  const seenSynced = new Set();
  let latestUpdated = null;

  for (const kv of kvs) {
    for (const key of [VAULT_PRIMARY_KEY, VAULT_BACKUP_KEY]) {
      try {
        const raw = await kv.get(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object") continue;

        if (parsed.updatedAt && (!latestUpdated || parsed.updatedAt > latestUpdated)) {
          latestUpdated = parsed.updatedAt;
        }

        if (Array.isArray(parsed.customItems)) {
          for (const item of parsed.customItems) {
            if (!item || !item.catId || !item.name) continue;
            const idKey = normalizeItemIdentity(item.catId, item.name);
            if (!seenCustom.has(idKey)) {
              seenCustom.add(idKey);
              mergedCustom.push({
                id: item.id || `custom_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                catId: String(item.catId).trim(),
                catName: String(item.catName || "").trim(),
                name: String(item.name).trim(),
                url: String(item.url || "").trim(),
                slug: String(item.slug || encodeURIComponent(String(item.name).trim())).trim(),
                createdAt: item.createdAt || new Date().toISOString(),
                locked: true,
                immutable: true,
                source: "user_manual_add"
              });
            }
          }
        }

        if (Array.isArray(parsed.syncedItems)) {
          for (const item of parsed.syncedItems) {
            if (!item || !item.catId || !item.name) continue;
            const idKey = normalizeItemIdentity(item.catId, item.name);
            if (!seenSynced.has(idKey)) {
              seenSynced.add(idKey);
              mergedSynced.push({
                catId: String(item.catId).trim(),
                catName: String(item.catName || "").trim(),
                name: String(item.name).trim(),
                url: String(item.url || "").trim(),
                slug: String(item.slug || "").trim(),
                syncedAt: item.syncedAt || new Date().toISOString(),
                locked: true,
                immutable: true,
                source: "upstream_sync"
              });
            }
          }
        }
      } catch (_) {}
    }
  }

  return {
    version: 1,
    updatedAt: latestUpdated,
    customItems: mergedCustom,
    syncedItems: mergedSynced
  };
}

/**
 * Strictly append-only write:
 * Loads current vault from all KV bindings, appends any new customItems / syncedItems
 * without EVER modifying or removing existing items, and writes back to both primary & backup keys.
 */
async function appendToImmutableVault(env, incomingCustom = [], incomingSynced = []) {
  const kvs = getKvNamespaces(env);
  const current = await readImmutableVault(env);

  const seenCustom = new Set(
    current.customItems.map((it) => normalizeItemIdentity(it.catId, it.name))
  );
  const seenSynced = new Set(
    current.syncedItems.map((it) => normalizeItemIdentity(it.catId, it.name))
  );

  let addedCustomCount = 0;
  let addedSyncedCount = 0;

  for (const rawItem of incomingCustom) {
    if (!rawItem || !rawItem.catId || !rawItem.name) continue;
    const catId = String(rawItem.catId).trim();
    const name = String(rawItem.name).trim();
    if (!catId || !name) continue;

    const idKey = normalizeItemIdentity(catId, name);
    // IMMUTABLE LOCK: If this item already exists, never overwrite or mutate it
    if (seenCustom.has(idKey)) continue;

    seenCustom.add(idKey);
    current.customItems.push({
      id: rawItem.id || `custom_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      catId,
      catName: String(rawItem.catName || "").trim(),
      name,
      url: String(rawItem.url || "").trim(),
      slug: String(rawItem.slug || encodeURIComponent(name)).trim(),
      createdAt: rawItem.createdAt || new Date().toISOString(),
      locked: true,
      immutable: true,
      source: "user_manual_add"
    });
    addedCustomCount++;
  }

  for (const rawItem of incomingSynced) {
    if (!rawItem || !rawItem.catId || !rawItem.name) continue;
    const catId = String(rawItem.catId).trim();
    const name = String(rawItem.name).trim();
    if (!catId || !name) continue;

    const idKey = normalizeItemIdentity(catId, name);
    if (seenSynced.has(idKey)) continue;

    seenSynced.add(idKey);
    current.syncedItems.push({
      catId,
      catName: String(rawItem.catName || "").trim(),
      name,
      url: String(rawItem.url || "").trim(),
      slug: String(rawItem.slug || "").trim(),
      syncedAt: rawItem.syncedAt || new Date().toISOString(),
      locked: true,
      immutable: true,
      source: "upstream_sync"
    });
    addedSyncedCount++;
  }

  current.updatedAt = new Date().toISOString();
  const serialized = JSON.stringify(current);

  for (const kv of kvs) {
    await kv.put(VAULT_PRIMARY_KEY, serialized);
    await kv.put(VAULT_BACKUP_KEY, serialized);
  }

  return {
    vault: current,
    addedCustomCount,
    addedSyncedCount,
    kvBound: kvs.length > 0
  };
}

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
  const { request, env } = context;

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const url = new URL(request.url);
  const action = url.searchParams.get("action") || "sync";

  try {
    // 1) POST: Append-only permanent save to Cloudflare KV Vault
    if (request.method === "POST") {
      const body = await request.json();
      const incomingCustom = [];
      const incomingSynced = [];

      if (body && body.item && typeof body.item === "object") {
        incomingCustom.push(body.item);
      }
      if (body && Array.isArray(body.customItems)) {
        incomingCustom.push(...body.customItems);
      }
      if (body && Array.isArray(body.syncedItems)) {
        incomingSynced.push(...body.syncedItems);
      }

      const result = await appendToImmutableVault(env, incomingCustom, incomingSynced);
      return new Response(
        JSON.stringify({
          ok: true,
          permanent: true,
          kvBound: result.kvBound,
          addedCustomCount: result.addedCustomCount,
          addedSyncedCount: result.addedSyncedCount,
          vault: result.vault
        }),
        { status: 200, headers: CORS_HEADERS }
      );
    }

    // 2) GET ?action=vault: Load permanent immutable vault from Cloudflare KV
    if (action === "vault") {
      const vault = await readImmutableVault(env);
      return new Response(
        JSON.stringify({
          ok: true,
          permanent: true,
          vault
        }),
        { status: 200, headers: CORS_HEADERS }
      );
    }

    // 3) GET ?action=detail&slug=...
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

    // 4) Default: GET ?action=sync
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
    const vault = await readImmutableVault(env);

    return new Response(
      JSON.stringify({
        ok: true,
        fetchedAt: new Date().toISOString(),
        total: parsed.total,
        categories: parsed.categories,
        vault
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
