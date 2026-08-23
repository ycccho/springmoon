#!/usr/bin/env bash
# ui-inspector 설치 — 2단계다.
#   1) 스킬 복사 (파일만, 실패할 게 없다)
#   2) MCP 서버 설치 (공개 저장소 clone + npm install + 등록) — 네트워크가 필요하고 실패할 수 있다
# 2단계가 실패해도 1단계는 되돌리지 않는다. 스킬만 먼저 넣으려면 --skill-only.
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
NAME=ui-inspector
DEST="${CLAUDE_SKILLS_DIR:-$HOME/.claude/skills}"
SRV_DIR="${UI_INSPECTOR_DIR:-$HOME/ui-inspector}"
REPO=https://github.com/beyondworks/UI-Inspector.git

# ── 1단계: 스킬 ────────────────────────────────────────────────────────────
[ -d "$HERE/skill/$NAME" ] || { echo "✗ $HERE/skill/$NAME 이 없습니다 — 압축을 풀고 그 폴더에서 실행하세요"; exit 1; }
mkdir -p "$DEST"
if [ -e "$DEST/$NAME" ]; then
  BAK="$DEST/$NAME.bak-$(date +%Y%m%d-%H%M%S)"
  mv "$DEST/$NAME" "$BAK"
  echo "· 기존 스킬을 옮겨둠: $BAK"
fi
cp -R "$HERE/skill/$NAME" "$DEST/$NAME"
for f in SKILL.md references/hermes-next-attach.md references/visual-rhythm-qa.md; do
  [ -f "$DEST/$NAME/$f" ] || { echo "✗ 빠짐: $f — 압축 파일을 다시 받아 주세요"; exit 1; }
done
echo "✓ 1/2 스킬 설치: $DEST/$NAME"

[ "${1:-}" = "--skill-only" ] && { echo "· MCP 서버는 건너뜁니다(--skill-only). 나중에 인자 없이 다시 실행하세요."; exit 0; }

# ── 2단계: MCP 서버 ────────────────────────────────────────────────────────
# 이 스킬의 도구(preview_attach·inspector_get_selection 등)는 MCP 서버가 있어야 동작한다.
command -v git >/dev/null || { echo "✗ git이 없습니다 — 설치 후 다시 실행하세요"; exit 1; }
command -v npm >/dev/null || { echo "✗ npm(Node.js)이 없습니다 — Node 20+ 설치 후 다시 실행하세요"; exit 1; }

if [ -d "$SRV_DIR/.git" ]; then
  echo "· 이미 있음: $SRV_DIR — 최신으로 당깁니다"
  git -C "$SRV_DIR" pull --ff-only >/dev/null 2>&1 || echo "  (pull 실패 — 기존 버전 그대로 씁니다)"
else
  [ -e "$SRV_DIR" ] && { echo "✗ $SRV_DIR 가 이미 있는데 git 저장소가 아닙니다. UI_INSPECTOR_DIR=<다른경로>로 지정하세요"; exit 1; }
  echo "· 저장소 clone → $SRV_DIR"
  git clone --depth 1 "$REPO" "$SRV_DIR" >/dev/null 2>&1 || { echo "✗ clone 실패(네트워크·권한 확인)"; exit 1; }
fi

echo "· 의존성 설치 (수십 MB, 1~2분)"
( cd "$SRV_DIR/servers" && npm install --silent ) || { echo "✗ npm install 실패 — $SRV_DIR/servers 에서 직접 실행해 보세요"; exit 1; }

ENTRY="$SRV_DIR/servers/inspector-server.mjs"
[ -f "$ENTRY" ] || { echo "✗ 서버 파일이 없습니다: $ENTRY"; exit 1; }

if command -v claude >/dev/null; then
  # -s user = 이 계정의 모든 프로젝트에서 쓰인다. 이미 등록돼 있으면 실패하는데 그건 정상이다.
  claude mcp add -s user ui-inspector -- node "$ENTRY" >/dev/null 2>&1 \
    && echo "✓ 2/2 MCP 등록 완료 (ui-inspector)" \
    || echo "· MCP 등록 건너뜀 — 이미 등록돼 있거나 자동 등록 실패. 아래를 직접 실행하세요:
    claude mcp add -s user ui-inspector -- node \"$ENTRY\""
else
  echo "· claude CLI를 못 찾았습니다. 클로드 코드에서 아래를 실행하세요:
    claude mcp add -s user ui-inspector -- node \"$ENTRY\""
fi

echo
echo "▶ 마지막 한 걸음: **클로드 코드를 재시작**하세요 (MCP 서버는 재시작해야 붙습니다)."
echo "  확인: 재시작 후 \"프리뷰 띄워줘\" 또는 preview_attach 호출."
