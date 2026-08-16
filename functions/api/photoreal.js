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

    // Determine API Key
    const fallbackKey = atob("QVEuQWI4Uk42TDRHRnlHellTNmg1VXpQYTJ4aGtvVW9odlE0WkV2UUswNXhZNjZRZEFaZ0E=");
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

    // Master System Instruction for INDE RENDER v3.5
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

    // Step 1: Multimodal Vision Analysis via Gemini 3.7 Flash API
    const geminiVisionUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.7-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
    
    const analysisPayload = {
      contents: [
        {
          role: "user",
          parts: [
            {
              text: systemInstruction + "\n\nAnalyze this image and output the complete JSON prompt."
            },
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
      throw new Error(`Gemini Vision API 오류 (${visionRes.status}): ${errText}`);
    }

    const visionData = await visionRes.json();
    let rawJsonText = visionData.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    
    let promptJson = {};
    try {
      promptJson = JSON.parse(rawJsonText);
    } catch (e) {
      promptJson = { raw: rawJsonText };
    }

    // Step 2: High-Resolution Architectural Image Generation via Gemini 3.1 Flash Image API
    let renderedImageBase64 = null;
    let renderStatus = 'prompt_only';

    const imageGenPrompt = `Masterpiece architectural interior photograph of the attached scene. ${promptJson.task || ''}
DIRECTIVE: ${promptJson.directive || ''}
CEILING: ${promptJson.materials?.ceiling || 'Gypsum plasterboard with micro-stipple texture and soft cove gradient wash.'}
FIXTURES: ${promptJson.materials?.ceiling_fixtures || 'Physical 3D fixtures strictly anchored to reference position.'}
MATERIALS: ${promptJson.materials?.walls || ''} ${promptJson.materials?.floor || ''} ${promptJson.materials?.furniture || ''}
LIGHTING: ${promptJson.lighting?.color_temperature || ''} ${promptJson.lighting?.illuminance_level || ''}
OPTICS: 24mm perspective-control tilt-shift lens, perfectly parallel verticals, f/8, ISO 100.
NEGATIVE: sketch outlines, black contour lines, CAD wireframe edges, flat polygon shading, 3D render look, CGI, overexposed lighting, altered material finish.`;

    try {
      const imageApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image:generateContent?key=${encodeURIComponent(apiKey)}`;
      const imagePayload = {
        contents: [
          {
            role: "user",
            parts: [
              {
                text: imageGenPrompt
              },
              {
                inline_data: {
                  mime_type: mimeType,
                  data: base64Data
                }
              }
            ]
          }
        ]
      };

      const imageRes = await fetch(imageApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(imagePayload)
      });

      if (imageRes.ok) {
        const imgData = await imageRes.json();
        const candidateParts = imgData.candidates?.[0]?.content?.parts || [];
        for (const part of candidateParts) {
          // Check both camelCase (inlineData) and snake_case (inline_data)
          const inlineObj = part.inlineData || part.inline_data;
          if (inlineObj && inlineObj.data) {
            const outMime = inlineObj.mimeType || inlineObj.mime_type || 'image/jpeg';
            renderedImageBase64 = `data:${outMime};base64,${inlineObj.data}`;
            renderStatus = 'rendered';
            break;
          }
        }
      } else {
        const imgErrText = await imageRes.text();
        console.warn("Gemini 3.1 Flash Image API response:", imgErrText);
        throw new Error(`이미지 렌더링 API 오류: ${imgErrText}`);
      }
    } catch (renderErr) {
      console.warn("Image generation catch:", renderErr);
      if (!renderedImageBase64) {
        throw new Error(`실사 이미지 생성 중 오류: ${renderErr.message}`);
      }
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
