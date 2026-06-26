export async function onRequestGet(context) {
  const { searchParams } = new URL(context.request.url);
  const blogId = searchParams.get('blogId');

  if (!blogId) {
    return new Response(JSON.stringify({ success: false, error: 'blogId is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const rssUrl = `https://rss.blog.naver.com/${encodeURIComponent(blogId)}`;
    const response = await fetch(rssUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
      }
    });

    if (!response.ok) {
      return new Response(JSON.stringify({ success: false, error: `Failed to fetch RSS feed: ${response.status}` }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const xml = await response.text();
    const posts = [];

    // Parse <item> elements
    const itemMatches = xml.matchAll(/<item>([\s\S]*?)<\/item>/g);
    for (const match of itemMatches) {
      const itemContent = match[1];

      // Extract title, link, pubDate
      const titleMatch = itemContent.match(/<title>(?:<!\[CDATA\[([\s\S]*?)\]\]>|([\s\S]*?))<\/title>/);
      const linkMatch = itemContent.match(/<link>(?:<!\[CDATA\[([\s\S]*?)\]\]>|([\s\S]*?))<\/link>/);
      const pubDateMatch = itemContent.match(/<pubDate>(?:<!\[CDATA\[([\s\S]*?)\]\]>|([\s\S]*?))<\/pubDate>/);

      const titleRaw = titleMatch ? (titleMatch[1] || titleMatch[2] || '') : '';
      const linkRaw = linkMatch ? (linkMatch[1] || linkMatch[2] || '') : '';
      const pubDateRaw = pubDateMatch ? (pubDateMatch[1] || pubDateMatch[2] || '') : '';

      // Helper function to decode XML entities
      const decodeEntities = (str) => {
        return str
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&apos;/g, "'")
          .trim();
      };

      const title = decodeEntities(titleRaw);
      const link = decodeEntities(linkRaw);
      
      // Parse publish date to display nicely (e.g., Sat, 27 Jun 2026 00:13:56 +0900 -> 2026.06.27)
      let pubDate = pubDateRaw.trim();
      try {
        const d = new Date(pubDate);
        if (!isNaN(d.getTime())) {
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, '0');
          const date = String(d.getDate()).padStart(2, '0');
          pubDate = `${y}.${m}.${date}`;
        }
      } catch (e) {
        // use raw date if parsing fails
      }

      if (title && link) {
        posts.push({ title, link, pubDate });
      }

      if (posts.length >= 10) {
        break;
      }
    }

    return new Response(JSON.stringify({ success: true, posts }), {
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
