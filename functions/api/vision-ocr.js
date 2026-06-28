export async function onRequestPost(context) {
  let apiKey = context.env.GOOGLE_VISION_API_KEY;
  if (!apiKey) {
    // Fallback to the user's provided API key
    apiKey = "AIzaSyA8IWoPG8vHeVQISBiI9i4-csuluwsV_no";
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
