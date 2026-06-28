export async function onRequestGet(context) {
  const kv = context.env.POWER_CONTENT_KV;
  const { searchParams } = new URL(context.request.url);
  const action = searchParams.get('action') || 'info';

  if (action === 'update-cron') {
    return await handleCronUpdate(kv);
  }

  // Action: info (default)
  const blogId = searchParams.get('blogId');
  if (!blogId) {
    return new Response(JSON.stringify({ success: false, error: 'blogId is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    // 1. Fetch Blog Profile Info (Mobile Page)
    const mobileUrl = `https://m.blog.naver.com/${encodeURIComponent(blogId)}`;
    const mobileResponse = await fetch(mobileUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Mobile Safari/537.36',
        'Referer': 'https://m.blog.naver.com/'
      }
    });

    if (!mobileResponse.ok) {
      throw new Error(`Failed to fetch mobile profile. Status: ${mobileResponse.status}`);
    }

    const htmlContent = await mobileResponse.text();
    
    // Parse INITIAL_STATE JSON
    const stateMatch = htmlContent.match(/window\.__INITIAL_STATE__\s*=\s*(\{.*?\});/s) || htmlContent.match(/window\.__INITIAL_STATE__\s*=\s*(\{.*)/s);
    if (!stateMatch) {
      throw new Error("Could not parse blog data structure (INITIAL_STATE not found).");
    }

    let jsonStr = stateMatch[1].trim();
    if (jsonStr.endsWith(';')) {
      jsonStr = jsonStr.slice(0, -1);
    }
    
    // Safety JSON clean up
    const stateData = JSON.parse(jsonStr);
    const blogHome = stateData.blogHome || {};
    const blogHomeInfo = blogHome.blogHomeInfo || {};
    
    // Extract actual dynamic blog key (usually same as blogId but can vary in case)
    const matchedKey = Object.keys(blogHomeInfo)[0];
    if (!matchedKey) {
      throw new Error("Blog profile info not found.");
    }
    
    const profileData = blogHomeInfo[matchedKey].data || {};
    const contentsCount = (blogHome.blogContentsCount && blogHome.blogContentsCount[matchedKey]) ? blogHome.blogContentsCount[matchedKey].data : {};
    
    const blogInfo = {
      blogId: blogId,
      blogName: profileData.blogName || '',
      nickName: profileData.nickName || '',
      displayNickName: profileData.displayNickName || '',
      profileImage: profileData.profileImagePath || '',
      todayVisitors: parseInt(profileData.dayVisitorCount, 10) || 0,
      totalVisitors: parseInt(profileData.totalVisitorCount, 10) || 0,
      subscribers: parseInt(profileData.subscriberCount, 10) || 0,
      blogCategory: profileData.blogDirectoryName || '',
      totalPosts: parseInt(contentsCount.postCount, 10) || 0
    };

    // 2. Fetch Blog Creation Date (PC History Page)
    let creationDate = '알 수 없음';
    try {
      const historyUrl = `https://blog.naver.com/profile/history.naver?blogId=${encodeURIComponent(blogId)}`;
      const historyResponse = await fetch(historyUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
          'Referer': `https://blog.naver.com/${encodeURIComponent(blogId)}`
        }
      });

      if (historyResponse.ok) {
        const arrayBuffer = await historyResponse.arrayBuffer();
        const decoder = new TextDecoder('euc-kr');
        const historyHtml = decoder.decode(arrayBuffer);
        
        // Find all dates in YYYY.MM.DD format
        const dates = historyHtml.match(/\b\d{4}\.\d{2}\.\d{2}\b/g) || [];
        if (dates.length > 0) {
          // Sort to find the oldest date
          const sortedDates = dates.map(d => d.replace(/\./g, '-')).sort();
          creationDate = sortedDates[0].replace(/-/g, '.');
        }
      }
    } catch (e) {
      console.error("Failed to fetch blog creation date history:", e);
    }
    blogInfo.creationDate = creationDate;

    // 3. Save to KV and record visitor history
    let visitorHistory = {};
    if (kv) {
      // 3.1 Register blogId to registered list
      let blogList = [];
      const listStr = await kv.get("blog:list");
      if (listStr) {
        try {
          blogList = JSON.parse(listStr);
        } catch (_) {}
      }
      if (!blogList.includes(blogId)) {
        blogList.push(blogId);
        await kv.put("blog:list", JSON.stringify(blogList));
      }

      // 3.2 Update visitor history for today
      const historyKey = `blog:history:${blogId}`;
      const historyStr = await kv.get(historyKey);
      if (historyStr) {
        try {
          visitorHistory = JSON.parse(historyStr);
        } catch (_) {}
      }

      // Get KST date string (YYYY-MM-DD)
      const kstDate = new Date(Date.now() + (9 * 60 * 60 * 1000));
      const todayStr = kstDate.toISOString().split('T')[0];
      
      // Update today's visitor count (only update if it's larger or not set yet for today)
      const currentTodayVal = visitorHistory[todayStr] || 0;
      if (blogInfo.todayVisitors > currentTodayVal) {
        visitorHistory[todayStr] = blogInfo.todayVisitors;
        await kv.put(historyKey, JSON.stringify(visitorHistory));
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      info: blogInfo,
      history: visitorHistory 
    }), {
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

// Cron handler to update daily visitor counts
async function handleCronUpdate(kv) {
  if (!kv) {
    return new Response(JSON.stringify({ success: false, error: 'KV database is not configured.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const listStr = await kv.get("blog:list");
    if (!listStr) {
      return new Response(JSON.stringify({ success: true, message: 'No registered blogs to update.' }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const blogList = JSON.parse(listStr);
    const results = [];

    // Get KST date string (YYYY-MM-DD)
    const kstDate = new Date(Date.now() + (9 * 60 * 60 * 1000));
    const todayStr = kstDate.toISOString().split('T')[0];

    // Process in sequential order to avoid heavy spikes on Naver
    for (const blogId of blogList) {
      try {
        const mobileUrl = `https://m.blog.naver.com/${encodeURIComponent(blogId)}`;
        const res = await fetch(mobileUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Mobile Safari/537.36',
            'Referer': 'https://m.blog.naver.com/'
          }
        });

        if (!res.ok) continue;
        const htmlContent = await res.text();
        const stateMatch = htmlContent.match(/window\.__INITIAL_STATE__\s*=\s*(\{.*?\});/s) || htmlContent.match(/window\.__INITIAL_STATE__\s*=\s*(\{.*)/s);
        if (!stateMatch) continue;

        let jsonStr = stateMatch[1].trim();
        if (jsonStr.endsWith(';')) jsonStr = jsonStr.slice(0, -1);
        
        const stateData = JSON.parse(jsonStr);
        const blogHome = stateData.blogHome || {};
        const blogHomeInfo = blogHome.blogHomeInfo || {};
        const matchedKey = Object.keys(blogHomeInfo)[0];
        if (!matchedKey) continue;

        const profileData = blogHomeInfo[matchedKey].data || {};
        const todayVisitors = parseInt(profileData.dayVisitorCount, 10) || 0;

        // Update KV history
        const historyKey = `blog:history:${blogId}`;
        let visitorHistory = {};
        const historyStr = await kv.get(historyKey);
        if (historyStr) {
          try {
            visitorHistory = JSON.parse(historyStr);
          } catch (_) {}
        }
        
        visitorHistory[todayStr] = todayVisitors;
        await kv.put(historyKey, JSON.stringify(visitorHistory));

        results.push({ blogId, status: 'success', visitors: todayVisitors });
        
        // Brief sleep to be nice to Naver
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (err) {
        results.push({ blogId, status: 'error', error: err.message });
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Cron update complete', 
      date: todayStr,
      results 
    }), {
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
