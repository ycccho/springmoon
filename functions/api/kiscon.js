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

  try {
    const url = new URL('https://apis.data.go.kr/1613000/ConAdminInfoSvc1/GongsiReg');
    url.searchParams.set('ServiceKey', decodeURIComponent(serviceKey));
    url.searchParams.set('pageNo', pageNo);
    url.searchParams.set('numOfRows', numOfRows);
    if (sDate) url.searchParams.set('sDate', sDate);
    if (eDate) url.searchParams.set('eDate', eDate);
    url.searchParams.set('_type', 'json');
    if (ncrAreaName) url.searchParams.set('ncrAreaName', ncrAreaName);
    if (ncrAreaDetailName) url.searchParams.set('ncrAreaDetailName', ncrAreaDetailName);

    const res = await fetch(url.toString(), {
      headers: { 'Accept': 'application/json' }
    });
    const responseText = await res.text();
    const responseStatus = res.status;
    const responseContentType = res.headers.get('Content-Type') || 'application/json; charset=utf-8';

    const responseHeaders = new Headers();
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Content-Type', responseContentType);

    return new Response(responseText, {
      status: responseStatus,
      headers: responseHeaders
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
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
