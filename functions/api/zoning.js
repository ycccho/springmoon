export async function onRequestPost(context) {
  const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key'
  };

  try {
    const body = await context.request.json();
    const { image, spaceType = 'hospital', config = {}, apiKey: clientApiKey } = body;

    if (!image) {
      return new Response(JSON.stringify({ success: false, error: '평면도 이미지 데이터가 필요합니다.' }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Tier-1 Paid Key fallback
    const fallbackKey = atob("QVEuQWI4Uk42SzJLOTZWb2FTOVNSYlU5NWZPV21CYUJpZnp0ZnlidWhXbmJkM0RwSmpxelE=");
    let apiKey = clientApiKey || context.env?.GEMINI_API_KEY || fallbackKey;

    let mimeType = 'image/jpeg';
    let base64Data = image;
    if (image.startsWith('data:')) {
      const parts = image.split(';base64,');
      mimeType = parts[0].replace('data:', '');
      base64Data = parts[1];
    }

    const {
      targetArea = '30평 (약 99㎡)',
      specialty = '피부과 / 성형외과',
      officeType = 'IT / 테크 / 스타트업',
      headcount = '12명',
      requireCleanZone = true,
      requireXray = false,
      focusRooms = '회의실 1개, 탕비실 1개',
      customRequirements = ''
    } = config;

    // Step 1: Realistic Architectural Zoning Analysis with Strict Boundary & Realistic Room Count
    const systemPrompt = `You are a licensed Senior Architectural Space Planner specializing in Medical Clinics and Commercial Offices in Korea.

CRITICAL ARCHITECTURAL REALISM RULES:
1. STRICT GEOMETRIC WALL & BOUNDARY LOCK (100%):
   - You MUST identify the EXACT outer perimeter polygon of the attached floor plan (e.g. rectangular slab with diagonal chamfered corner, entrance at bottom).
   - NEVER invent external wings, notches, indentations, or extra exterior walls.
   - All rooms MUST fit strictly inside this exact outer boundary.
2. EXCLUDE PUBLIC CORES:
   - Exclude external stairs, elevator shafts, and public corridors.
3. REALISTIC SPACE PROGRAM & ROOM COUNT BY AREA:
   - 30평형 (approx 99㎡ / Net usable 22~25평):
     * MAXIMUM 4 to 5 rooms TOTAL! It is PHYSICALLY IMPOSSIBLE to put 10 rooms in 30평.
     * Typical 30평 Hospital Clinic: Reception/Waiting (8~10평), 1 Consultation/Doctor Room (3.5~4평), 1 Counseling Room (2.5~3평), 1 Treatment/Skin Care (4~5평), 1 Staff/Sterilization/Pantry (2.5~3평), Corridors/Powder (3평).
     * Typical 30평 Office: Entrance/Lounge (3~4평), Open Workstation 8~12 seats (10~12평), 1 Meeting Room 4~6 seats (4~5평), 1 Executive Room or Focus Room (3~4평), Pantry/OA (1.5~2평).
   - 50평형 (approx 165㎡): 6 to 7 rooms total.
   - 70평형 (approx 231㎡): 8 to 10 rooms total.
   - 100평형 (approx 330㎡): 12 to 15 rooms total.
4. PRODUCE 4 DISTINCT ARCHITECTURAL LAYOUT CONCEPTS:
   - Concept 1 [안 A]: 전면 라운지 개방형 (Front Open Lounge / Wide Reception)
   - Concept 2 [안 B]: 중앙 통로 분할형 (Central Corridor / Efficient Linear Division)
   - Concept 3 [안 C]: 창가 조망/진료실 우선형 (Window-Side Daylight Priority)
   - Concept 4 [안 D]: 고객-스태프 동선 분리형 (Dual Circulation Loop / Privacy Focused)

Return ONLY valid JSON matching this exact schema:
{
  "spaceType": "${spaceType}",
  "totalAreaPyung": "${targetArea}",
  "boundaryDescription": "string (e.g. 5각형 외곽선 슬래브 - 직사각형에 상단 좌측 사선 꺾임)",
  "concepts": [
    {
      "id": 1,
      "name": "안 A: 전면 라운지 개방형",
      "conceptDescription": "string",
      "promptGuidance": "string",
      "zones": [
        {
          "zoneName": "string (공용 대기구역 / 진료 및 상담 / 처치 및 관리 / 직원 지원구역 / 공용 복도)",
          "color": "HEX (Blue, Green, Orange, Purple, Grey)",
          "rooms": [
            { "roomName": "string", "areaM2": number, "areaPyung": number, "percentage": number, "description": "string" }
          ]
        }
      ],
      "circulationSummary": "string",
      "prosAndCons": "string"
    },
    {
      "id": 2,
      "name": "안 B: 중앙 통로 분할형",
      "conceptDescription": "string",
      "promptGuidance": "string",
      "zones": [ { "zoneName": "string", "color": "HEX", "rooms": [ { "roomName": "string", "areaM2": number, "areaPyung": number, "percentage": number, "description": "string" } ] } ],
      "circulationSummary": "string",
      "prosAndCons": "string"
    },
    {
      "id": 3,
      "name": "안 C: 창가 조망 우선형",
      "conceptDescription": "string",
      "promptGuidance": "string",
      "zones": [ { "zoneName": "string", "color": "HEX", "rooms": [ { "roomName": "string", "areaM2": number, "areaPyung": number, "percentage": number, "description": "string" } ] } ],
      "circulationSummary": "string",
      "prosAndCons": "string"
    },
    {
      "id": 4,
      "name": "안 D: 고객-스태프 동선 분리형",
      "conceptDescription": "string",
      "promptGuidance": "string",
      "zones": [ { "zoneName": "string", "color": "HEX", "rooms": [ { "roomName": "string", "areaM2": number, "areaPyung": number, "percentage": number, "description": "string" } ] } ],
      "circulationSummary": "string",
      "prosAndCons": "string"
    }
  ]
}`;

    const geminiVisionUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.7-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
    
    const analysisPayload = {
      contents: [
        {
          role: "user",
          parts: [
            { text: systemPrompt + "\n\nAnalyze the attached floor plan and return the 4 realistic architectural concepts in JSON." },
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
      throw new Error(`도면 조닝 분석 API 오류 (${visionRes.status}): ${errText}`);
    }

    const visionData = await visionRes.json();
    let rawJsonText = visionData.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    
    let zoningResult = {};
    try {
      zoningResult = JSON.parse(rawJsonText);
    } catch (e) {
      zoningResult = { raw: rawJsonText };
    }

    const concepts = zoningResult.concepts || [];

    // Step 2: Generate 4 Distinct Diagrams with Strict Exterior Silhouette Inpainting Prompt
    const imageApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image:generateContent?key=${encodeURIComponent(apiKey)}`;

    async function generateConceptDiagram(concept, index) {
      const prompt = `Architectural 2D top-down floor plan zoning blueprint for ${concept.name || `Option ${index + 1}`}.
CRITICAL BOUNDARY ANCHORING (100%):
- The attached image has an exact outer perimeter wall geometry. DO NOT ALTER, DO NOT ADD OUTER ROOMS, DO NOT BUMP OR INDENT EXTERIOR WALLS.
- Keep the EXACT same boundary silhouette as the attached drawing.
- Subdivide the INTERIOR with realistic partition walls for ${targetArea}.
ROOM PROGRAM (Realistic 4~5 rooms):
${concept.conceptDescription || ''}
${(concept.zones || []).map(z => `- ${z.zoneName}: ${(z.rooms || []).map(r => r.roomName).join(', ')}`).join('\n')}
VISUAL STYLE: Clean CAD architectural 2D blueprint, soft pastel color fills (Blue: Waiting, Green: Doctor/Office, Orange: Care/Treatment, Grey: Corridor), crisp black interior partition lines, clear Korean room labels, pure white background.`;

      const imgPayload = {
        contents: [
          {
            role: "user",
            parts: [
              { text: prompt },
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

      try {
        const res = await fetch(imageApiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(imgPayload)
        });

        if (res.ok) {
          const data = await res.json();
          const parts = data.candidates?.[0]?.content?.parts || [];
          for (const p of parts) {
            const inlineObj = p.inlineData || p.inline_data;
            if (inlineObj && inlineObj.data) {
              const mime = inlineObj.mimeType || inlineObj.mime_type || 'image/jpeg';
              return `data:${mime};base64,${inlineObj.data}`;
            }
          }
        }
      } catch (e) {
        console.error(`Concept ${index + 1} diagram generation error:`, e);
      }
      return image;
    }

    const diagramPromises = (concepts.length > 0 ? concepts : [1, 2, 3, 4]).map((c, i) => generateConceptDiagram(c, i));
    const generatedDiagrams = await Promise.all(diagramPromises);

    if (zoningResult.concepts && Array.isArray(zoningResult.concepts)) {
      zoningResult.concepts.forEach((concept, idx) => {
        concept.diagramImage = generatedDiagrams[idx] || image;
      });
    }

    return new Response(JSON.stringify({
      success: true,
      zoningResult,
      diagrams: generatedDiagrams,
      originalFloorPlan: image
    }), {
      status: 200,
      headers: corsHeaders
    });

  } catch (err) {
    return new Response(JSON.stringify({
      success: false,
      error: err.message || '도면 조닝 처리 중 오류가 발생했습니다.'
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
