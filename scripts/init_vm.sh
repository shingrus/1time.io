#!/usr/bin/env bash

set -euo pipefail

APP_USER="${APP_USER:-onetime}"
APP_GROUP="${APP_GROUP:-$APP_USER}"
SERVICE_NAME="${SERVICE_NAME:-1time}"
INSTALL_ROOT="${INSTALL_ROOT:-/opt/1time}"
BIN_DIR="${INSTALL_ROOT}/bin"
FILE_STORAGE_DIR="${FILE_STORAGE_DIR:-${INSTALL_ROOT}/files}"
STATIC_ROOT="${STATIC_ROOT:-/var/www/1time}"
LISTEN_ADDR="${LISTEN_ADDR:-127.0.0.1:8080}"
REDIS_HOST="${REDIS_HOST:-127.0.0.1:6379}"
REDIS_PASS="${REDIS_PASS:-}"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BIN_SOURCE="${REPO_ROOT}/bin/1time-api"
FRONTEND_SOURCE="${REPO_ROOT}/frontend/build"
UNIT_SOURCE="${REPO_ROOT}/configs/systemd/1time.service"
UNIT_TARGET="/etc/systemd/system/${SERVICE_NAME}.service"
NGINX_SOURCE="${REPO_ROOT}/configs/nginx"
NGINX_SITE_TARGET="/etc/nginx/sites-available/1time.conf"
NGINX_SITE_LINK="/etc/nginx/sites-enabled/1time.conf"

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

# 1time.conf includes every file in configs/nginx/snippets/, so a missing
# snippet makes nginx refuse to start rather than degrade. Fail early instead.
if [[ ! -f "${NGINX_SOURCE}/1time.conf" ]]; then
    echo "Missing ${NGINX_SOURCE}/1time.conf." >&2
    exit 1
fi
for snippet in 1time-security-headers.conf 1time-security-headers-sensitive.conf cloudflare-real-ip.conf; do
    if [[ ! -f "${NGINX_SOURCE}/snippets/${snippet}" ]]; then
        echo "Missing ${NGINX_SOURCE}/snippets/${snippet}." >&2
        exit 1
    fi
done

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y nginx redis-server rsync

if ! id -u "${APP_USER}" >/dev/null 2>&1; then
    adduser --disabled-password --gecos "" "${APP_USER}"
fi

install -d -m 700 -o "${APP_USER}" -g "${APP_GROUP}" "/home/${APP_USER}/.ssh"
install -d -m 755 -o "${APP_USER}" -g "${APP_GROUP}" "${INSTALL_ROOT}" "${BIN_DIR}" "${STATIC_ROOT}"
install -d -m 750 -o "${APP_USER}" -g "${APP_GROUP}" "${FILE_STORAGE_DIR}"

install -m 0755 -o "${APP_USER}" -g "${APP_GROUP}" "${BIN_SOURCE}" "${BIN_DIR}/1time-api"

if [[ -d "${FRONTEND_SOURCE}" ]]; then
    rsync -a --delete "${FRONTEND_SOURCE}/" "${STATIC_ROOT}/"
    chown -R "${APP_USER}:${APP_GROUP}" "${STATIC_ROOT}"
else
    echo "Skipping frontend copy: ${FRONTEND_SOURCE} does not exist."
fi

#certbot certonly --manual --preferred-challenges dns -d 1time.io -d '*.1time.io'

# --- nginx configuration -------------------------------------------------
# Snippets keep the same names here as in the repo, so configs/nginx/snippets/
# maps 1:1 onto /etc/nginx/snippets/ and the include paths need no rewriting.
install -d -m 755 /etc/nginx/snippets
install -m 0644 "${NGINX_SOURCE}/snippets/1time-security-headers.conf"           /etc/nginx/snippets/
install -m 0644 "${NGINX_SOURCE}/snippets/1time-security-headers-sensitive.conf" /etc/nginx/snippets/
install -m 0644 "${NGINX_SOURCE}/snippets/cloudflare-real-ip.conf"               /etc/nginx/snippets/
install -m 0644 "${NGINX_SOURCE}/1time.conf" "${NGINX_SITE_TARGET}"
ln -sfn "${NGINX_SITE_TARGET}" "${NGINX_SITE_LINK}"

# Drop a stale unsuffixed link from older installs, which would otherwise
# load the same server_name twice.
if [[ -L /etc/nginx/sites-enabled/1time ]]; then
    rm -f /etc/nginx/sites-enabled/1time
fi

tmp_unit="$(mktemp)"
sed \
    -e "s#^User=.*#User=${APP_USER}#" \
    -e "s#^Group=.*#Group=${APP_GROUP}#" \
    -e "s#^WorkingDirectory=.*#WorkingDirectory=${INSTALL_ROOT}#" \
    -e "s#^Environment=LISTEN_ADDR=.*#Environment=LISTEN_ADDR=${LISTEN_ADDR}#" \
    -e "s#^Environment=REDISHOST=.*#Environment=REDISHOST=${REDIS_HOST}#" \
    -e "s#^Environment=REDISPASS=.*#Environment=REDISPASS=${REDIS_PASS}#" \
    -e "s#^Environment=FILE_STORAGE_DIR=.*#Environment=FILE_STORAGE_DIR=${FILE_STORAGE_DIR}#" \
    -e "s#^ExecStart=.*#ExecStart=${BIN_DIR}/1time-api#" \
    "${UNIT_SOURCE}" > "${tmp_unit}"
install -m 0644 "${tmp_unit}" "${UNIT_TARGET}"
rm -f "${tmp_unit}"

systemctl daemon-reload
systemctl enable --now redis-server
systemctl enable --now "${SERVICE_NAME}"

# Validate before reloading: a missing include or bad directive fails hard,
# and it is better to leave the running config in place than to break it.
nginx -t
systemctl enable --now nginx
systemctl reload nginx

systemctl --no-pager --full status "${SERVICE_NAME}" || true
