#!/usr/bin/env bash
#
# Aplica a configuração do nginx do HOST a partir dos templates da release.
#
# Modo HTTP  (padrão): serve a aplicação e o desafio do Let's Encrypt.
# Modo HTTPS (--https): redireciona 80 → 443 e termina o TLS.
#
# Ambiente: APP_ROOT, SITE_NAME, DOMAINS (separados por espaço), CERT_DIR.
# Se a configuração gerada não passar no `nginx -t`, a anterior é restaurada:
# a VPS hospeda outros sites e um reload recusado derrubaria todos.

set -euo pipefail

APP_ROOT="${APP_ROOT:?APP_ROOT não informado}"
SITE_NAME="${SITE_NAME:?SITE_NAME não informado}"
DOMAINS="${DOMAINS:?DOMAINS não informado}"

MODO="http"
[ "${1:-}" = "--https" ] && MODO="https"

RELEASE_DIR="${RELEASE_DIR:-$APP_ROOT/current}"
TEMPLATES="$RELEASE_DIR/docker/nginx/host"
DESTINO="/etc/nginx/sites-available/$SITE_NAME"

DEPLOY_PORT="$(awk -F= '$1=="DEPLOY_PORT"{sub(/^[^=]*=/,"");print;exit}' "$APP_ROOT/.env" | tr -d '\r')"
: "${DEPLOY_PORT:?DEPLOY_PORT ausente no .env}"

mkdir -p /etc/nginx/sites-available /etc/nginx/sites-enabled /var/www/certbot

BACKUP=""
if [ -f "$DESTINO" ]; then
  BACKUP="$(mktemp)"
  cp "$DESTINO" "$BACKUP"
fi

restaurar_e_falhar() {
  echo "Configuração inválida do nginx; restaurando a anterior." >&2
  if [ -n "$BACKUP" ]; then
    cp "$BACKUP" "$DESTINO"
  else
    rm -f "$DESTINO" "/etc/nginx/sites-enabled/$SITE_NAME"
  fi
  nginx -t && systemctl reload nginx
  exit 1
}

export SERVER_NAMES="$DOMAINS"
export DEPLOY_PORT SITE_NAME

if [ "$MODO" = "https" ]; then
  CERT_DIR="${CERT_DIR:?CERT_DIR não informado no modo https}"
  export CERT_DIR

  # O HTTP/2 virou diretiva própria no nginx 1.25.1; antes era parâmetro do
  # `listen`. Emitir a forma errada aborta o `nginx -t`.
  VERSAO="$(nginx -v 2>&1 | sed -n 's#.*nginx/\([0-9.]*\).*#\1#p')"
  if [ -n "$VERSAO" ] && [ "$(printf '%s\n1.25.1\n' "$VERSAO" | sort -V | head -n1)" = "1.25.1" ]; then
    export HTTP2_LISTEN='    listen 443 ssl;'
    export HTTP2_DIRECTIVE='    http2 on;'
  else
    export HTTP2_LISTEN='    listen 443 ssl http2;'
    export HTTP2_DIRECTIVE=''
  fi

  envsubst '${SERVER_NAMES} ${DEPLOY_PORT} ${CERT_DIR} ${SITE_NAME} ${HTTP2_LISTEN} ${HTTP2_DIRECTIVE}' \
    < "$TEMPLATES/rapidinho-https.conf.template" > "$DESTINO"
else
  envsubst '${SERVER_NAMES} ${DEPLOY_PORT}' \
    < "$TEMPLATES/rapidinho-http.conf.template" > "$DESTINO"
fi

ln -sf "$DESTINO" "/etc/nginx/sites-enabled/$SITE_NAME"

nginx -t || restaurar_e_falhar
systemctl reload nginx

echo "Nginx do host em modo $MODO para: $DOMAINS (→ 127.0.0.1:$DEPLOY_PORT)"
