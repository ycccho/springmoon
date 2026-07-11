import { backupStats } from './place_stats_backup.js';

export async function onRequestGet(context) {
  const kv = context.env.POWER_CONTENT_KV;
  
  const { searchParams } = new URL(context.request.url);
  const placeId = searchParams.get('placeId');
  
  if (!placeId) {
    return new Response(JSON.stringify({ error: "placeId parameter is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  }

  const key = `place:stats:v2:${placeId}`;
  let dataStr = null;
  if (kv) {
    try {
      dataStr = await kv.get(key);
    } catch (_) {}
  }
  
  let placeData = { placeId, history: {} };
  if (dataStr) {
    try {
      placeData = JSON.parse(dataStr);
    } catch (_) {}
  }

  // Merge with static CDN backup stats if KV is empty or missing days
  const backup = backupStats[placeId] || {};
  let merged = false;
  for (const dateStr in backup) {
    if (!placeData.history[dateStr] || placeData.history[dateStr].inflows === 0) {
      placeData.history[dateStr] = backup[dateStr];
      merged = true;
    }
  }

  return new Response(JSON.stringify(placeData), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
    }
  });
}

export async function onRequestPost(context) {
  const kv = context.env.POWER_CONTENT_KV;
  if (!kv) {
    return new Response(JSON.stringify({ error: "POWER_CONTENT_KV binding not found" }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  }

  try {
    const body = await context.request.json();
    const { placeId, dateStr, stats, bulkHistory } = body;

    if (!placeId || (!dateStr && !bulkHistory)) {
      return new Response(JSON.stringify({ error: "placeId, along with dateStr or bulkHistory are required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }

    const key = `place:stats:v2:${placeId}`;
    const existingStr = await kv.get(key);
    let placeData = { placeId, history: {} };

    if (existingStr) {
      try {
        placeData = JSON.parse(existingStr);
      } catch (_) {}
    }

    if (bulkHistory) {
      // Bulk merge
      for (const d in bulkHistory) {
        placeData.history[d] = bulkHistory[d];
      }
    } else {
      // Single day update
      placeData.history[dateStr] = stats;
    }

    await kv.put(key, JSON.stringify(placeData));

    return new Response(JSON.stringify({ success: true, message: "Stats successfully saved." }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  }
}

export async function onRequestOptions(context) {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400"
    }
  });
}
