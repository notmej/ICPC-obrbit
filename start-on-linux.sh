#!/bin/bash
set -e
cd "$(dirname "$0")"
if [ ! -d node_modules ]; then npm install; fi
docker compose up -d
[ -f dist/index.html ] && [ -f desktop/dist/main.js ] || npm run build
npm run start
