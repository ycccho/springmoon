export async function onRequestGet(context) {
  const kv = context.env.POWER_CONTENT_KV;
  if (!kv) {
    return new Response(JSON.stringify({ error: "POWER_CONTENT_KV binding not found" }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  }

  const { searchParams } = new URL(context.request.url);
  const placeId = searchParams.get('placeId');
  
  if (!placeId) {
    return new Response(JSON.stringify({ error: "placeId parameter is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  }

  const key = `place:stats:v2:${placeId}`;
  const dataStr = await kv.get(key);
  
  return new Response(dataStr || JSON.stringify({ placeId, history: {} }), {
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
