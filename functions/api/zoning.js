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
      targetArea = '50평 (approx 165㎡)',
      specialty = '피부과 / 성형외과',
      officeType = 'IT / 테크 / 스타트업',
      headcount = '25명',
      requireCleanZone = true,
      requireXray = false,
      focusRooms = '대회의실 1개, 1인 포커스룸 2개, 폰부스 2개',
      customRequirements = ''
    } = config;

    // Step 1: Architectural Analysis with 100% Boundary Anchor and 4 Distinct Concepts
    const systemPrompt = `You are the specialized Master Architectural Space Planner for Hospital/Clinics and Commercial Offices.

CRITICAL ABSOLUTE RULES:
1. STRICT EXTERIOR BOUNDARY & STRUCTURAL WALL LOCK (100%):
   - You MUST strictly trace and preserve the EXACT exterior wall shape, boundary perimeter, columns, and entrance location of the attached floor plan.
   - NEVER add extra exterior wings, never morph the building perimeter, never hallucinate outside spaces.
   - All room partitions MUST be drawn STRICTLY INSIDE the provided boundary shape.
2. PUBLIC CORE & SHARED AREA EXCLUSION:
   - Identify building stairwells (계단실), elevator shafts (EV실), public exterior corridors (외부 공용 복도), and utility shafts (EPS/TPS).
   - EXCLUDE these areas from the internal usable zoning calculation.
3. REALISTIC 4-CONCEPT ARCHITECTURAL PROPOSAL:
   Generate exactly 4 DIFFERENT architectural layout concepts (대안 1~4) for the SAME space:
   - Concept 1 [안 A]: 전면 라운지 개방형 (Front Lounge / Open Reception Centric)
   - Concept 2 [안 B]: 중앙 집중 코어형 (Central Island Core / Hub Layout)
   - Concept 3 [안 C]: 창가 조망/진료실 일렬형 (Perimeter Daylight / Linear Room Layout)
   - Concept 4 [안 D]: 순환 동선 분리형 (Dual Loop Circulation / Clean-Dirty Split)

PROJECT PARAMETERS:
- Target Space: ${spaceType === 'hospital' ? `병원/의원 (${specialty})` : `상업 오피스 (${officeType})`}
- Area: ${targetArea}
${spaceType === 'hospital' ? `
- Clean/Dirty Separation: ${requireCleanZone ? 'Mandatory' : 'Standard'}
- X-Ray / Radiation Shielding Room: ${requireXray ? 'Required' : 'None'}
` : `
- Target Headcount: ${headcount}
- Focus / Meeting Rooms: ${focusRooms}
`}
- Additional Notes: ${customRequirements || 'None'}

Return ONLY a valid JSON object matching this schema:
{
  "spaceType": "${spaceType}",
  "totalAreaPyung": "${targetArea}",
  "concepts": [
    {
      "id": 1,
      "name": "안 A: 전면 라운지 개방형",
      "conceptDescription": "string (핵심 설계 의도 및 특징)",
      "promptGuidance": "string (specific visual zoning description for image generation)",
      "zones": [
        {
          "zoneName": "string",
          "color": "HEX color string",
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
      "name": "안 B: 중앙 집중 코어형",
      "conceptDescription": "string",
      "promptGuidance": "string",
      "zones": [ { "zoneName": "string", "color": "HEX", "rooms": [ { "roomName": "string", "areaM2": number, "areaPyung": number, "percentage": number, "description": "string" } ] } ],
      "circulationSummary": "string",
      "prosAndCons": "string"
    },
    {
      "id": 3,
      "name": "안 C: 창가 조망/진료실 일렬형",
      "conceptDescription": "string",
      "promptGuidance": "string",
      "zones": [ { "zoneName": "string", "color": "HEX", "rooms": [ { "roomName": "string", "areaM2": number, "areaPyung": number, "percentage": number, "description": "string" } ] } ],
      "circulationSummary": "string",
      "prosAndCons": "string"
    },
    {
      "id": 4,
      "name": "안 D: 순환 동선 분리형",
      "conceptDescription": "string",
      "promptGuidance": "string",
      "zones": [ { "zoneName": "string", "color": "HEX", "rooms": [ { "roomName": "string", "areaM2": number, "areaPyung": number, "percentage": number, "description": "string" } ] } ],
      "circulationSummary": "string",
      "prosAndCons": "string"
    }
  ],
  "structuralSummary": {
    "boundaryShape": "string",
    "excludedCores": "계단실, 엘리베이터, 공용복도 등 공용부 제외 완료",
    "corridorStandard": "메인 복도 유효폭 1.2m~1.5m 확보"
  }
}`;

    const geminiVisionUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.7-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
    
    const analysisPayload = {
      contents: [
        {
          role: "user",
          parts: [
            { text: systemPrompt + "\n\nAnalyze the attached floor plan and output the 4 distinct zoning concepts in JSON." },
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
        temperature: 0.3,
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

    // Step 2: Generate 4 Distinct Color-Coded 2D Architectural Diagrams in Parallel
    const imageApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image:generateContent?key=${encodeURIComponent(apiKey)}`;

    async function generateConceptDiagram(concept, index) {
      const prompt = `Masterpiece professional 2D architectural spatial zoning diagram for ${concept.name || `Option ${index + 1}`}.
CRITICAL BOUNDARY CONSTRAINT: Strictly follow the EXACT exterior wall shape, contour outline, and structural boundary of the attached reference image. Do NOT create outside rooms or extra building wings. Draw all room partitions STRICTLY INSIDE this existing boundary.
ZONING CONCEPT: ${concept.conceptDescription || ''} ${concept.promptGuidance || ''}
COLOR-CODED ZONES: Soft architectural pastel fills (Blue: Reception/Waiting, Green: Consultation/Office, Orange/Yellow: Treatment/Focus, Purple/Red: Clean Surgical Core/Executive, Grey: Corridors/Service).
Exclude staircases and elevator core outside. Clear Korean text labels for each room.
Top-down orthographic 2D architectural floor plan presentation sheet on clean white background.`;

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
        console.error(`Concept ${index + 1} diagram error:`, e);
      }
      return image; // fallback to original
    }

    // Run parallel generation for all 4 concepts
    const diagramPromises = (concepts.length > 0 ? concepts : [1, 2, 3, 4]).map((c, i) => generateConceptDiagram(c, i));
    const generatedDiagrams = await Promise.all(diagramPromises);

    // Attach diagrams to concepts
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
