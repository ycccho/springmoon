# 대상 AI 모델별 어댑터 가이드 (PPOK_PHOTOREAL v3)

## 1. Nano Banana Pro / Gemini 3 Pro Image (기본 대상)
- 전체 JSON 포맷 100% 지원
- `structure_lock`, `photographic_setup`, `materials`, `realism_layer` 완벽 해석

## 2. ChatGPT Plus / GPT Image (DALL-E 3)
- JSON 프롬프트를 그대로 입력하거나 문단형으로 입력 가능
- "Do not redesign or move any furniture" 프레이즈 강력 준수

## 3. Midjourney v6 / Flux Kontext
- JSON 형식 프롬프트 지원
- 파라미터: `--ar 16:9 --style raw --v 6.1` 등 결합 사용 가능
