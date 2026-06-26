export async function onRequestGet(context) {
  const { searchParams } = new URL(context.request.url);
  const blogId = searchParams.get('blogId');
  const title = searchParams.get('title');

  if (!blogId || !title) {
    return new Response(JSON.stringify({ success: false, error: 'blogId and title are required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const query = `"${title}"`;
    const searchUrl = `https://search.naver.com/search.naver?ssc=tab.blog.all&sm=tab_jum&query=${encodeURIComponent(query)}`;
    
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
        'Referer': 'https://search.naver.com/'
      }
    });

    if (!response.ok) {
      return new Response(JSON.stringify({ success: false, error: `Failed to search Naver: ${response.status}` }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const html = await response.text();

    // Check if main_pack is present to limit search area
    let searchArea = html;
    const mainPackMatch = html.match(/<div[^>]*id="main_pack"[^>]*>([\s\S]*?)<\/div>\s*<!--\s*\/\s*main_pack\s*-->/);
    if (mainPackMatch) {
      searchArea = mainPackMatch[1];
    } else {
      // Fallback search area extractor
      const mainPackStart = html.indexOf('id="main_pack"');
      if (mainPackStart !== -1) {
        searchArea = html.substring(mainPackStart, mainPackStart + 150000); // Take a large chunk of content
      }
    }

    // Check if blogId appears in search results
    const normalizedHtml = searchArea.toLowerCase();
    const target1 = 'blog.naver.com/' + blogId.toLowerCase();
    const target2 = 'blogid=' + blogId.toLowerCase();
    
    const reflected = normalizedHtml.includes(target1) || normalizedHtml.includes(target2);

    return new Response(JSON.stringify({ success: true, reflected, query }), {
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
