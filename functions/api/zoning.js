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
      targetArea = '60평 (approx 198㎡)',
      specialty = '피부과/성형외과',
      officeType = 'IT/스타트업',
      headcount = '25명',
      requireCleanZone = true,
      requireXray = false,
      focusRooms = '대회의실 1개, 1인 포커스룸 2개, 폰부스 2개',
      customRequirements = ''
    } = config;

    // Step 1: Architectural Zoning Analysis via Gemini 3.7 Flash
    const systemPrompt = `You are the Master Architectural Space Planner specializing EXCLUSIVELY in Hospital/Medical Clinics and Commercial Offices (Residential/Housing is STRICTLY EXCLUDED).

Analyze the attached 2D floor plan outline/slab and generate an authoritative, code-compliant spatial zoning plan.

TARGET SPACE TYPE: ${spaceType === 'hospital' ? '병원/의원 (Medical Clinic)' : '상업용 사무실 (Commercial Office)'}
SPECIFIC REQUIREMENTS:
- Estimated Area: ${targetArea}
${spaceType === 'hospital' ? `
- Medical Specialty: ${specialty}
- Clean/Dirty Separation & Sterile Surgical Flow: ${requireCleanZone ? 'Mandatory Clean Core' : 'Standard'}
- X-Ray / Radiation Shielding Room: ${requireXray ? 'Required (lead-lined walls)' : 'Not needed'}
- Corridor Clearance: Minimum 1.2m ~ 1.8m for patient/stretcher compliance.
` : `
- Office Workplace Type: ${officeType}
- Target Headcount: ${headcount}
- Focus / Meeting Rooms: ${focusRooms}
- Activity-Based Workplace (ABW): Natural daylight perimeter for open desks, internal core for meeting/phone booths.
`}
- Additional Notes: ${customRequirements || 'None'}

Return ONLY a valid JSON object matching this schema:
{
  "projectTitle": "string",
  "spaceType": "${spaceType}",
  "totalAreaM2": number,
  "totalAreaPyung": number,
  "zones": [
    {
      "zoneName": "string (e.g., 공용 대기/접수 구역 or 오픈 워크스페이스)",
      "color": "string (HEX code, e.g. #3B82F6, #10B981, #F59E0B, #8B5CF6, #EC4899)",
      "rooms": [
        { "roomName": "string", "areaM2": number, "areaPyung": number, "percentage": number, "description": "string" }
      ]
    }
  ],
  "circulationAnalysis": {
    "patientFlow": "string",
    "staffFlow": "string",
    "serviceFlow": "string",
    "fireEgress": "string"
  },
  "complianceChecklist": [
    { "item": "string", "status": "Pass" | "Recommended", "note": "string" }
  ],
  "architecturalAdvice": "string"
}`;

    const geminiVisionUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.7-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
    
    const analysisPayload = {
      contents: [
        {
          role: "user",
          parts: [
            { text: systemPrompt + "\n\nAnalyze this floor plan and return the complete JSON spatial zoning specification." },
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
    
    let zoningData = {};
    try {
      zoningData = JSON.parse(rawJsonText);
    } catch (e) {
      zoningData = { raw: rawJsonText };
    }

    // Step 2: Generate Color-Coded Architectural 2D Zoning Diagram with Gemini 3.1 Flash Image
    let zoningDiagramBase64 = null;
    const diagramPrompt = `Masterpiece professional architectural 2D spatial zoning diagram for ${zoningData.projectTitle || spaceType}.
Clean top-down orthographic 2D floor plan layout with clearly distinguished color-coded functional zones overlay.
Zoning Colors: Soft architectural pastel fills with clean dark boundary outlines and sharp typography labels.
High resolution architectural blueprint presentation sheet on pure white background, perfectly crisp lines, professional CAD drafting standards.`;

    const imageApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image:generateContent?key=${encodeURIComponent(apiKey)}`;
    const imagePayload = {
      contents: [
        {
          role: "user",
          parts: [
            { text: diagramPrompt },
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
      const imgRes = await fetch(imageApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(imagePayload)
      });

      if (imgRes.ok) {
        const imgData = await imgRes.json();
        const candidateParts = imgData.candidates?.[0]?.content?.parts || [];
        for (const part of candidateParts) {
          const inlineObj = part.inlineData || part.inline_data;
          if (inlineObj && inlineObj.data) {
            const outMime = inlineObj.mimeType || inlineObj.mime_type || 'image/jpeg';
            zoningDiagramBase64 = `data:${outMime};base64,${inlineObj.data}`;
            break;
          }
        }
      }
    } catch (e) {
      console.error('Image diagram generation fallback:', e);
    }

    return new Response(JSON.stringify({
      success: true,
      zoningData,
      zoningDiagram: zoningDiagramBase64 || image,
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
