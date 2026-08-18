#!/bin/sh
set -e

DOMAIN="${DOMAIN:-aspect-it.ru}"
CERT="/etc/letsencrypt/live/${DOMAIN}/fullchain.pem"

rm -f /etc/nginx/conf.d/default.conf

if [ -f "$CERT" ]; then
    echo "SSL certificate found — enabling HTTPS"
    cp /etc/nginx/templates/ssl.conf /etc/nginx/conf.d/default.conf
else
    echo "No SSL certificate yet — HTTP-only mode (ACME challenge enabled)"
    cp /etc/nginx/templates/http.conf /etc/nginx/conf.d/default.conf
fi
