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

  const key = "google-sa:stats:v1";
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

  // Filter and aggregate search terms stats by date range
  const termAggregation = {};
  const dailyHistory = [];
  const start = new Date(startDate + "T00:00:00Z");
  const end = new Date(endDate + "T00:00:00Z");

  for (const dateKey in cacheData.history) {
    const curDate = new Date(dateKey + "T00:00:00Z");
    if (curDate >= start && curDate <= end) {
      const dayStats = cacheData.history[dateKey] || {};
      const terms = dayStats.searchTerms || [];
      let dayClicks = 0;
      let dayImps = 0;
      let daySpend = 0;

      terms.forEach(t => {
        const uniqueKey = `${t.term}_${t.type}`;
        if (!termAggregation[uniqueKey]) {
          termAggregation[uniqueKey] = {
            term: t.term,
            type: t.type,
            clicks: 0,
            impressions: 0,
            ctr: 0,
            avgCpc: 0,
            totalSpend: 0,
            keyword: t.keyword || t.term
          };
        }
        const clicksVal = t.clicks || 0;
        const impsVal = t.impressions || 0;
        const spendVal = clicksVal * (t.avgCpc || 0);

        termAggregation[uniqueKey].clicks += clicksVal;
        termAggregation[uniqueKey].impressions += impsVal;
        termAggregation[uniqueKey].totalSpend += spendVal;

        dayClicks += clicksVal;
        dayImps += impsVal;
        daySpend += spendVal;
      });

      dailyHistory.push({
        date: dateKey,
        clicks: dayClicks,
        impressions: dayImps,
        spend: Math.round(daySpend)
      });
    }
  }

  dailyHistory.sort((a, b) => a.date.localeCompare(b.date));

  const searchTerms = Object.values(termAggregation).map(t => {
    t.ctr = t.impressions > 0 ? parseFloat(((t.clicks / t.impressions) * 100).toFixed(2)) : 0;
    t.avgCpc = t.clicks > 0 ? Math.round(t.totalSpend / t.clicks) : 0;
    delete t.totalSpend;
    return t;
  });

  return new Response(JSON.stringify({
    success: true,
    searchTerms,
    dailyHistory
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

    const key = "google-sa:stats:v1";
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
