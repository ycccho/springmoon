export async function onRequestGet(context) {
  const kv = context.env.POWER_CONTENT_KV;
  if (!kv) {
    return new Response(JSON.stringify({ error: "POWER_CONTENT_KV binding not found" }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  }

  try {
    let dataStr = await kv.get("dashboard_menu_settings");
    if (!dataStr) {
      return new Response(JSON.stringify({ success: true, menus: [], categories: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }
    
    try {
      const parsed = JSON.parse(dataStr);
      if (parsed && Array.isArray(parsed.categories)) {
        if (!parsed.categories.some(c => c.id === "cat-rank")) {
          parsed.categories.unshift({ id: "cat-rank", name: "순위확인", collapsed: false });
        }
      }
      if (parsed && Array.isArray(parsed.menus)) {
        if (!parsed.menus.some(m => m.id === "place-rank-check")) {
          parsed.menus.unshift({ id: "place-rank-check", name: "플레이스순위체크", categoryId: "cat-rank", protected: true });
        } else {
          const pr = parsed.menus.find(m => m.id === "place-rank-check");
          if (pr) pr.categoryId = "cat-rank";
        }
      }
      dataStr = JSON.stringify(parsed);
    } catch(e){}
    return new Response(dataStr, {
      status: 200,
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
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
    const data = await context.request.json();
    
    if (!data || typeof data !== "object") {
      return new Response(JSON.stringify({ error: "Invalid payload: must be an object with menus and categories" }), {
        status: 400,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }

    await kv.put("dashboard_menu_settings", JSON.stringify(data));

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
}

export async function onRequestOptions(context) {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    }
  });
}
