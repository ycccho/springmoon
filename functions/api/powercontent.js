export async function onRequestGet(context) {
  const kv = context.env.POWER_CONTENT_KV;
  if (!kv) {
    return new Response(JSON.stringify({ error: "POWER_CONTENT_KV binding not found" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }

  const url = new URL(context.request.url);
  const category = url.searchParams.get("category");

  try {
    if (!category) {
      // Return list of categories and total count
      const categoriesStr = await kv.get("categories");
      const categories = categoriesStr ? JSON.parse(categoriesStr) : [];
      const totalCountStr = await kv.get("totalKeywordsCount");
      const totalKeywordsCount = totalCountStr ? parseInt(totalCountStr, 10) : 0;
      
      return new Response(JSON.stringify({ categories, totalKeywordsCount }), {
        status: 200,
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    } else {
      // Return keywords for a specific category
      const keywordsStr = await kv.get(`category:${category}`);
      const keywords = keywordsStr ? JSON.parse(keywordsStr) : [];
      return new Response(JSON.stringify({ keywords }), {
        status: 200,
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }
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
      headers: { "Content-Type": "application/json" }
    });
  }

  try {
    const { categories, grouped, totalKeywordsCount } = await context.request.json();
    if (!categories || !grouped) {
      return new Response(JSON.stringify({ error: "Invalid payload: categories and grouped fields are required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Save the global categories list and total keywords count
    await kv.put("categories", JSON.stringify(categories));
    if (totalKeywordsCount !== undefined) {
      await kv.put("totalKeywordsCount", String(totalKeywordsCount));
    }

    // Save keyword lists for each category concurrently
    const writePromises = categories.map(cat => {
      const keywords = grouped[cat] || [];
      return kv.put(`category:${cat}`, JSON.stringify(keywords));
    });

    await Promise.all(writePromises);

    return new Response(JSON.stringify({ success: true, count: categories.length }), {
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
