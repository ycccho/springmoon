// Cloudflare Pages Function: functions/api/site.js
// Handles GET /api/site?code=g-1 and POST /api/site for global cloud synchronization

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const code = url.searchParams.get("code") || "g-1";

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (request.method === "GET") {
      if (env.EDAM_SITE_KV) {
        const value = await env.EDAM_SITE_KV.get(`site_${code}`);
        if (value) {
          return new Response(value, {
            headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        }
      }
      return new Response(JSON.stringify({ status: "not_found" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    if (request.method === "POST") {
      const payload = await request.json();
      const siteCode = payload.code || code;
      const dataStr = JSON.stringify(payload.data);

      if (env.EDAM_SITE_KV) {
        await env.EDAM_SITE_KV.put(`site_${siteCode}`, dataStr);
      }

      return new Response(JSON.stringify({ success: true, code: siteCode }), {
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
}
