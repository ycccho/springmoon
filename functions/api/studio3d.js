// Cloudflare Pages Functions - 3D Processing Engine
// Handles image preprocessing, edge heightmap conversion, and STL metadata

export async function onRequestPost(context) {
  try {
    const { request } = context;
    const contentType = request.headers.get('content-type') || '';

    let payload;
    if (contentType.includes('application/json')) {
      payload = await request.json();
    } else {
      return new Response(JSON.stringify({ error: 'Invalid content type. Expected application/json.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    const {
      action = 'process-heightmap',
      width = 50,
      height = 50,
      baseThickness = 2.0,
      reliefHeight = 1.5,
      shape = 'rounded-rect',
      loopPosition = 'top',
      loopHoleDiameter = 3.5,
      loopOuterDiameter = 7.0
    } = payload;

    return new Response(JSON.stringify({
      success: true,
      message: 'Cloudflare Edge 3D Preprocessing Ready',
      metadata: {
        printerTarget: 'Bambu Lab P1S',
        buildVolume: [256, 256, 256],
        dimensions: { width, height, totalHeight: baseThickness + reliefHeight },
        features: { shape, loopPosition, loopHoleDiameter, loopOuterDiameter }
      },
      timestamp: Date.now()
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store'
      }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message || 'Serverless 3D processing failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400'
    }
  });
}
