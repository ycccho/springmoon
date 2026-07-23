export async function onRequestGet(context) {
  const { searchParams } = new URL(context.request.url);
  const ncrAreaName = searchParams.get('ncrAreaName') || '';
  const ncrAreaDetailName = searchParams.get('ncrAreaDetailName') || '';
  const sDate = searchParams.get('sDate') || '';
  const eDate = searchParams.get('eDate') || '';
  const pageNo = searchParams.get('pageNo') || '1';
  const numOfRows = searchParams.get('numOfRows') || '1000';

  // Service key from screenshot
  const serviceKey = "428c65196c3196dc546f4075499a7a32f3a83f649a539553a437c8a0b45f1649";

  let responseText = '';
  let responseStatus = 200;
  let responseContentType = 'application/json; charset=utf-8';

  const tryFetch = async (urlStr) => {
    const res = await fetch(urlStr, {
      headers: { 'Accept': 'application/json' }
    });
    const text = await res.text();
    return { ok: res.ok, status: res.status, contentType: res.headers.get('Content-Type') || '', text };
  };

  try {
    // Try ConsAdminInfoSvc1 first
    const url1 = new URL('https://apis.data.go.kr/1613000/ConsAdminInfoSvc1/GongsiReg');
    url1.searchParams.set('ServiceKey', decodeURIComponent(serviceKey));
    url1.searchParams.set('pageNo', pageNo);
    url1.searchParams.set('numOfRows', numOfRows);
    if (sDate) url1.searchParams.set('sDate', sDate);
    if (eDate) url1.searchParams.set('eDate', eDate);
    url1.searchParams.set('_type', 'json');
    if (ncrAreaName) url1.searchParams.set('ncrAreaName', ncrAreaName);
    if (ncrAreaDetailName) url1.searchParams.set('ncrAreaDetailName', ncrAreaDetailName);

    let resData = await tryFetch(url1.toString());
    
    // If ConsAdminInfoSvc1 fails or returns invalid response, try ConAdminInfoSvc1
    if (!resData.ok || resData.text.includes('SERVICE ERROR') || resData.text.includes('LIMITED NUMBER OF SERVICE') || resData.text.includes('SERVICE_KEY_IS_NOT_REGISTERED_ERROR')) {
      const url2 = new URL('https://apis.data.go.kr/1613000/ConAdminInfoSvc1/GongsiReg');
      url2.searchParams.set('ServiceKey', decodeURIComponent(serviceKey));
      url2.searchParams.set('pageNo', pageNo);
      url2.searchParams.set('numOfRows', numOfRows);
      if (sDate) url2.searchParams.set('sDate', sDate);
      if (eDate) url2.searchParams.set('eDate', eDate);
      url2.searchParams.set('_type', 'json');
      if (ncrAreaName) url2.searchParams.set('ncrAreaName', ncrAreaName);
      if (ncrAreaDetailName) url2.searchParams.set('ncrAreaDetailName', ncrAreaDetailName);
      
      const resData2 = await tryFetch(url2.toString());
      if (resData2.ok) {
        resData = resData2;
      }
    }

    responseText = resData.text;
    responseStatus = resData.status;
    responseContentType = resData.contentType;

  } catch (err) {
    try {
      const url2 = new URL('https://apis.data.go.kr/1613000/ConAdminInfoSvc1/GongsiReg');
      url2.searchParams.set('ServiceKey', decodeURIComponent(serviceKey));
      url2.searchParams.set('pageNo', pageNo);
      url2.searchParams.set('numOfRows', numOfRows);
      if (sDate) url2.searchParams.set('sDate', sDate);
      if (eDate) url2.searchParams.set('eDate', eDate);
      url2.searchParams.set('_type', 'json');
      if (ncrAreaName) url2.searchParams.set('ncrAreaName', ncrAreaName);
      if (ncrAreaDetailName) url2.searchParams.set('ncrAreaDetailName', ncrAreaDetailName);
      
      const resData2 = await fetch(url2.toString());
      responseText = await resData2.text();
      responseStatus = resData2.status;
      responseContentType = resData2.headers.get('Content-Type') || '';
    } catch (err2) {
      return new Response(JSON.stringify({ error: err2.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }
  }

  const responseHeaders = new Headers();
  responseHeaders.set('Access-Control-Allow-Origin', '*');
  if (responseContentType) {
    responseHeaders.set('Content-Type', responseContentType);
  } else {
    responseHeaders.set('Content-Type', 'application/json; charset=utf-8');
  }

  return new Response(responseText, {
    status: responseStatus,
    headers: responseHeaders
  });
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    }
  });
}
