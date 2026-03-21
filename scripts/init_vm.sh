#!/usr/bin/env bash

set -euo pipefail

APP_USER="${APP_USER:-onetime}"
APP_GROUP="${APP_GROUP:-$APP_USER}"
SERVICE_NAME="${SERVICE_NAME:-1time}"
INSTALL_ROOT="${INSTALL_ROOT:-/opt/1time}"
BIN_DIR="${INSTALL_ROOT}/bin"
STATIC_ROOT="${STATIC_ROOT:-/var/www/1time}"
REDIS_HOST="${REDIS_HOST:-127.0.0.1:6379}"
REDIS_PASS="${REDIS_PASS:-}"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BIN_SOURCE="${REPO_ROOT}/bin/1time"
FRONTEND_SOURCE="${REPO_ROOT}/frontend/build"
UNIT_SOURCE="${REPO_ROOT}/configs/systemd/1time.service"
UNIT_TARGET="/etc/systemd/system/${SERVICE_NAME}.service"

if [[ "${EUID}" -ne 0 ]]; then
    echo "Run this script as root or via sudo." >&2
    exit 1
fi

if ! command -v apt-get >/dev/null 2>&1; then
    echo "This script currently supports Debian/Ubuntu hosts only." >&2
    exit 1
fi

if [[ ! -x "${BIN_SOURCE}" ]]; then
    echo "Missing ${BIN_SOURCE}. Run 'make build' first." >&2
    exit 1
fi

if [[ ! -f "${UNIT_SOURCE}" ]]; then
    echo "Missing ${UNIT_SOURCE}." >&2
    exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y nginx redis-server rsync

if ! id -u "${APP_USER}" >/dev/null 2>&1; then
    adduser --disabled-password --gecos "" "${APP_USER}"
fi

install -d -m 700 -o "${APP_USER}" -g "${APP_GROUP}" "/home/${APP_USER}/.ssh"
install -d -m 755 -o "${APP_USER}" -g "${APP_GROUP}" "${INSTALL_ROOT}" "${BIN_DIR}" "${STATIC_ROOT}"

install -m 0755 -o "${APP_USER}" -g "${APP_GROUP}" "${BIN_SOURCE}" "${BIN_DIR}/1time"

if [[ -d "${FRONTEND_SOURCE}" ]]; then
    rsync -a --delete "${FRONTEND_SOURCE}/" "${STATIC_ROOT}/"
    chown -R "${APP_USER}:${APP_GROUP}" "${STATIC_ROOT}"
else
    echo "Skipping frontend copy: ${FRONTEND_SOURCE} does not exist."
fi

#certbot certonly --manual --preferred-challenges dns -d 1time.io -d '*.1time.io'

tmp_unit="$(mktemp)"
sed \
    -e "s#^User=.*#User=${APP_USER}#" \
    -e "s#^Group=.*#Group=${APP_GROUP}#" \
    -e "s#^WorkingDirectory=.*#WorkingDirectory=${BIN_DIR}#" \
    -e "s#^Environment=REDISHOST=.*#Environment=REDISHOST=${REDIS_HOST}#" \
    -e "s#^Environment=REDISPASS=.*#Environment=REDISPASS=${REDIS_PASS}#" \
    -e "s#^ExecStart=.*#ExecStart=${BIN_DIR}/1time#" \
    "${UNIT_SOURCE}" > "${tmp_unit}"
install -m 0644 "${tmp_unit}" "${UNIT_TARGET}"
rm -f "${tmp_unit}"

systemctl daemon-reload
systemctl enable --now redis-server
systemctl enable --now "${SERVICE_NAME}"

systemctl --no-pager --full status "${SERVICE_NAME}" || true
