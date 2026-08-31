export async function onRequestPost(context) {
  const corsHeaders = {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key'
  };

  try {
    const body = await context.request.json();
    const { image, config = {}, apiKey: clientApiKey } = body;

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
      specialty = '피부과 / 성형외과',
      targetArea = '50평 (약 165㎡)',
      counters = {},
      optionsChecked = {},
      hasInternalToilet = false,
      entrancePosition = '도면 표시 위치 (기본)',
      customRequirements = ''
    } = config;

    const toiletRequirement = hasInternalToilet
      ? '  * 호실 내부 전용 화장실 (신설 구획 필수): 1개 (약 1.5~2.5평 / 배수 배관 위치 연계, 대기실 또는 파우더룸 인근 구획)'
      : '  * 화장실: 건물 공용 화장실 이용 (호실 내부 화장실 미설치하여 진료/대기 공간 면적 극대화)';

    const LABEL_MAP = {
      chairZones: '오픈 진료구역 (체어 수)',
      vipRooms: '독립 VIP 수술실 (특진/임플란트)',
      doctorRooms: '원장 진료실 수',
      counselingRooms: '상담실 수',
      laserRooms: '레이저 처치실 수',
      skinCareBeds: '피부관리실 (베드 수)',
      operationRooms: '무균 수술실 (Class 10,000 양압)',
      opRooms: '남성 수술실 수',
      recoveryBeds: '회복실 (개별 산소 베드)',
      dosuRooms: '1:1 독립 도수치료실 수',
      physicalBeds: '물리치료실 (전기/온열 베드 수)',
      fluidBeds: '수액 치료실 (리클라이너/베드)',
      labRooms: '임상병리 / 채혈 / 주사실',
      nebulizerUnits: '호흡기 치료존 (네블라이저 구수)',
      treatmentRooms: '주사 / 수액 / 태동 처치실',
      darkExamRoom: '암실 정밀 검사실 (안저/시야)',
      acupunctureBeds: '침구 치료실 (베드 수)',
      chunaRooms: '추나 치료실 수',
      examRooms: '정밀 뇌파/스트레스 검사실',
      hasDirectorRoom: '독립 대표 원장실'
    };

    const countersText = Object.entries(counters)
      .map(([k, v]) => {
        const lbl = LABEL_MAP[k] || k;
        if (typeof v === 'boolean') {
          return `  * ${lbl}: ${v ? '1개 필수' : '없음'}`;
        }
        return `  * ${lbl}: ${v}개`;
      })
      .join('\n');

    const optionsText = Object.entries(optionsChecked)
      .filter(([k, v]) => v)
      .map(([k]) => `  * ${k} (필수 배치 및 동선 연계)`)
      .join('\n');

    const roomRequirementsSummary = `
- 진료 과목: ${specialty} (대한민국 11대 전문 진료과)
- 전용 면적: ${targetArea}
- 주출입구(E.N.T): ${entrancePosition}
- 필수 실 구성 및 특화 장비 요청:
  * 대기실 및 접수/수납 리셉션 (1개 필수, 출입문 진입 시 첫 공간)
${countersText}
${optionsText}
  * 직원 휴게실 및 소독준비실: 1개
  * 파우더룸 및 세면존
${toiletRequirement}
- 사용자 추가 메모: ${customRequirements || '최신 한국 병원 인테리어 트렌드 및 완벽한 동선 반영'}
`;

    // Step 1: Vision Architectural Analysis for 8 Distinct Medical Concepts
    const systemPrompt = `You are the Master Architectural Hospital Space Planner specializing in Korean Medical Clinics (피부과, 성형외과, 치과, 내과, 이비인후과, 안과, 정형외과 등 전 진료과목).

PROJECT PARAMETERS:
${roomRequirementsSummary}

7 ABSOLUTE RULES OF MEDICAL ZONING (ZERO TOLERANCE FOR HALLUCINATION):
1. PHYSICAL ENVELOPE & WALL LOCK (100%):
   - The attached image has an exact outer perimeter wall geometry, columns, windows, and core boundaries.
   - NEVER alter, expand, or add outer rooms. All partitions MUST be drawn STRICTLY INSIDE the existing white floor area within the black boundary lines.
2. ENTRANCE & SEQUENCE LOCK:
   - The main entrance location must be preserved.
   - The VERY FIRST space when entering through the entrance door MUST be the [Reception Desk & Patient Waiting Lounge (접수/수납 및 대기실)].
   - NEVER place a doctor's room or treatment room directly in front of the entrance door.
3. CONTINUOUS CIRCULATION & NO BLIND ROOMS:
   - All rooms must be accessible via clear, unblocked main corridors with a minimum effective width of 1,200mm ~ 1,500mm.
   - Zero dead-end blocked corridors, zero inaccessible rooms.
4. EXACT ROOM PROGRAM ADHERENCE:
   - Exactly implement the user requested room counts, chair counts, VIP rooms, and specialty medical equipment specified in PROJECT PARAMETERS above.
5. MEDICAL CLEAN / DIRTY DISINFECTION PROTOCOL:
   - Separate patient circulation from staff/sterile sterilization pathways.
   - For dermatology/plastic surgery: Lounge -> Counseling -> Wash -> Doctor/Laser -> Operation/Recovery -> Staff.
6. PRODUCE EXACTLY 8 DISTINCT REALISTIC ARCHITECTURAL CONCEPTS (대안 1~8):
   - Concept 1 [안 1]: 전면 파노라마 대기형 (Front Panorama Lounge & Reception)
   - Concept 2 [안 2]: 중앙 아일랜드 코어형 (Central Treatment Island & Ring Corridor)
   - Concept 3 [안 3]: 진료실 창가 채광 일렬형 (Perimeter Daylight Doctor's Room Alignment)
   - Concept 4 [안 4]: 환자-의료진 듀얼 동선 분리형 (Dual Loop Clean/Dirty Split)
   - Concept 5 [안 5]: 프라이빗 개별 룸 집중형 (Private VIP Suites & Booths)
   - Concept 6 [안 6]: 대기-상담-진료 원스톱 직결형 (Linear Fast-Track Flow)
   - Concept 7 [안 7]: 상담/케어 라운지 중심형 (Counseling & Open Care Hub)
   - Concept 8 [안 8]: 가변형 모듈러 구획형 (Modular Flexible Grid Layout)

LANGUAGE DIRECTIVE (CRITICAL):
- Output ALL room names (roomName), zone names (zoneName), concept names (name), descriptions (conceptDescription, description), and circulation summaries (circulationSummary) in 100% natural, highly professional Korean architectural terminology (자연스러운 한국어 표기, 글자 깨짐 절대 금지).

Return ONLY a valid JSON object matching this schema:
{
  "specialty": "${specialty}",
  "totalArea": "${targetArea}",
  "concepts": [
    {
      "id": 1,
      "name": "안 1: 전면 파노라마 대기형",
      "conceptDescription": "string (설계 의도 및 핵심 특징)",
      "circulationSummary": "string (환자 및 의료진 동선 흐름)",
      "zones": [
        {
          "zoneName": "string (대기/접수 구역 / 진료 및 상담 구역 / 처치 및 관리 구역 / 의료진 지원 구역 / 복도 및 공용 구역)",
          "color": "HEX (Blue, Green, Orange, Purple, Grey)",
          "rooms": [
            { "roomName": "string", "areaM2": number, "areaPyung": number, "percentage": number, "description": "string" }
          ]
        }
      ]
    },
    { "id": 2, "name": "안 2: 중앙 아일랜드 코어형", "conceptDescription": "string", "circulationSummary": "string", "zones": [...] },
    { "id": 3, "name": "안 3: 진료실 창가 채광 일렬형", "conceptDescription": "string", "circulationSummary": "string", "zones": [...] },
    { "id": 4, "name": "안 4: 환자-의료진 듀얼 동선 분리형", "conceptDescription": "string", "circulationSummary": "string", "zones": [...] },
    { "id": 5, "name": "안 5: 프라이빗 개별 룸 집중형", "conceptDescription": "string", "circulationSummary": "string", "zones": [...] },
    { "id": 6, "name": "안 6: 대기-상담-진료 원스톱 직결형", "conceptDescription": "string", "circulationSummary": "string", "zones": [...] },
    { "id": 7, "name": "안 7: 상담/케어 라운지 중심형", "conceptDescription": "string", "circulationSummary": "string", "zones": [...] },
    { "id": 8, "name": "안 8: 가변형 모듈러 구획형", "conceptDescription": "string", "circulationSummary": "string", "zones": [...] }
  ]
}`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
    
    const analysisPayload = {
      contents: [
        {
          role: "user",
          parts: [
            { text: systemPrompt + "\n\nAnalyze the attached floor plan and output the 8 complete medical clinic zoning proposals in JSON." },
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

    const visionRes = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(analysisPayload)
    });

    if (!visionRes.ok) {
      const errText = await visionRes.text();
      let customErr = `도면 분석 API 오류 (${visionRes.status}): ${errText}`;
      if (visionRes.status === 429 && (errText.includes('prepayment credits are depleted') || errText.includes('RESOURCE_EXHAUSTED'))) {
        customErr = 'Google AI Studio의 선불 충전 크레딧이 소진되었습니다. 우측 상단 [API 키 설정]에서 새 무료 API 키(AIzaSy...)를 등록하시거나, Google AI Studio에서 크레딧을 추가 충전해 주세요.';
      }
      throw new Error(customErr);
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

    // Step 2: INDE_RENDER Direct Inpainting Style Overlay on the EXACT Base Image for All 8 Concepts
    const imageApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image:generateContent?key=${encodeURIComponent(apiKey)}`;

    async function generateConceptDiagram(concept, index) {
      const roomsList = (concept.zones || [])
        .flatMap(z => (z.rooms || []).map(r => `${r.roomName}(${r.areaPyung || ''}평)`))
        .join(', ');

      const inpaintPrompt = `Masterpiece 2D architectural CAD medical clinic floor plan zoning blueprint for ${concept.name || `Option ${index + 1}`}.
SPECIALTY: ${specialty} (${targetArea}).
STRICT BOUNDARY & WALL LOCK (100%):
1. Keep the exact outer building perimeter lines, columns, entrance door, and outer geometry in their exact pixel positions without modifying or redrawing them.
2. Inside the tenant interior floor space, draw crisp internal partition walls and fill each functional room with distinct soft architectural pastel colors.
3. ROOM SEQUENCE: Entrance leads immediately to [접수/대기실]. Subdivided rooms inside: ${roomsList || concept.conceptDescription || ''}.
4. Add clear Korean text labels with room names and door swing lines inside each room.
5. ZERO external additions, ZERO drawing outside the black boundary box. Clean top-down 2D orthographic architectural presentation sheet.`;

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

    // Parallel generation for all 8 concepts
    const diagramPromises = concepts.map((c, i) => generateConceptDiagram(c, i));
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
      error: err.message || '병원 도면 조닝 처리 중 오류가 발생했습니다.'
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
