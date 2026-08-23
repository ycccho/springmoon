#!/usr/bin/env bash
# intranet-style 스킬 설치 — 폴더 복사 한 번이 전부다.
# 기존 스킬을 지우지 않는다(같은 이름이 있으면 .bak-<날짜>로 옮긴다).
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
NAME=intranet-style
DEST="${CLAUDE_SKILLS_DIR:-$HOME/.claude/skills}"

[ -d "$HERE/skill/$NAME" ] || { echo "✗ $HERE/skill/$NAME 이 없습니다 — 압축을 풀고 그 폴더에서 실행하세요"; exit 1; }

mkdir -p "$DEST"
if [ -e "$DEST/$NAME" ]; then
  BAK="$DEST/$NAME.bak-$(date +%Y%m%d-%H%M%S)"
  mv "$DEST/$NAME" "$BAK"
  echo "· 기존 스킬을 옮겨둠: $BAK"
fi
cp -R "$HERE/skill/$NAME" "$DEST/$NAME"

# 설치 검증 — 파일이 하나라도 빠지면 스킬이 값을 못 찾는다(빠진 걸 나중에 알면 늦다).
MISSING=0
for f in SKILL.md reference/README.md reference/01-tokens.md reference/02-primitives.md \
         reference/03-shell-layout.md reference/04-page-templates.md; do
  [ -f "$DEST/$NAME/$f" ] || { echo "✗ 빠짐: $f"; MISSING=1; }
done
[ "$MISSING" = 0 ] || { echo "✗ 설치 불완전 — 압축 파일을 다시 받아 주세요"; exit 1; }

echo "✓ 설치 완료: $DEST/$NAME  (스펙 문서 5종 포함)"
echo "  사용: \"인트라넷 스타일로 만들어줘\" / \"인트라넷처럼\" / \"우리 인트라넷 디자인으로\""
echo "  MCP·재시작 불필요. 현재 세션에서 안 보이면 새 세션에서 잡힙니다."
