#!/bin/sh
# 打包上架用的 zip，只放插件运行需要的文件。运行：sh scripts/package.sh
# 产物在 dist/arxiv-citations-<版本>.zip，版本号取自 manifest.json
set -e
cd "$(dirname "$0")/.."
VERSION=$(python3 -c 'import json; print(json.load(open("manifest.json"))["version"])')
OUT="dist/arxiv-citations-$VERSION.zip"
mkdir -p dist
rm -f "$OUT"
zip -r -X -q "$OUT" \
  manifest.json background.js content.js content.css i18n.js page.css \
  options.html options.js welcome.html welcome.js \
  _locales icons \
  -x '*.DS_Store'
echo "$OUT"
