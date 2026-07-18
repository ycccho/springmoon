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

  const key = "gfa:stats:v1";
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

  // Filter and aggregate GFA stats by date range
  let clicks = 0;
  let impressions = 0;
  let spend = 0;
  const campaignAggregation = {};

  const start = new Date(startDate + "T00:00:00Z");
  const end = new Date(endDate + "T00:00:00Z");

  for (const dateKey in cacheData.history) {
    const curDate = new Date(dateKey + "T00:00:00Z");
    if (curDate >= start && curDate <= end) {
      const dayStats = cacheData.history[dateKey] || {};
      clicks += dayStats.clicks || 0;
      impressions += dayStats.impressions || 0;
      spend += dayStats.spend || 0;

      const campaigns = dayStats.activeCampaigns || [];
      campaigns.forEach(c => {
        if (!campaignAggregation[c.name]) {
          campaignAggregation[c.name] = {
            name: c.name,
            clicks: 0,
            impressions: 0,
            ctr: 0,
            cpc: 0,
            spend: 0
          };
        }
        campaignAggregation[c.name].clicks += c.clicks || 0;
        campaignAggregation[c.name].impressions += c.impressions || 0;
        campaignAggregation[c.name].spend += c.spend || 0;
      });
    }
  }

  const activeCampaigns = Object.values(campaignAggregation).map(c => {
    c.ctr = c.impressions > 0 ? parseFloat(((c.clicks / c.impressions) * 100).toFixed(2)) : 0;
    c.cpc = c.clicks > 0 ? Math.round(c.spend / c.clicks) : 0;
    return c;
  });

  const cpr = clicks > 0 ? Math.round(spend / clicks) : 0;

  return new Response(JSON.stringify({
    success: true,
    campaignStats: { clicks, impressions, spend, cpr },
    activeCampaigns
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

    const key = "gfa:stats:v1";
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
