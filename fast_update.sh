#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TMP_ZIP="$APP_DIR/update.zip"
TMP_DIR="$APP_DIR/.update_extract"
SRC_DIR="$TMP_DIR/3d-personal-learning-platform-main"

URLS=(
  "https://gh-proxy.com/https://github.com/maobukeai/3d-personal-learning-platform/archive/refs/heads/main.zip"
  "https://ghproxy.net/https://github.com/maobukeai/3d-personal-learning-platform/archive/refs/heads/main.zip"
  "https://gh.ddlc.top/https://github.com/maobukeai/3d-personal-learning-platform/archive/refs/heads/main.zip"
  "https://cdn.ghproxy.net/https://github.com/maobukeai/3d-personal-learning-platform/archive/refs/heads/main.zip"
)

log() {
  printf '\n==> %s\n' "$1"
}

cleanup() {
  rm -rf "$TMP_ZIP" "$TMP_DIR"
}

download_latest_code() {
  log "下载最新代码"
  rm -f "$TMP_ZIP"

  for url in "${URLS[@]}"; do
    printf '尝试下载节点：%s\n' "$url"
    if wget -T 20 -t 1 -q --show-progress "$url" -O "$TMP_ZIP"; then
      log "代码下载完成"
      return 0
    fi
  done

  echo "所有下载节点都失败了，请稍后再试。"
  return 1
}

replace_code() {
  log "覆盖应用代码"
  rm -rf "$TMP_DIR"
  mkdir -p "$TMP_DIR"
  unzip -q "$TMP_ZIP" -d "$TMP_DIR"

  if [ ! -d "$SRC_DIR" ]; then
    echo "压缩包结构异常：找不到 $SRC_DIR"
    return 1
  fi

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
    echo "未找到 rsync，改用 cp -a 覆盖文件；旧文件不会自动删除。"
    shopt -s dotglob nullglob
    cp -a "$SRC_DIR"/* "$APP_DIR"/
    shopt -u dotglob nullglob
  fi
}

main() {
  cd "$APP_DIR"
  trap cleanup EXIT

  download_latest_code
  replace_code

  log "开始一键低内存热部署"
  chmod +x "$APP_DIR/deploy.sh"
  "$APP_DIR/deploy.sh"
}

main "$@"
