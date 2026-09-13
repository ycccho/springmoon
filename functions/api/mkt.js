/**
 * Cloudflare Pages Functions: /api/mkt
 * Handles ad performance data storage and retrieval using KV (POWER_CONTENT_KV)
 * with graceful fallback to /mkt_data.json
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Sync-Key",
  "Content-Type": "application/json; charset=utf-8"
};

const KV_KEY = "mkt:performance_data";
const DEFAULT_SYNC_KEY = "springmoon-mkt-sync-2026";

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS
  });
}

export async function onRequestGet(context) {
  const kv = context.env.POWER_CONTENT_KV;
  const url = new URL(context.request.url);

  try {
    let data = null;

    // 1. Try reading from Cloudflare KV
    if (kv) {
      try {
        const raw = await kv.get(KV_KEY, "text");
        if (raw) {
          data = JSON.parse(raw);
        }
      } catch (err) {
        console.warn("Error reading from KV:", err);
      }
    }

    // 2. If not found in KV, fallback to static /mkt_data.json
    if (!data) {
      try {
        const fallbackUrl = new URL("/mkt_data.json", url.origin).toString();
        const res = await fetch(fallbackUrl);
        if (res.ok) {
          data = await res.json();
        }
      } catch (err) {
        console.warn("Error reading fallback JSON:", err);
      }
    }

    if (!data) {
      // Default empty structure if no data exists yet
      data = {
        updated_at: new Date().toISOString(),
        summary: { total_spend: 0, total_impressions: 0, total_clicks: 0, avg_cpc: 0, avg_ctr: 0 },
        daily: {},
        keywords: []
      };
    }

    return new Response(JSON.stringify({
      success: true,
      data: data
    }), {
      status: 200,
      headers: CORS_HEADERS
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: CORS_HEADERS
    });
  }
}

export async function onRequestPost(context) {
  const kv = context.env.POWER_CONTENT_KV;
  const syncKey = context.request.headers.get("X-Sync-Key") || "";
  const expectedKey = context.env.MKT_SYNC_KEY || DEFAULT_SYNC_KEY;

  if (syncKey !== expectedKey) {
    return new Response(JSON.stringify({
      success: false,
      error: "Unauthorized: Invalid or missing X-Sync-Key"
    }), {
      status: 401,
      headers: CORS_HEADERS
    });
  }

  try {
    const payload = await context.request.json();
    if (!payload || typeof payload !== "object") {
      return new Response(JSON.stringify({
        success: false,
        error: "Invalid JSON body"
      }), {
        status: 400,
        headers: CORS_HEADERS
      });
    }

    // Attach sync timestamp
    payload.synced_at = new Date().toISOString();

    if (kv) {
      await kv.put(KV_KEY, JSON.stringify(payload));
    }

    return new Response(JSON.stringify({
      success: true,
      message: "Marketing performance data synced successfully",
      synced_at: payload.synced_at
    }), {
      status: 200,
      headers: CORS_HEADERS
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: CORS_HEADERS
    });
  }
}
