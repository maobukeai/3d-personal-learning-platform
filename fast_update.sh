#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="${FAST_UPDATE_APP_DIR:-$SCRIPT_DIR}"
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
  printf '\n==> %b\n' "$1"
}

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

download_latest_code() {
  log "\u4e0b\u8f7d\u6700\u65b0\u4ee3\u7801"
  rm -f "$TMP_ZIP"

  for url in "${URLS[@]}"; do
    printf '%b%s\n' "\u5c1d\u8bd5\u4e0b\u8f7d\u8282\u70b9: " "$url"
    if wget -T 20 -t 1 -q --show-progress "$url" -O "$TMP_ZIP"; then
      log "\u4ee3\u7801\u4e0b\u8f7d\u5b8c\u6210"
      return 0
    fi
  done

  printf '%b\n' "\u6240\u6709\u4e0b\u8f7d\u8282\u70b9\u90fd\u5931\u8d25\u4e86\uff0c\u8bf7\u7a0d\u540e\u518d\u8bd5\u3002"
  return 1
}

replace_code() {
  log "\u8986\u76d6\u5e94\u7528\u4ee3\u7801"
  rm -rf "$TMP_DIR"
  mkdir -p "$TMP_DIR"
  unzip -q "$TMP_ZIP" -d "$TMP_DIR"

  if [ ! -d "$SRC_DIR" ]; then
    printf '%b%s\n' "\u538b\u7f29\u5305\u7ed3\u6784\u5f02\u5e38\uff1a\u627e\u4e0d\u5230 " "$SRC_DIR"
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
    printf '%b\n' "\u672a\u627e\u5230 rsync\uff0c\u6539\u7528 cp -a \u8986\u76d6\u6587\u4ef6\uff1b\u65e7\u6587\u4ef6\u4e0d\u4f1a\u81ea\u52a8\u5220\u9664\u3002"
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

  log "\u5f00\u59cb\u4e00\u952e\u4f4e\u5185\u5b58\u70ed\u90e8\u7f72"
  chmod +x "$APP_DIR/deploy.sh"
  "$APP_DIR/deploy.sh"
}

main "$@"
