#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# deploy.sh — 3D Personal Learning Platform 一键部署脚本
#
# 变更日志:
# 2026-07-09  重构部署: BullMQ 队列化 (draco-compression/thumbnail-localize/
#             thumbnail-cleanup)、Zod 全量路由验证、material view-file 端点、
#             Socket.io job_progress 按 userId 定向推送、safeUnlink 共享 helper
# ─────────────────────────────────────────────────────────────────────────────
set -Eeuo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$APP_DIR/server"
WEBSITE_DIR="$APP_DIR/website"
WEBSITE_OUTPUT_DIR="$WEBSITE_DIR/.output"
WEBSITE_STAGING_DIR="$WEBSITE_DIR/.output-next"
WEBSITE_PREVIOUS_DIR="$WEBSITE_DIR/.output-previous"
PM2_APP_NAME="${PM2_APP_NAME:-3d-lms-api}"
OFFICIAL_SITE_APP_NAME="${OFFICIAL_SITE_APP_NAME:-3d-lms-official-site}"
NODE_BUILD_MEMORY_MB="${NODE_BUILD_MEMORY_MB:-1536}"
SWAP_SIZE="${SWAP_SIZE:-2G}"
# Skip frontend type-checking by default to keep memory use within the
# production server's limit. Set SKIP_TYPECHECK=0 for a full release check.
SKIP_TYPECHECK="${SKIP_TYPECHECK:-1}"
# Use only while recovering a failed migration history. The database migration
# must then be completed manually before the next normal deployment.
SKIP_MIGRATIONS="${SKIP_MIGRATIONS:-0}"

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
  npm ci --include=dev --no-audit --no-fund
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

build_official_site() {
  if [ ! -f "$WEBSITE_DIR/package.json" ]; then
    log "-> Official site directory not present; skipping official site build."
    return
  fi

  log "-> Installing official site dependencies..."
  cd "$WEBSITE_DIR"
  npm config set registry https://registry.npmmirror.com
  npm ci --include=dev --no-audit --no-fund

  log "-> Building official site (Nuxt SSR) into an isolated staging directory..."
  rm -rf "$WEBSITE_STAGING_DIR"
  NITRO_OUTPUT_DIR="$WEBSITE_STAGING_DIR" npm run build
  if [ ! -f "$WEBSITE_STAGING_DIR/server/index.mjs" ]; then
    log "Official site build is incomplete: missing $WEBSITE_STAGING_DIR/server/index.mjs"
    return 1
  fi
  log "Official site staging build complete: website/.output-next"
}

activate_official_site() {
  if [ ! -d "$WEBSITE_STAGING_DIR" ]; then
    return
  fi

  log "-> Activating the prebuilt official site release..."
  rm -rf "$WEBSITE_PREVIOUS_DIR"
  if pm2 list | grep -q "$OFFICIAL_SITE_APP_NAME"; then
    pm2 stop "$OFFICIAL_SITE_APP_NAME"
  fi
  if [ -d "$WEBSITE_OUTPUT_DIR" ]; then
    mv "$WEBSITE_OUTPUT_DIR" "$WEBSITE_PREVIOUS_DIR"
  fi
  mv "$WEBSITE_STAGING_DIR" "$WEBSITE_OUTPUT_DIR"
}

rollback_official_site() {
  if [ ! -d "$WEBSITE_PREVIOUS_DIR" ]; then
    return
  fi

  log "Official site verification failed; restoring the previous build..."
  pm2 stop "$OFFICIAL_SITE_APP_NAME" >/dev/null 2>&1 || true
  rm -rf "$WEBSITE_OUTPUT_DIR"
  mv "$WEBSITE_PREVIOUS_DIR" "$WEBSITE_OUTPUT_DIR"
  (cd "$APP_DIR" && pm2 startOrReload ecosystem.config.cjs --only "$OFFICIAL_SITE_APP_NAME" --update-env) || true
}

finalize_official_site() {
  rm -rf "$WEBSITE_PREVIOUS_DIR"
}

install_server_dependencies() {
  log "-> 安装后端依赖..."
  cd "$SERVER_DIR"
  npm config set registry https://registry.npmmirror.com
  npm ci --include=dev --no-audit --no-fund
}

generate_client() {
  log "-> 生成 Prisma Client..."
  cd "$SERVER_DIR"
  npx prisma generate
}

run_migrations() {
  log "-> 应用数据库变更..."
  cd "$SERVER_DIR"
  npx prisma migrate deploy
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
    # startOrReload reloads existing apps and creates newly-added entries such
    # as the queue worker. `reload` alone leaves a new process undefined.
    pm2 startOrReload ecosystem.config.cjs --update-env
  else
    pm2 start ecosystem.config.cjs
  fi

  pm2 save
  pm2 list
}

verify_service() {
  log "-> Verifying API and official-site health endpoints..."
  local attempts=20
  local delay_seconds=2
  local api_health_url="${HEALTHCHECK_URL:-http://127.0.0.1:${PORT:-3001}/health}"
  local website_health_url="${WEBSITE_HEALTHCHECK_URL:-http://127.0.0.1:${OFFICIAL_SITE_PORT:-3002}/}"
  local url

  for url in "$api_health_url" "$website_health_url"; do
    local passed=0
    for ((attempt = 1; attempt <= attempts; attempt++)); do
      if curl --fail --silent --show-error --max-time 5 "$url" >/dev/null; then
        log "Health check passed: $url"
        passed=1
        break
      fi
      sleep "$delay_seconds"
    done
    if [ "$passed" -ne 1 ]; then
      log "Service did not become healthy after $((attempts * delay_seconds)) seconds: $url"
      return 1
    fi
  done
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
  echo "🌐 Building official site (Nuxt)..."
  build_official_site

  echo "================================================"
  echo "🛠️ 开始构建后端 (Node.js + Express)..."
  install_server_dependencies
  generate_client
  build_server
  if [ "$SKIP_MIGRATIONS" = "1" ]; then
    log "Skipping database migrations for recovery. Run prisma migrate deploy manually before the next normal deployment."
  else
    run_migrations
  fi

  echo "================================================"
  activate_official_site
  if ! reload_service || ! verify_service; then
    rollback_official_site
    return 1
  fi
  finalize_official_site

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
