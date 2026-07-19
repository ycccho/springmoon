export async function onRequestGet(context) {
  const kv = context.env.POWER_CONTENT_KV;
  const { searchParams } = new URL(context.request.url);
  const startDate = searchParams.get('startDate') || searchParams.get('start');
  const endDate = searchParams.get('endDate') || searchParams.get('end');

  if (!startDate || !endDate) {
    return new Response(JSON.stringify({ error: "startDate and endDate parameters are required" }), {
      status: 400,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  }

  const key = "naver-sa:stats:v1";
  let dataStr = null;
  if (kv) {
    try {
      dataStr = await kv.get(key);
    } catch (_) {}
  }

  let cacheData = { history: {} };
  if (dataStr) {
    try {
      cacheData = JSON.parse(dataStr);
    } catch (_) {}
  }

  // Support raw parameter to get the full cache history
  const raw = searchParams.get('raw');
  if (raw === 'true') {
    return new Response(JSON.stringify(cacheData), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
      }
    });
  }

  // Filter and aggregate stats by date range
  const totals = {
    pc: { clicks: 0, spend: 0, impressions: 0 },
    mobile: { clicks: 0, spend: 0, impressions: 0 },
    place: { clicks: 0, spend: 0, impressions: 0 }
  };

  const start = new Date(startDate + "T00:00:00Z");
  const end = new Date(endDate + "T00:00:00Z");

  for (const dateKey in cacheData.history) {
    const curDate = new Date(dateKey + "T00:00:00Z");
    if (curDate >= start && curDate <= end) {
      const dayStats = cacheData.history[dateKey] || {};
      
      const pc = dayStats.pc || {};
      totals.pc.clicks += pc.clicks || 0;
      totals.pc.spend += pc.spend || 0;
      totals.pc.impressions += pc.impressions || 0;

      const mobile = dayStats.mobile || {};
      totals.mobile.clicks += mobile.clicks || 0;
      totals.mobile.spend += mobile.spend || 0;
      totals.mobile.impressions += mobile.impressions || 0;

      const place = dayStats.place || {};
      totals.place.clicks += place.clicks || 0;
      totals.place.spend += place.spend || 0;
      totals.place.impressions += place.impressions || 0;
    }
  }

  return new Response(JSON.stringify({
    success: true,
    totals
  }), {
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
    const { dateStr, stats, bulkHistory } = body;

    const key = "naver-sa:stats:v1";
    const existingStr = await kv.get(key);
    let cacheData = { history: {} };

    if (existingStr) {
      try {
        cacheData = JSON.parse(existingStr);
      } catch (_) {}
    }

    if (bulkHistory) {
      for (const d in bulkHistory) {
        cacheData.history[d] = bulkHistory[d];
      }
    } else if (dateStr && stats) {
      cacheData.history[dateStr] = stats;
    }

    await kv.put(key, JSON.stringify(cacheData));

    return new Response(JSON.stringify({ success: true, message: "Stats successfully saved to KV." }), {
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
