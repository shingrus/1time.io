#!/bin/sh

if [ "$DEBUG" = "true" ]; then
    echo "BURST_SIZE: ${BURST_SIZE}"
    echo "BACKEND_UPSTREAM: ${BACKEND_UPSTREAM}"
    echo "MAX_FILE_SIZE_MB: ${MAX_FILE_SIZE_MB}"
    echo "APP_HOSTNAME: ${APP_HOSTNAME}"
    echo "NGINX_PORT: ${NGINX_PORT}"
    echo "SITE_ROOT: ${SITE_ROOT}"

    cat /etc/nginx/conf.d/default.conf
fi