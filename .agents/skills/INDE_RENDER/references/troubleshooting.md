# 문제 해결 및 재프롬프트 가이드 (PPOK_PHOTOREAL v3)

| 증상 | 주요 원인 | 대응 및 재프롬프트 지침 |
|---|---|---|
| **천장이 2D 스케치/플랫하게 남음** | AI가 무질감 면 위의 검은 선을 '구조'로 오인 | `materials.ceiling`에 `gypsum plasterboard with subtle micro-stipple texture` 명시, `materials.ceiling_fixtures`에 실링팬/에어컨/트랙조명의 3D 물리적 형태를 구체적으로 서술하고 `negative_prompt`에 `flat 2D ceiling fan`, `flat 2D track line` 추가 |
| **방이 다른 방으로 바뀜** | 구조 지시가 약하거나 좌표를 임의로 재서술함 | `structure_lock` 강화, `edit_scope`의 `do_not_change` 엄격 유지 |
| **검은 CAD 외곽선이 여전히 보임** | 모서리 베벨 지시 부족 | `realism_layer.edge_behavior`에 `physical micro-radiused bevels replacing black lines` 강조 |
| **창밖이 하얗게 날아감** | 윈도우 노출 지시 부재 | `photographic_setup.exposure_technique`에 `window pull` 명시 |
| **수직선이 휘거나 방이 기울어짐** | 핸드헬드/광각 왜곡 지시 입력 | `perspective_control: lens shift used to maintain strictly parallel verticals` 고정 |
| **이미지가 너무 자글거리거나 노이즈 발생** | 그레인 과다 지정 | `grain: negligible, clean base-ISO 100 capture`로 제한 |
