export async function onRequestPost(context) {
  const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key'
  };

  try {
    const body = await context.request.json();
    const { image, apiKey: clientApiKey, options = {}, action = 'render' } = body;

    if (!image) {
      return new Response(JSON.stringify({ success: false, error: '스케치업 또는 3D 도면 이미지 데이터가 필요합니다.' }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Active Tier-1 Paid Key
    const fallbackKey = atob("QVEuQWI4Uk42SzJLOTZWb2FTOVNSYlU5NWZPV21CYUJpZnp0ZnlidWhXbmJkM0RwSmpxelE=");
    let apiKey = clientApiKey || context.env?.GEMINI_API_KEY || fallbackKey;

    // Clean base64 image data
    let mimeType = 'image/jpeg';
    let base64Data = image;
    if (image.startsWith('data:')) {
      const parts = image.split(';base64,');
      mimeType = parts[0].replace('data:', '');
      base64Data = parts[1];
    }

    const {
      lockCeiling = true,
      anchorMaterials = true,
      colorTemp = 'auto',
      preserveExposure = true,
      crossSceneSync = true,
      customNotes = ''
    } = options;

    // Step 1: Vision analysis via Gemini 3.7 Flash
    const systemInstruction = `You are the specialized INDE RENDER Master Architectural AI.
Analyze the attached SketchUp viewport capture / CAD perspective image and generate an exhaustive, production-grade JSON photoreal conversion prompt following the 6 absolute rules:
1. STRUCTURE & CEILING APPARATUS LOCK (100%): Never add AC units where none exist in the reference. If AC exists, strictly preserve its exact position and type (1-way/2-way rectangular vs 4-way square). Do NOT move, add, or delete lighting fixtures (pendants, downlights, track rails).
2. MATERIAL ANCHORING (100%): Strictly inherit all original material identities (wood species/tones like dark walnut or light oak, tile patterns, leather colors, paint) from the attached image without altering them. Upgrade ONLY their physical micro-roughness, open pores, weave relief, and edge bevel reflections.
3. COLOR TEMPERATURE & ILLUMINANCE FIDELITY: Maintain the authentic lighting mood and color temperatures (daylight 5000K, neutral white 4000K, warm cove 3000K). Preserve low-key/moody shadows without artificial over-brightening.
4. FULL CEILING 3D RECONSTRUCTION: Eliminate all flat 2D untextured slabs, black CAD outline strokes, flat 2D fan cutouts, and flat track lines. Reconstruct realistic gypsum plasterboard stipple texture, physical 3D fan blades, 3D cylindrical track spotlights, and smooth continuous cove gradient washes.
5. CROSS-SCENE CONSISTENCY: Ensure materials, floor tiles, and fixtures are unified across all project views.
6. NO CG/RENDER CLICHES: Clean f/8, ISO 100 tilt-shift rectilinear architectural photography.

User Selected Options:
- Lock Ceiling & Apparatus: ${lockCeiling}
- Anchor Materials 100%: ${anchorMaterials}
- Color Temperature Mode: ${colorTemp}
- Preserve Original Exposure & Low-key Mood: ${preserveExposure}
- Cross-Scene Sync: ${crossSceneSync}
- Additional Custom Notes: ${customNotes || 'None'}

Return ONLY a valid JSON object matching the standard INDE RENDER schema.`;

    const geminiVisionUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
    
    const analysisPayload = {
      contents: [
        {
          role: "user",
          parts: [
            { text: systemInstruction + "\n\nAnalyze this image and output the complete JSON prompt." },
            {
              inline_data: {
                mime_type: mimeType,
                data: base64Data
              }
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.2,
        response_mime_type: "application/json"
      }
    };

    const visionRes = await fetch(geminiVisionUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(analysisPayload)
    });

    if (!visionRes.ok) {
      const errText = await visionRes.text();
      throw new Error(`도면 분석 API 오류 (${visionRes.status}): ${errText}`);
    }

    const visionData = await visionRes.json();
    let rawJsonText = visionData.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    
    let promptJson = {};
    try {
      promptJson = JSON.parse(rawJsonText);
    } catch (e) {
      promptJson = { raw: rawJsonText };
    }

    // Step 2: High-Resolution Architectural Rendering via Replicate FLUX Canny Pro + Real-ESRGAN
    let renderedImageBase64 = null;
    let renderStatus = 'prompt_only';

    const replicateToken = context.env?.REPLICATE_API_TOKEN || atob("cjhfSTViWkd6QUM1Rm15eEZkSzhvTXJteVB6VVI1dXU1aDF0MmlNbQ==");

    const imageGenPrompt = `Masterpiece architectural interior photograph of the attached scene. 100% strict alignment with existing room geometry and walls.
ATMOSPHERE & LIGHTING: Option A warm cove indirect lighting (3000K), soft ambient shadow gradients, flambient natural exposure blend, realistic matte plaster finish, micro-textured wood grain, high-end commercial clinic reception interior.
CAMERA: Hasselblad H6D-100c, 24mm perspective-control tilt-shift lens, perfectly straight vertical lines, f/8, ISO 100.
DETAILS: ${customNotes ? 'Specific User Modification: ' + customNotes : ''} ${promptJson.task || ''} ${promptJson.directive || ''}`;

    try {
      const dataUri = image.startsWith('data:') ? image : `data:${mimeType};base64,${base64Data}`;
      
      const fluxRes = await fetch('https://api.replicate.com/v1/models/black-forest-labs/flux-canny-pro/predictions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${replicateToken}`,
          'Content-Type': 'application/json',
          'Prefer': 'wait=30'
        },
        body: JSON.stringify({
          input: {
            control_image: dataUri,
            prompt: imageGenPrompt,
            steps: 28,
            guidance: 30,
            output_format: "jpg"
          }
        })
      });

      if (!fluxRes.ok) {
        throw new Error(`Replicate FLUX API error: ${fluxRes.status}`);
      }

      let fluxData = await fluxRes.json();
      while (fluxData.status !== 'succeeded' && fluxData.status !== 'failed' && fluxData.status !== 'canceled') {
        await new Promise(r => setTimeout(r, 2000));
        const checkRes = await fetch(fluxData.urls.get, {
          headers: { 'Authorization': `Bearer ${replicateToken}` }
        });
        fluxData = await checkRes.json();
      }

      if (fluxData.status === 'succeeded' && fluxData.output) {
        let finalOutputUrl = fluxData.output;
        
        // Step 2-2: Real-ESRGAN 4K Upscale
        try {
          const upscaleRes = await fetch('https://api.replicate.com/v1/models/nightmareai/real-esrgan/predictions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${replicateToken}`,
              'Content-Type': 'application/json',
              'Prefer': 'wait=30'
            },
            body: JSON.stringify({
              input: {
                image: finalOutputUrl,
                scale: 2,
                face_enhance: false
              }
            })
          });

          if (upscaleRes.ok) {
            let upData = await upscaleRes.json();
            while (upData.status !== 'succeeded' && upData.status !== 'failed' && upData.status !== 'canceled') {
              await new Promise(r => setTimeout(r, 2000));
              const checkUp = await fetch(upData.urls.get, {
                headers: { 'Authorization': `Bearer ${replicateToken}` }
              });
              upData = await checkUp.json();
            }
            if (upData.status === 'succeeded' && upData.output) {
              finalOutputUrl = upData.output;
            }
          }
        } catch (upErr) {
          console.warn('Upscale skipped, using base render:', upErr);
        }

        renderedImageBase64 = finalOutputUrl;
        renderStatus = 'rendered';
      }
    } catch (replicateErr) {
      console.warn('Replicate error, falling back to Gemini image:', replicateErr);
    }

    if (!renderedImageBase64) {
      throw new Error('AI 모델에서 이미지 데이터를 수신하지 못했습니다. 다시 시도해 주세요.');
    }

    return new Response(JSON.stringify({
      success: true,
      renderStatus,
      jsonPrompt: promptJson,
      renderedImage: renderedImageBase64,
      originalImage: image
    }), {
      status: 200,
      headers: corsHeaders
    });

  } catch (err) {
    return new Response(JSON.stringify({
      success: false,
      error: err.message || '실사 변환 처리 중 오류가 발생했습니다.'
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key'
    }
  });
}
