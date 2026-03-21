#!/bin/sh
set -eu

SITE_ROOT="${SITE_ROOT:-/usr/share/nginx/html}"
APP_HOSTNAME="${APP_HOSTNAME:-1time.io}"

if [ "${APP_HOSTNAME}" = "1time.io" ]; then
    exit 0
fi

escape_replacement() {
    printf '%s' "$1" | sed 's/[&|]/\\&/g'
}

escaped_host="$(escape_replacement "${APP_HOSTNAME}")"

find "${SITE_ROOT}" -type f \
    \( -name '*.html' -o -name '*.js' -o -name '*.json' -o -name '*.txt' -o -name '*.xml' -o -name '*.css' \) \
    | while IFS= read -r file; do
        tmp_file="${file}.tmp"
        sed \
            -e "s|https://1time\\.io|https://${escaped_host}|g" \
            -e "s|1time\\.io|${escaped_host}|g" \
            "${file}" > "${tmp_file}"
        mv "${tmp_file}" "${file}"
    done
