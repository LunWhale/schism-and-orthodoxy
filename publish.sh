#!/usr/bin/env bash
# 一键发布到 GitHub Pages。
# 用法：GH_TOKEN=<你的 token> ./publish.sh
# 做的事：构建 → 组装发布目录 → 提交 → 推送 main（Pages 会自动重新部署）
set -euo pipefail

REPO_SLUG="${REPO_SLUG:-LunWhale/schism-and-orthodoxy}"
BRANCH="${BRANCH:-main}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

if [ -z "${GH_TOKEN:-}" ]; then
  echo "缺少 GH_TOKEN。用法：GH_TOKEN=<token> ./publish.sh" >&2
  exit 1
fi

echo "▸ 构建"
( cd "$HERE" && node build/build.js && node build/check.js )

echo "▸ 组装发布目录"
cp "$HERE/基督教思想分裂史.html" "$STAGE/index.html"
cp -R "$HERE/data" "$HERE/build" "$STAGE/" 2>/dev/null || true
mkdir -p "$STAGE/source" && cp -R "$HERE/data" "$HERE/build" "$STAGE/source/"
touch "$STAGE/.nojekyll"
[ -f "$HERE/README.md" ] && cp "$HERE/README.md" "$STAGE/" || true

echo "▸ 提交"
cd "$STAGE"
git init -q -b "$BRANCH"
git config user.email "LunWhale@users.noreply.github.com"
git config user.name "LunWhale"
git add -A
git -c commit.gpgsign=false commit -q -m "更新：$(date '+%Y-%m-%d %H:%M')"
git push -q -f "https://x-access-token:${GH_TOKEN}@github.com/${REPO_SLUG}.git" "$BRANCH"

echo "✓ 已推送。Pages 通常 30–90 秒后生效："
echo "  https://$(echo "$REPO_SLUG" | cut -d/ -f1 | tr '[:upper:]' '[:lower:]').github.io/$(echo "$REPO_SLUG" | cut -d/ -f2)/"
