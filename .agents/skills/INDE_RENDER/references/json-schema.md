# JSON 프롬프트 스키마 및 템플릿 (PPOK_PHOTOREAL v3.2)

## 1. 전체 JSON 템플릿

```json
{
  "task": "Photograph this existing interior as if it were built and shot on site. This is a photographic re-recording of the attached scene to eliminate CAD line artifacts and flat CGI shading while preserving exact geometry, materials, and lighting.",
  "directive": "The attached image is the ground-truth reference of a real, already-built space. Anchor 100% of the original material identities, finish colors, and textures from the attached reference without altering them, upgrading only their physical material properties (micro-roughness, open pores, weave relief, bevel edge catch) into genuine photographic reality. Maintain the exact intended color temperature of each light source and preserve the authentic illuminance and shadow contrast of the reference scene without artificial over-brightening.",
  "edit_scope": {
    "change": "surface material physical tactile depth, micro-roughness variations, open pores, weave relief, reflectance, light quality and falloff, shadow softness, atmosphere, ceiling drywall texture, indirect LED cove gradient wash, 3D fixture realism, and camera optics",
    "do_not_change": "geometry, layout, object positions, object scale, object count, viewpoint, perspective, framing, original material types and finish colors, intended scene illuminance level, and original lighting color temperature"
  },
  "structure_lock": {
    "camera_and_framing": "exact same camera position, eye level, viewing direction, field of view, vanishing point and crop as the attached image — unchanged",
    "walls_and_openings": "exact wall planes, angles, partition alignments, and the position and size of every window and door — unchanged",
    "ceiling_and_floor": "exact stepped cove ceiling height, ceiling fan position, recessed fixture layout, AC cassette position, and floor tile grid — unchanged",
    "furniture_and_fixtures": "exact position, size, orientation and count of all furniture and built-in elements — unchanged; do not add, remove, or rearrange anything",
    "lighting_fixture_layout": "exact position, type and count of every downlight, track head, and indirect cove LED trough — unchanged",
    "critical_details": [
      "<분석에서 발견된 고유 형태 리스크>"
    ]
  },
  "photographic_setup": {
    "capture_intent": "commissioned interior photography for an architecture and design publication",
    "camera_body": "full-frame professional mirrorless, tripod-mounted and levelled",
    "lens": "24mm perspective-control tilt-shift lens",
    "perspective_control": "lens shift used instead of tilting the camera, so all vertical lines stay strictly parallel and upright — matching the 2-point perspective of the attached image",
    "aperture": "f/8",
    "iso": "100",
    "exposure_technique": "balanced exposure faithfully matching the reference scene illuminance; avoid artificial over-brightening or excessive shadow lifting",
    "white_balance": "calibrated to honor the original light sources (daylight white / neutral white / warm amber as established in the input)",
    "depth_of_field": "deep and razor-sharp from foreground to background — no shallow focus, no bokeh"
  },
  "lighting": {
    "time_of_day": "<원본 조건>",
    "color_temperature": "strictly matches the attached reference (daylight white for cool fixtures, neutral white for clean architectural lights, warm amber for cove/accents)",
    "illuminance_level": "preserves the authentic brightness and contrast ratio of the attached image; if shadows are deep or overall lighting is dimmed/moody, maintain that exact intentional mood without excessive lift",
    "daylight": "<창문 위치 및 자연광 유입 방향>",
    "practicals": "recessed ceiling cove casts a smooth continuous gradient wash matching its original color temperature across the ceiling drywall plane; downlights feature realistic metallic bezels casting soft downward light cones",
    "shadow_behavior": "soft directional shadows with real contact shadows where objects meet the floor; subtle ambient occlusion in corners and under furniture",
    "window_view": "unchanged from the attached image, simply resolved with real photographic exposure and clarity"
  },
  "materials": {
    "material_anchoring_directive": "all materials and finishes are strictly anchored to the attached reference image in color, wood species, and pattern; enhance only their microscopic physical realism and light response",
    "ceiling": "flat matte painted gypsum plasterboard with subtle micro-stipple paint texture, smooth ambient light gradient falloff, clean physical shadow gaps instead of drawn black outline edges",
    "ceiling_fixtures": "recessed downlights with ultra-thin white/metallic bezels; contemporary 3-blade aerodynamic ceiling fan in satin white with 3D sculpted blades; ceiling cassette AC unit with realistic physical louvers and vents; matte black extruded aluminum track rails with cylindrical spotlight heads",
    "floor": "<원본 바닥 재질 계승 + 톤 + 광택 + 미세 물성>",
    "walls": "<원본 벽체 재질 계승 + 톤 + 광택 + 미세 물성>",
    "built_ins": "<붙박이장 / 카운터 / 수납장>",
    "furniture": "<가구 및 의자 재질>",
    "window_frames_and_glass": "<창호 프레임 + 블라인드 / 커튼 + 유리>"
  },
  "realism_layer": {
    "surface_imperfection": "roughness varies subtly across every surface; faint micro-scratches, subtle gloss variations, imperceptible dust settling — barely visible at normal viewing distance, never dirty or worn",
    "edge_behavior": "every edge carries a tiny physical radius/bevel that catches a thin specular highlight; no black CAD outlines or razor-sharp unbevelled corners",
    "optical_signature": "clean rectilinear lens rendering, subtle natural corner light falloff, zero fisheye distortion",
    "lived_in_cues": "<공간 유형에 맞는 자연스러운 단서>",
    "grain": "negligible — clean base-ISO 100 capture, no added digital noise or film grain"
  },
  "added_elements": [],
  "color_grade": {
    "profile": "neutral commercial interior retouch for architectural features",
    "contrast": "moderate; rich darks retain detail and are never crushed",
    "saturation": "restrained and true to the actual finish colours; no boosted artificial color",
    "highlight_rolloff": "smooth and gradual toward the cove lights and windows",
    "shadow_tone": "neutral, no coloured tint in the shadows"
  },
  "output": {
    "aspect_ratio": "identical to the input image — do not crop, pad, extend, or recompose",
    "resolution": "4K",
    "framing_rule": "elements cut off by the frame edge in the input must stay cut off; do not reveal more of the room"
  },
  "negative_prompt": [
    "sketch outlines", "black contour lines", "CAD wireframe edges", "cartoon edges", "visible edge profiles",
    "3D model line overlay", "flat polygon shading", "flat 2D ceiling fan", "flat 2D ceiling cutout",
    "flat 2D track light line", "altered material finish", "replaced texture color", "changed wood species",
    "overexposed lighting", "unwanted brightness boost", "flattened shadow contrast", "distorted color temperature",
    "3D render", "CGI", "V-Ray", "Enscape", "D5 Render", "Lumion", "Unreal Engine",
    "plastic surfaces", "mirror-like floor reflections", "tiled repeating texture", "heavy film grain",
    "shallow depth of field", "tilted verticals", "added or moved furniture", "watermark", "text overlay"
  ],
  "final_check": "Confirm the room in the output preserves 100% of the original material colors and species, lighting temperature, and geometry, while eliminating CAD outlines and rendering physical depth."
}
```
