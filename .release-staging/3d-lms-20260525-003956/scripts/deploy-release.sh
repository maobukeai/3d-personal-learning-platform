#!/usr/bin/env bash
set -Eeuo pipefail

RELEASE_SOURCE="${1:-}"
APP_DIR="${2:-$(pwd)}"
PM2_APP_NAME="${PM2_APP_NAME:-3d-lms-api}"
PRISMA_ENGINES_MIRROR="${PRISMA_ENGINES_MIRROR:-https://registry.npmmirror.com/-/binary/prisma}"

if [ -z "$RELEASE_SOURCE" ]; then
  echo "Usage: bash scripts/deploy-release.sh <release-dir-or-zip> [app-dir]"
  exit 1
fi

if [ ! -e "$RELEASE_SOURCE" ]; then
  echo "Release source not found: $RELEASE_SOURCE"
  exit 1
fi

if [ ! -d "$APP_DIR" ]; then
  echo "Application directory not found: $APP_DIR"
  exit 1
fi

TMP_DIR=""
cleanup() {
  if [ -n "$TMP_DIR" ] && [ -d "$TMP_DIR" ]; then
    rm -rf "$TMP_DIR"
  fi
}
trap cleanup EXIT

if [ -f "$RELEASE_SOURCE" ]; then
  TMP_DIR="$(mktemp -d)"
  unzip -q "$RELEASE_SOURCE" -d "$TMP_DIR"
  RELEASE_DIR="$TMP_DIR"
else
  RELEASE_DIR="$RELEASE_SOURCE"
fi

required_paths=(
  "dist"
  "server/dist"
  "server/prisma"
  "server/package.json"
  "server/package-lock.json"
  "ecosystem.config.cjs"
)

for path in "${required_paths[@]}"; do
  if [ ! -e "$RELEASE_DIR/$path" ]; then
    echo "Release package is missing: $path"
    exit 1
  fi
done

cd "$APP_DIR"
mkdir -p logs server

echo "==> Installing prebuilt frontend assets"
rm -rf .deploy-new-dist
cp -a "$RELEASE_DIR/dist" .deploy-new-dist
rm -rf dist.previous
if [ -d dist ]; then
  mv dist dist.previous
fi
mv .deploy-new-dist dist

echo "==> Installing prebuilt server files"
rm -rf server/.deploy-new-dist
cp -a "$RELEASE_DIR/server/dist" server/.deploy-new-dist
rm -rf server/dist.previous
if [ -d server/dist ]; then
  mv server/dist server/dist.previous
fi
mv server/.deploy-new-dist server/dist
cp -a "$RELEASE_DIR/server/prisma" server/prisma
cp -a "$RELEASE_DIR/server/package.json" server/package.json
cp -a "$RELEASE_DIR/server/package-lock.json" server/package-lock.json
cp -a "$RELEASE_DIR/ecosystem.config.cjs" ecosystem.config.cjs

echo "==> Installing production server dependencies"
export PRISMA_ENGINES_MIRROR
cd server
npm ci --omit=dev

echo "==> Generating Prisma client"
npx prisma generate

echo "==> Applying database schema"
if [ -f .env ] && (grep -q "mysql://" .env || grep -q "postgresql://" .env); then
  npx prisma db push --skip-generate
else
  npx prisma migrate deploy
fi

cd "$APP_DIR"

echo "==> Reloading PM2 service"
if pm2 list | grep -q "$PM2_APP_NAME"; then
  pm2 reload ecosystem.config.cjs --update-env
else
  pm2 start ecosystem.config.cjs
fi
pm2 save

echo "==> Cleaning previous build backups"
rm -rf dist.previous server/dist.previous

echo "Release deployed successfully."
