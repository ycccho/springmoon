# 실사 건축사진 디렉티브 (PPOK_PHOTOREAL v3.4)

이미지와 무관하게 항상 적용되는 핵심 원칙과 물리 규칙. 프롬프트 작성 시 각 필드에 **구체적인 서술형 영어 문장**으로 녹여 쓴다.

---

## 0. 프레이밍: 리디자인이 아닌 "실제 현장 촬영 시뮬레이션"
- 첨부 이미지는 실제로 지어진 공간의 3D 설계 모델이다. 형태를 바꾸지 말고, **실제 전문 건축사진가가 삼각대를 세우고 촬영한 고해상도 건축 사진**으로 재해석한다.

## 1. 편집 범위 한정 (Appearance-Only Editing)
- **바꿀 것 (`change`)**: 표면 재질의 물리적 실재감(미세 러프니스·반사율·도관 깊이·직조감), 빛과 그림자, 대기감, 천장 도장면 및 코브 간접조명 그라디언트, 3D 등기구 실재감, 카메라 광학 특성
- **바꾸지 않을 것 (`do_not_change`)**: 형태(geometry), 배치(layout), 위치(position), 크기(scale), 개수(count), 시점(viewpoint), 프레이밍(framing), **원본의 조도/밝기 의도, 조명 색온도, 원본에 적용된 마감재의 종류·색상·패턴(material identity & finish type)**

## 2. 천장 설비 및 조명 위치/유무/형태 100% 절대 고정 (Ceiling Apparatus & Layout Lock)
**천장은 설계 도면상 배관·공조·전기 라인이 이미 확정된 영역이므로 AI가 임의로 기구를 추가/삭제/이동/각색하는 것을 엄격히 금지한다.**
1. **임의 생성 및 삭제 절대 금지 (Zero Hallucination of Overhead Fixtures)**:
   - 원본 천장에 에어컨이 없는 곳에 **임의로 에어컨을 만들어 넣지 않는다**.
   - 원본에 배치된 에어컨, 펜던트, 다운라이트, 라인조명을 삭제하거나 누락하지 않는다.
2. **에어컨 기종/형태 및 위치 100% 엄격 추종 (Exact AC Type & Position Anchoring)**:
   - 원본이 **1-way / 2-way 직사각형 카세트(Rectangular Cassette)**이면 정확히 직사각형 1-way/2-way 에어컨으로 렌더링한다 (4-way로 임의 변경 금지).
   - 원본이 **4-way 정사각형 카세트(Square 4-Way Cassette)**이면 정확히 정사각형 4-way 에어컨으로 렌더링한다.
   - 천장 타공 위치, 방향, 슬롯 각도를 원본의 그 자리 그대로 고정한다.
3. **조명 기구 위치·개수·타입 절대 불변 (Strict Fixture Layout Lock)**:
   - 펜던트 조명, 다운라이트, 트랙 조명, 라인 조명의 **위치, 간격, 개수, 배열 순서**를 100% 고정한다.
   - 미적 구도를 핑계로 조명을 중앙으로 모으거나 개수를 변경하는 행위를 엄격히 금지한다.
4. **천장 형태 및 단차 고정 (Ceiling Height & Stepped Tray Lock)**:
   - 우물천장(Stepped tray cove)이 있는 구역과 없는 평천장(Flat ceiling) 구역의 단차 경계선과 높이를 원본 그대로 유지한다.

## 3. 동일 현장 다중 뷰 일관성 사전 체크 (Cross-Scene Finish & Lighting Synchronization)
**동일한 프로젝트/현장의 여러 뷰를 함께 작업할 때는 반드시 사전에 모든 마감재와 설비의 기준을 하나로 통일하여 각 뷰마다 재질이나 조명이 제각각 달라지는 현상을 원천 차단한다.**
1. **바닥 마감재 통일 (Unified Floor Tile)**:
   - 동일 공간/인접 구역의 바닥 타일 규격(대형 800x800 포세린 타일), 톤(뉴트럴 라이트 그레이/매트), 줄눈 색상과 광택도를 전 뷰에 100% 동일하게 일치시킨다.
2. **목재 수종 및 톤 동기화 (Synchronized Wood Veneer Tones)**:
   - 다크 월넛(Dark Espresso Walnut): 임원실 벽체, 도어, 데스크, 수납장 등 모든 다크 우드가 뷰마다 다른 나무로 바뀌지 않고 일정한 딥 월넛 톤과 결감을 유지한다.
   - 라이트 오크(Light Oak): 로비 벽체, 탕비실 등의 내추럴 오크가 일관된 샌드 허니 톤을 유지한다.
