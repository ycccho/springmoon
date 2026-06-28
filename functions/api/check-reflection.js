export async function onRequestGet(context) {
  const { searchParams } = new URL(context.request.url);
  const blogId = searchParams.get('blogId');
  const logNosParam = searchParams.get('logNos'); // Comma-separated list of logNos (up to 10)
  const title = searchParams.get('title'); // Keep title fallback support for backward compatibility

  if (!blogId) {
    return new Response(JSON.stringify({ success: false, error: 'blogId is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    let query = '';
    let logNos = [];

    if (logNosParam) {
      logNos = logNosParam.split(',').map(s => s.trim()).filter(Boolean);
    }

    if (logNos.length > 0) {
      // Parallel fetches for accurate Naver indexing check
      const results = {};
      const fetchPromises = logNos.map(async (logNo) => {
        const query = `blog.naver.com/${blogId}/${logNo}`;
        const searchUrl = `https://search.naver.com/search.naver?ssc=tab.blog.all&query=${encodeURIComponent(query)}`;
        
        try {
          const response = await fetch(searchUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
              'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
              'Referer': 'https://search.naver.com/'
            }
          });

          if (!response.ok) {
            results[logNo] = false;
            return;
          }

          const html = await response.text();
          const normalizedHtml = html.toLowerCase();
          const target1 = `blog.naver.com/${blogId.toLowerCase()}/${logNo}`;
          const target2 = `logno=${logNo}`;
          
          results[logNo] = normalizedHtml.includes(target1) || normalizedHtml.includes(target2);
        } catch (e) {
          results[logNo] = false;
        }
      });

      await Promise.all(fetchPromises);

      return new Response(JSON.stringify({ success: true, results }), {
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-cache'
        }
      });
    } else if (title) {
      // Title mode (fallback)
      const query = `"${title}"`;
      const searchUrl = `https://search.naver.com/search.naver?ssc=tab.blog.all&query=${encodeURIComponent(query)}`;
      const response = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
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
      const normalizedHtml = html.toLowerCase();
      const target1 = 'blog.naver.com/' + blogId.toLowerCase();
      const target2 = 'blogid=' + blogId.toLowerCase();
      const reflected = normalizedHtml.includes(target1) || normalizedHtml.includes(target2);

      return new Response(JSON.stringify({ success: true, reflected, query }), {
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    } else {
      return new Response(JSON.stringify({ success: false, error: 'Either logNos or title is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
