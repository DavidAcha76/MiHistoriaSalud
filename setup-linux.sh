#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT/backend"
[ -f .env ] || { echo 'Configura backend/.env con las credenciales de la base remota.' >&2; exit 1; }
npm ci
cd "$ROOT/frontend"
[ -f .env ] || printf 'EXPO_PUBLIC_API_URL=\n' > .env
npm ci
echo "Listo."
echo "Backend: cd backend && npm run dev"
echo "Web: cd frontend && npm run web"
echo "Android: cd frontend && npm run android"
