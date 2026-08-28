#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT/backend"
[ -f .env ] || cp .env.example .env
npm install
npm run db:setup
cd "$ROOT/frontend"
[ -f .env ] || cp .env.example .env
npm install
npx expo install --fix
echo "Listo."
echo "Backend: cd backend && npm run dev"
echo "Web: cd frontend && npm run web"
echo "Android: cd frontend && npm run android"