3. **천장 및 조명 설비 통일 (Unified Ceiling & Lighting Apparatus)**:
   - 원본에 존재하는 시스템 에어컨의 기종(1-way/2-way/4-way)과 화이트 ABS 하우징을 통일하여 렌더링한다.
   - 펜던트 등기구: 동일 현장에 배치된 원뿔형 펜던트는 매트 화이트 코니컬 펜던트 디자인으로 통일한다.
   - 우물천장 코브 간접조명: 모든 뷰에서 동일한 3000K 웜 LED 그라디언트 워시를 적용한다.
4. **유리 파티션 및 금속 하드웨어 통일**:
   - 10mm 클리어 강화유리의 투명도와 도어 스테인리스 레버 핸들의 규격과 마감을 완벽히 동기화한다.

## 4. 카메라 광학
- 삼각대 고정, 카메라 수평 유지
- **24mm 틸트시프트(Perspective-Control) 렌즈**: 시프트 기구를 사용하여 **모든 수직선이 완벽하게 평행(Strictly parallel verticals)**하며 키스톤 왜곡이 없음 (스케치업 2점 투시와 완벽 일치)
- 조리개 f/8~f/11, ISO 100, 깊은 피사계 심도 (전경부터 후경까지 선명, 얕은 아웃포커싱/보케 금지)

## 5. 조명 색온도 및 조도 충실도 (Color Temperature & Illuminance Fidelity)
- **광원 색온도 정밀 추종**:
  - 원본이 **주광색(Daylight White ~5700K-6500K)**이면 맑고 깨끗한 쿨 화이트로 정확히 표현한다.
  - 원본이 **주백색/백색(Neutral White ~4000K-4500K)**이면 깔끔한 뉴트럴 백색으로 표현한다.
  - 원본이 **전구색/웜톤(Warm Amber ~2700K-3000K)**이면 아늑한 전구색 웜톤으로 표현한다.
- **원본 조도 및 명암비 보존 (과도한 밝기 상승 절대 금지)**:
  - 원본의 밝기 레벨(Illuminance level), 섀도우의 깊이, 명암 대비(Contrast ratio)를 충실히 따르는 노출값을 설정한다.

## 6. 천장 실사화 및 스케치업 라인 완전 소멸 (Ceiling & Line Realism)
스케치업 캡처에서 가장 흔히 발생하는 결함인 **천장의 2D 플랫 무질감 및 검은 외곽선**을 완전히 제거하고 실사로 재구축한다.
1. **도장면 질감(Gypsum Paint Texture)**: 단순한 플랫 화이트가 아닌, 미세한 롤러 엠보싱 텍스처(`flat matte painted gypsum plasterboard with subtle micro-stipple paint texture`)와 자연스러운 빛의 감쇠를 부여한다.
2. **외곽선 소멸 & 섀도 갭**: 우물천장 단차, 등기구 타공 테두리, 에어컨 프레임 주변의 모든 인위적 검은 외곽선을 100% 제거하고, 실제 물리적 모서리의 미세 베벨(Bevel)과 음영(Shadow gap)으로만 경계를 표현한다.
3. **간접조명(Cove) 워시**: 코브 홈 안쪽에서 발광하여 천장 석고보드 면을 따라 부드럽게 퍼져나가는 실제 광도 감쇠 그라디언트(`soft continuous gradient wash washing across the ceiling plane`)로 표현한다.
4. **등기구 트림 실사화**: 다운라이트 매립 베젤, 3D 실링팬 곡면 블레이드, 시스템 에어컨 물리적 루버/흡입구, 트랙 조명 압출 레일 및 원통형 헤드 구현

## 7. 예시 이미지 재질 100% 계승 및 물리적 실사화 (Material Anchoring & PBR Materialization)
원본 스케치업에 매핑된 재질(색상, 톤, 패턴, 마감재 종류)을 **임의로 다른 재질로 변경하지 않고 100% 그대로 계승(Anchor)**하면서, 2D 텍스처에 결여된 **실제 물리적 표면 물성(PBR Physics)**만 주입하여 실사로 승화시킨다.

## 8. 노이즈 및 그레인 최소화
- `grain: negligible` (베이스 ISO 100 수준의 깨끗한 고화질 캡처)

## 9. 금지 어휘 (Negative Prompt에만 사용)
- `sketch outlines`, `black contour lines`, `CAD wireframe edges`, `cartoon edges`, `visible edge profiles`, `3D model line overlay`, `flat polygon shading`, `flat 2D ceiling AC`, `flat 2D pendant light`, `flat 2D ceiling fan`, `flat 2D track line`, `added ceiling AC`, `moved ceiling AC`, `rearranged ceiling lights`, `hallucinated fixtures`, `inconsistent materials across views`, `altered material finish`, `overexposed lighting`, `unwanted brightness boost`, `3D render`, `CGI`, `V-Ray`, `Enscape`, `D5 Render`, `Lumion`
