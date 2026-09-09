#!/bin/sh
set -eu

# Substitui apenas as variáveis de domínio: as demais ($host, $remote_addr...)
# são do próprio nginx e precisam chegar intactas no arquivo final.
envsubst '${WEB_DOMAIN} ${ADMIN_DOMAIN}' \
  < /etc/nginx/nginx.conf.template \
  > /etc/nginx/nginx.conf

nginx -t

exec "$@"
