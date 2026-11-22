#!/bin/bash
cd "$(dirname "$0")" || exit 1
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
[ -s "$HOME/.nvm/nvm.sh" ] && . "$HOME/.nvm/nvm.sh"
if ! command -v npm >/dev/null 2>&1; then
  echo "Please install Node.js 22 first (nodejs.org)."; read -r; exit 1
fi
if ! command -v docker >/dev/null 2>&1; then
  echo "Please install and start Docker Desktop first."; read -r; exit 1
fi
if [ ! -d node_modules ]; then
  echo "Installing app dependencies..."
  npm install || { echo "Installation failed"; read -r; exit 1; }
fi
docker compose up -d || { echo "Docker must be running. Start Docker Desktop and retry."; read -r; exit 1; }
if [ ! -f dist/index.html ] || [ ! -f desktop/dist/main.js ]; then
  echo "Preparing the desktop app..."
  npm run build || { echo "Build failed"; read -r; exit 1; }
fi
npm run start
