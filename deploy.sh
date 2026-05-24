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
  printf '\n%s\n' "$1"
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
    log "🧠 检测到 swap 已启用，当前内存状态："
    free -h || true
    return
  fi

  log "🧠 正在创建 $SWAP_SIZE swapfile，降低小内存服务器构建失败概率..."
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
  log "-> 安装前端依赖..."
  npm config set registry https://registry.npmmirror.com
  npm install --include=dev --no-audit --no-fund
}

build_frontend() {
  log "-> 打包前端资产，当前 NODE_OPTIONS=$NODE_OPTIONS"
  if [ "$SKIP_TYPECHECK" = "1" ]; then
    log "⚡ 热部署模式：跳过 vue-tsc 类型检查，只执行 Vite 打包..."
    npx vite build
  else
    npm run build
  fi
  log "✅ 前端构建完成，产物位于 /dist 目录。"
}

install_server_dependencies() {
  log "-> 安装后端依赖..."
  cd "$SERVER_DIR"
  npm config set registry https://registry.npmmirror.com
  npm install --include=dev --no-audit --no-fund
}

sync_database() {
  log "-> 生成 Prisma Client..."
  cd "$SERVER_DIR"
  npx prisma generate

  log "-> 应用数据库变更..."
  if [ -f .env ] && grep -Eq '^(DATABASE_URL=.*(mysql|postgresql)://|.*(mysql|postgresql)://)' .env; then
    npx prisma db push --skip-generate
  else
    npx prisma migrate deploy
  fi
}

build_server() {
  log "-> 编译后端 TypeScript..."
  cd "$SERVER_DIR"
  npm run build
  log "✅ 后端构建完成，产物位于 server/dist 目录。"
}

reload_service() {
  log "🔄 正在重启后端服务..."
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
  echo "🚀 开始部署流程..."
  echo "================================================"
  echo "📦 检查 Node 环境..."
  node -v
  npm -v

  echo "================================================"
  mkdir -p "$APP_DIR/logs"
  ensure_swap

  echo "================================================"
  echo "🎨 开始构建前端 (Vue 3 + Vite)..."
  install_root_dependencies
  build_frontend

  echo "================================================"
  echo "🛠️ 开始构建后端 (Node.js + Express)..."
  install_server_dependencies
  sync_database
  build_server

  echo "================================================"
  reload_service

  echo "================================================"
  echo "🎉 部署完成！你的 3D Learning Platform 已经跑起来了！"
  echo ""
  echo "📊 当前服务状态："
  pm2 list
  echo ""
  echo "📋 查看实时日志：pm2 logs 3d-lms-api"
  echo "================================================"
}

main "$@"
