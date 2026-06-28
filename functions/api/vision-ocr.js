export async function onRequestPost(context) {
  const apiKey = context.env.GOOGLE_VISION_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ success: false, error: 'Google Vision API Key is not configured on the server.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const body = await context.request.json();
    const { image } = body;
    if (!image) {
      return new Response(JSON.stringify({ success: false, error: 'Image data is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Call Google Cloud Vision API
    const googleUrl = `https://vision.googleapis.com/v1/images:annotate?key=${encodeURIComponent(apiKey)}`;
    const googleResponse = await fetch(googleUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        requests: [
          {
            image: {
              content: image
            },
            features: [
              {
                type: 'DOCUMENT_TEXT_DETECTION'
              }
            ]
          }
        ]
      })
    });

    if (!googleResponse.ok) {
      const errText = await googleResponse.text();
      throw new Error(`Google API error: ${googleResponse.status} - ${errText}`);
    }

    const data = await googleResponse.json();
    return new Response(JSON.stringify({ success: true, data }), {
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
