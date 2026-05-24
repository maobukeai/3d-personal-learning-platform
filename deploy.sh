#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$APP_DIR/server"
PM2_APP_NAME="${PM2_APP_NAME:-3d-lms-api}"
NODE_BUILD_MEMORY_MB="${NODE_BUILD_MEMORY_MB:-1536}"
SWAP_SIZE="${SWAP_SIZE:-2G}"
SKIP_TYPECHECK="${SKIP_TYPECHECK:-1}"

export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=$NODE_BUILD_MEMORY_MB}"
export PRISMA_ENGINES_MIRROR="${PRISMA_ENGINES_MIRROR:-https://registry.npmmirror.com/-/binary/prisma}"

log() {
  printf '\n==> %b\n' "$1"
}

run_as_root() {
  if [ "$(id -u)" -eq 0 ]; then
    "$@"
  else
    sudo "$@"
  fi
}

ensure_swap() {
  if swapon --show=NAME --noheadings 2>/dev/null | grep -q '^/swapfile$'; then
    log "\u68c0\u6d4b\u5230 swap \u5df2\u542f\u7528"
    free -h || true
    return
  fi

  log "\u6b63\u5728\u521b\u5efa $SWAP_SIZE swapfile\uff0c\u964d\u4f4e\u5c0f\u5185\u5b58\u670d\u52a1\u5668\u6784\u5efa\u5931\u8d25\u6982\u7387"
  if command -v fallocate >/dev/null 2>&1; then
    run_as_root fallocate -l "$SWAP_SIZE" /swapfile
  else
    run_as_root dd if=/dev/zero of=/swapfile bs=1M count=2048 status=progress
  fi

  run_as_root chmod 600 /swapfile
  run_as_root mkswap /swapfile
  run_as_root swapon /swapfile

  if ! grep -q '^/swapfile ' /etc/fstab 2>/dev/null; then
    printf '/swapfile none swap sw 0 0\n' | run_as_root tee -a /etc/fstab >/dev/null
  fi

  free -h || true
}

install_root_dependencies() {
  log "\u5b89\u88c5\u524d\u7aef\u4f9d\u8d56"
  npm config set registry https://registry.npmmirror.com
  npm install --include=dev --no-audit --no-fund
}

build_frontend() {
  log "\u6784\u5efa\u524d\u7aef\uff0c\u5f53\u524d NODE_OPTIONS=$NODE_OPTIONS"
  if [ "$SKIP_TYPECHECK" = "1" ]; then
    log "\u70ed\u90e8\u7f72\u6a21\u5f0f\uff1a\u8df3\u8fc7 vue-tsc \u7c7b\u578b\u68c0\u67e5\uff0c\u53ea\u6267\u884c Vite \u6253\u5305"
    npx vite build
  else
    npm run build
  fi
}

install_server_dependencies() {
  log "\u5b89\u88c5\u540e\u7aef\u4f9d\u8d56"
  cd "$SERVER_DIR"
  npm config set registry https://registry.npmmirror.com
  npm install --include=dev --no-audit --no-fund
}

sync_database() {
  log "\u751f\u6210 Prisma Client"
  cd "$SERVER_DIR"
  npx prisma generate

  log "\u540c\u6b65\u6570\u636e\u5e93\u7ed3\u6784"
  if [ -f .env ] && grep -Eq '^(DATABASE_URL=.*(mysql|postgresql)://|.*(mysql|postgresql)://)' .env; then
    npx prisma db push --skip-generate
  else
    npx prisma migrate deploy
  fi
}

build_server() {
  log "\u6784\u5efa\u540e\u7aef"
  cd "$SERVER_DIR"
  npm run build
}

reload_service() {
  log "\u91cd\u8f7d PM2 \u670d\u52a1"
  cd "$APP_DIR"

  if pm2 list | grep -q "$PM2_APP_NAME"; then
    pm2 reload ecosystem.config.cjs --update-env
  else
    pm2 start ecosystem.config.cjs
  fi

  pm2 save
  pm2 list
}

main() {
  cd "$APP_DIR"
  log "\u5f00\u59cb\u90e8\u7f72\uff1a$APP_DIR"
  node -v
  npm -v

  mkdir -p "$APP_DIR/logs"
  ensure_swap
  install_root_dependencies
  build_frontend
  install_server_dependencies
  sync_database
  build_server
  reload_service

  log "\u90e8\u7f72\u5b8c\u6210"
}

main "$@"
