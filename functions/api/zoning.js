export async function onRequestPost(context) {
  const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key'
  };

  try {
    const body = await context.request.json();
    const { image, spaceType = 'office', config = {}, apiKey: clientApiKey } = body;

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
      targetArea = '50평 (약 165㎡)',
      specialty = '피부과 / 성형외과',
      officeType = '일반 기업 본사 / 지사',
      headcount = '10명',
      customRequirements = ''
    } = config;

    const isOffice = (spaceType === 'office');

    // Strict Domain Specific System Instructions
    let domainSpecificInstruction = '';
    if (isOffice) {
      domainSpecificInstruction = `
=========================================
TARGET: COMMERCIAL OFFICE ONLY (사무실 / 업무 공간 전용)
STRICT FORBIDDEN: DO NOT USE ANY MEDICAL/HOSPITAL TERMS (NO 진료실, NO 처치실, NO 환자, NO 수술실, NO 소독실, NO 레이저실, NO 피부관리실)!
YOU MUST USE EXCLUSIVELY OFFICE TERMINOLOGY:
- 입구 및 접견 라운지 (Welcome Lounge / Reception)
- 오픈 워크스테이션 / 메인 업무 공간 (Open Workstations / Desks)
- 대회의실 / 중회의실 (Conference / Meeting Rooms)
- 대표실 / 임원실 / 프라이빗 룸 (Executive Office / Director Room)
- 1인 포커스룸 / 폰부스 (Focus Room / Phone Booth)
- 탕비실 / 팬트리 / 휴게실 (Pantry / Break Area)
- OA존 / 복합기실 / 서버 창고 (OA & Utility)

OFFICE CONFIGURATION:
- Space Category: ${officeType}
- Target Headcount: ${headcount}
- Area Scale: ${targetArea}
- User Custom Directive: ${customRequirements || 'None'}
=========================================`;
    } else {
      domainSpecificInstruction = `
=========================================
TARGET: MEDICAL CLINIC ONLY (병원 / 의원 전용)
STRICT FORBIDDEN: DO NOT USE OFFICE TERMS (NO 워크스테이션, NO 팀장석)!
USE EXCLUSIVELY CLINIC TERMINOLOGY:
- 접수 및 대기실 (Reception & Patient Waiting)
- 원장 진료실 (Doctor Consultation Room)
- 상담실 (Patient Counseling)
- 처치실 / 시술실 / 관리실 (Treatment / Care Room)
- 직원 휴게실 / 소독준비실 (Staff Lounge & Sterilization)
- 파우더룸 및 세면존 (Powder / Wash)

CLINIC CONFIGURATION:
- Medical Specialty: ${specialty}
- Area Scale: ${targetArea}
- User Custom Directive: ${customRequirements || 'None'}
=========================================`;
    }

    const systemPrompt = `You are a licensed Senior Architectural Space Planner.
${domainSpecificInstruction}

ABSOLUTE 4 RULES OF ARCHITECTURAL ZONING:
1. STRICT CAD BOUNDARY & WALL LOCK (100%):
   - The attached image contains the EXACT building core, exterior curtain wall, and tenant boundary.
   - You MUST 100% preserve and freeze the exact outer black lines, perimeter geometry, corners, columns, and entrance location (Check user notes for entrance position like 9 o'clock/left side).
   - ZERO outer expansion, ZERO drawing outside the tenant boundary. All partitions and room zones are strictly drawn INSIDE the interior floor area.
2. EXCLUDE EXTERIOR SERVICE CORES:
   - Exclude any exterior stairs, elevator cores, EPS, TPS, and public corridors.
3. REALISTIC SPACE PROGRAM & ROOM PROPORTIONS:
   - Calculate realistic room sizes in Pyung (평) and Sqm (㎡) matching the requested area (${targetArea}).
   - Realistic room counts for ${targetArea}:
     * 30평: 4~5 rooms total
     * 50~60평: 6~7 rooms total (e.g. Lounge 10평, Open Workstation 20평 for 10 seats, Conference Room 8평, Executive Office 6평, Focus/Phone 3평, Pantry/OA 3평, Corridors 6평)
     * 70~80평: 7~9 rooms total
4. 4 DISTINCT ARCHITECTURAL PROPOSALS (대안 1~4) FOR THIS EXACT SPACE:
   ${isOffice ? `
   - Concept 1 [안 A]: 전면 라운지 & 오픈 워크스페이스형 (Front Lounge & Open Collaborative Workspace)
   - Concept 2 [안 B]: 중앙 회의 코어 분할형 (Central Meeting Core & Dual Wing Workstations)
   - Concept 3 [안 C]: 창가 조망 임원실/회의실 우선형 (Window-Side Executive & Boardroom Priority)
   - Concept 4 [안 D]: 부서별 독립 구획형 (Zoned Departmental & Focus Intensive Layout)
   ` : `
   - Concept 1 [안 A]: 전면 라운지 개방형 (Wide Front Reception & Waiting)
   - Concept 2 [안 B]: 중앙 통로 분할형 (Efficient Central Spine Corridor)
   - Concept 3 [안 C]: 창가 조망 진료실 우선형 (Perimeter Window-Side Doctor Rooms)
   - Concept 4 [안 D]: 고객-스태프 동선 분리형 (Dual Circulation Loop / Staff Privacy)
   `}

Return ONLY valid JSON matching this schema:
{
  "spaceType": "${spaceType}",
  "totalAreaPyung": "${targetArea}",
  "concepts": [
    {
      "id": 1,
      "name": "안 A: ${isOffice ? '전면 라운지 & 오픈 워크스페이스형' : '전면 라운지 개방형'}",
      "conceptDescription": "string (설계 의도 및 공간 구성)",
      "promptGuidance": "string",
      "zones": [
        {
          "zoneName": "string",
          "color": "HEX",
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
      "name": "안 B: ${isOffice ? '중앙 회의 코어 분할형' : '중앙 통로 분할형'}",
      "conceptDescription": "string",
      "promptGuidance": "string",
      "zones": [ { "zoneName": "string", "color": "HEX", "rooms": [ { "roomName": "string", "areaM2": number, "areaPyung": number, "percentage": number, "description": "string" } ] } ],
      "circulationSummary": "string",
      "prosAndCons": "string"
    },
    {
      "id": 3,
      "name": "안 C: ${isOffice ? '창가 조망 임원실/회의실 우선형' : '창가 조망 진료실 우선형'}",
      "conceptDescription": "string",
      "promptGuidance": "string",
      "zones": [ { "zoneName": "string", "color": "HEX", "rooms": [ { "roomName": "string", "areaM2": number, "areaPyung": number, "percentage": number, "description": "string" } ] } ],
      "circulationSummary": "string",
      "prosAndCons": "string"
    },
    {
      "id": 4,
      "name": "안 D: ${isOffice ? '부서별 독립 구획형' : '고객-스태프 동선 분리형'}",
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
            { text: systemPrompt + `\n\nAnalyze the attached 2D CAD floor plan and generate 4 distinct ${isOffice ? 'COMMERCIAL OFFICE' : 'MEDICAL CLINIC'} zoning proposals in JSON.` },
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
    
    let zoningResult = {};
    try {
      zoningResult = JSON.parse(rawJsonText);
    } catch (e) {
      zoningResult = { raw: rawJsonText };
    }

    const concepts = zoningResult.concepts || [];

    // Step 2: Generate 4 Distinct Diagrams with Strict Domain & Boundary Locking
    const imageApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image:generateContent?key=${encodeURIComponent(apiKey)}`;

    async function generateConceptDiagram(concept, index) {
      const roomsList = (concept.zones || [])
        .flatMap(z => (z.rooms || []).map(r => `${r.roomName}(${r.areaPyung}평)`))
        .join(', ');

      const inpaintPrompt = `Masterpiece 2D architectural CAD floor plan zoning overlay directly on the attached reference drawing.
TYPE: ${isOffice ? 'COMMERCIAL OFFICE (사무실) ONLY' : 'MEDICAL CLINIC (병원) ONLY'}.
${isOffice ? 'ABSOLUTE RULE: THIS IS AN OFFICE. DO NOT DRAW HOSPITAL CLINIC ROOMS! Draw office desks, conference tables, executive desk, phone booths, pantry.' : 'ABSOLUTE RULE: THIS IS A MEDICAL CLINIC. Draw clinic reception, doctor room, treatment beds.'}
BOUNDARY DIRECTIVE (100% LOCK):
1. Keep the exact outer building perimeter, curtain wall lines, columns, and public cores (stairs, elevator, EPS) in their exact pixel positions without modifying or redrawing them.
2. Inside the tenant interior floor space, draw crisp internal partition walls and fill each functional room with distinct soft architectural pastel colors.
3. ROOMS TO SUBDIVIDE: ${roomsList || concept.conceptDescription || ''}
4. Add clear Korean text labels with room names and door swing lines inside each room.
5. ZERO external building additions, ZERO drawing outside the tenant boundary box. Pure 2D top-down orthographic architectural floor plan presentation sheet.`;

      const imgPayload = {
        contents: [
          {
            role: "user",
            parts: [
              { text: inpaintPrompt },
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
