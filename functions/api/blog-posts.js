export async function onRequestGet(context) {
  const { searchParams } = new URL(context.request.url);
  const blogId = searchParams.get('blogId');
  const countParam = searchParams.get('count') || '10';
  let targetCount = parseInt(countParam, 10);
  if (isNaN(targetCount) || targetCount < 1) {
    targetCount = 10;
  }
  targetCount = Math.min(targetCount, 100);

  if (!blogId) {
    return new Response(JSON.stringify({ success: false, error: 'blogId is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    // Helper function to fetch a specific page of blog post titles
    const fetchPage = async (page) => {
      const apiUrl = `https://blog.naver.com/PostTitleListAsync.naver?blogId=${encodeURIComponent(blogId)}&viewdate=&parentCategoryNo=&categoryNo=&itemcount=5&authorid=&userSelectMenu=&parentCategoryCode=&currentPage=${page}`;
      
      const response = await fetch(apiUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
          'Referer': `https://blog.naver.com/${encodeURIComponent(blogId)}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch page ${page}: ${response.status}`);
      }

      const rawText = await response.text();
      // Naver returns invalid JSON with escaped single quotes (\') in HTML elements.
      const cleanedText = rawText.replace(/\\'/g, "'");
      return JSON.parse(cleanedText);
    };

    // 1. Fetch first page to find the post count per page and total counts
    const firstPageData = await fetchPage(1);
    if (firstPageData.resultCode !== 'S' || !firstPageData.postList) {
      return new Response(JSON.stringify({ success: false, error: firstPageData.resultMessage || 'Failed to fetch blog posts from Naver' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    let posts = [...firstPageData.postList];
    const totalCount = parseInt(firstPageData.totalCount, 10) || 0;
    const countPerPage = parseInt(firstPageData.countPerPage, 10) || 5;

    // 2. Fetch subsequent pages in parallel if we need more than page 1 returned
    const remainingNeeded = Math.min(targetCount, totalCount) - posts.length;
    if (remainingNeeded > 0 && countPerPage > 0) {
      const pagesNeeded = Math.ceil(remainingNeeded / countPerPage);
      const fetchPromises = [];
      for (let p = 2; p <= 1 + pagesNeeded; p++) {
        fetchPromises.push(fetchPage(p));
      }

      const pagesData = await Promise.all(fetchPromises);
      pagesData.forEach(pageData => {
        if (pageData.resultCode === 'S' && pageData.postList) {
          posts = posts.concat(pageData.postList);
        }
      });
    }

    // Slice to target count
    posts = posts.slice(0, targetCount);

    const decodeNaverTitle = (title) => {
      try {
        return decodeURIComponent(title.replace(/\+/g, '%20'));
      } catch (e) {
        return title;
      }
    };

    const formattedPosts = posts.map(post => {
      const decodedTitle = decodeNaverTitle(post.title);
      const link = `https://blog.naver.com/${blogId}/${post.logNo}`;
      
      // format date (e.g. "2026. 6. 23." -> "2026.06.23")
      let rawDate = post.addDate || '';
      let pubDate = rawDate;
      const parts = rawDate.replace(/\s/g, '').split('.');
      if (parts.length >= 3) {
        const y = parts[0];
        const m = String(parts[1]).padStart(2, '0');
        const d = String(parts[2]).padStart(2, '0');
        pubDate = `${y}.${m}.${d}`;
      }

      return {
        logNo: post.logNo,
        title: decodedTitle,
        link: link,
        pubDate: pubDate
      };
    });

    return new Response(JSON.stringify({ success: true, posts: formattedPosts }), {
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
