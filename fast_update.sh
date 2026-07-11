#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="${FAST_UPDATE_APP_DIR:-$SCRIPT_DIR}"
TMP_ZIP="$APP_DIR/update.zip"
TMP_DIR="${FAST_UPDATE_TMP_DIR:-/tmp/3d-lms-update-$$}"
SRC_DIR="$TMP_DIR/3d-personal-learning-platform-main"
BACKUP_DIR="$TMP_DIR/previous-release"

URLS=(
  "https://gh-proxy.com/https://github.com/maobukeai/3d-personal-learning-platform/archive/refs/heads/main.zip"
  "https://ghproxy.net/https://github.com/maobukeai/3d-personal-learning-platform/archive/refs/heads/main.zip"
  "https://gh.ddlc.top/https://github.com/maobukeai/3d-personal-learning-platform/archive/refs/heads/main.zip"
  "https://cdn.ghproxy.net/https://github.com/maobukeai/3d-personal-learning-platform/archive/refs/heads/main.zip"
)

bootstrap_from_tmp() {
  if [ "${FAST_UPDATE_BOOTSTRAPPED:-0}" = "1" ]; then
    return
  fi

  local bootstrap_script
  bootstrap_script="/tmp/fast_update_$$.sh"
  cp "${BASH_SOURCE[0]}" "$bootstrap_script"
  chmod +x "$bootstrap_script"
  FAST_UPDATE_BOOTSTRAPPED=1 FAST_UPDATE_APP_DIR="$APP_DIR" exec "$bootstrap_script" "$@"
}

cleanup() {
  rm -rf "$TMP_ZIP" "$TMP_DIR"
  if [ "${FAST_UPDATE_BOOTSTRAPPED:-0}" = "1" ]; then
    rm -f "${BASH_SOURCE[0]}"
  fi
}

sync_excludes() {
  cat <<'EOF'
--exclude .git/
--exclude .env
--exclude server/.env
--exclude node_modules/
--exclude server/node_modules/
--exclude logs/
--exclude server/uploads/
EOF
}

snapshot_current_release() {
  mkdir -p "$BACKUP_DIR"
  if ! command -v rsync >/dev/null 2>&1; then
    echo "ERROR: rsync is required for safe updates and rollback."
    return 1
  fi
  rsync -a --delete $(sync_excludes) "$APP_DIR/" "$BACKUP_DIR/"
}

restore_previous_release() {
  if [ ! -d "$BACKUP_DIR" ]; then
    return 1
  fi
  echo "Deployment failed; restoring the previous application files..."
  rsync -a --delete $(sync_excludes) "$BACKUP_DIR/" "$APP_DIR/"
}

reload_previous_service() {
  if ! command -v pm2 >/dev/null 2>&1; then
    return 0
  fi

  local app_name="${PM2_APP_NAME:-3d-lms-api}"
  if pm2 list | grep -q "$app_name"; then
    echo "Reloading the restored application version..."
    (cd "$APP_DIR" && pm2 startOrReload ecosystem.config.cjs --update-env)
  fi
}

download_latest_code() {
  echo "================================================"
  echo "📥 [1/3] 开始尝试通过多个备用加速节点下载最新代码..."
  rm -f "$TMP_ZIP"

  for url in "${URLS[@]}"; do
    echo "-> 尝试连接节点..."
    if wget -T 20 -t 1 -q --show-progress "$url" -O "$TMP_ZIP"; then
      if ! unzip -tq "$TMP_ZIP" >/dev/null; then
        echo "Downloaded file is not a valid ZIP archive."
        rm -f "$TMP_ZIP"
        continue
      fi
      echo "✅ 下载成功！"
      return 0
    fi
    echo "❌ 该节点超时或失效，正在切换下一个节点..."
  done

  echo "🚨 抱歉，所有节点当前都无法连接，请稍后再试。"
  return 1
}

replace_code() {
  echo "📦 [2/3] 正在解压并安全覆盖旧代码..."
  rm -rf "$TMP_DIR"
  mkdir -p "$TMP_DIR"
  unzip -q "$TMP_ZIP" -d "$TMP_DIR"

  if [ ! -d "$SRC_DIR" ]; then
    echo "🚨 压缩包结构异常：找不到 $SRC_DIR"
    return 1
  fi

  if [ ! -f "$SRC_DIR/package-lock.json" ] || [ ! -f "$SRC_DIR/server/package-lock.json" ]; then
    echo "ERROR: update archive is missing required lockfiles."
    return 1
  fi

  snapshot_current_release

  if command -v rsync >/dev/null 2>&1; then
    rsync -a --delete \
      --exclude '.git/' \
      --exclude '.env' \
      --exclude 'server/.env' \
      --exclude 'node_modules/' \
      --exclude 'server/node_modules/' \
      --exclude 'logs/' \
      --exclude 'server/uploads/' \
      "$SRC_DIR/" "$APP_DIR/"
  else
    echo "⚠️ 未找到 rsync，改用 cp -a 覆盖文件；旧文件不会自动删除。"
    shopt -s dotglob nullglob
    cp -a "$SRC_DIR"/* "$APP_DIR"/
    shopt -u dotglob nullglob
  fi
}

main() {
  bootstrap_from_tmp "$@"
  cd "$APP_DIR"
  trap cleanup EXIT

  download_latest_code
  replace_code

  echo "🚀 [3/3] 代码覆盖完成！开始拉起低内存热部署流程..."
  echo "================================================"
  chmod +x "$APP_DIR/deploy.sh"
  if ! "$APP_DIR/deploy.sh"; then
    restore_previous_release
    reload_previous_service
    exit 1
  fi
}

main "$@"
