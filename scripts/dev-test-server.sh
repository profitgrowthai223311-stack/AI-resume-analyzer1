#!/bin/sh
# Builds and starts the app on :3111 for e2e scripts. Stop with: pkill -f "next start -p 3111"
set -a; . ./.env.local; set +a
npm run build >/dev/null 2>&1 || { echo "build failed"; exit 1; }
npx next start -p 3111 >/tmp/e2e-server.log 2>&1 &
sleep 4
