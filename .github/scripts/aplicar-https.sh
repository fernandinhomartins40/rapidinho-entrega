#!/usr/bin/env bash
#
# Troca a configuração do nginx do host para HTTPS, depois que o certificado
# existe. Só entram os domínios que estão de fato no certificado: listar um
# domínio sem cobertura faz o nginx servir o certificado errado e o navegador
# acusar site inseguro.

set -euo pipefail

APP_ROOT="${APP_ROOT:?APP_ROOT não informado}"
SITE_NAME="${SITE_NAME:?SITE_NAME não informado}"
PRIMARY_DOMAIN="${PRIMARY_DOMAIN:?PRIMARY_DOMAIN não informado}"
WWW_DOMAIN="${WWW_DOMAIN:-}"
ADMIN_DOMAIN="${ADMIN_DOMAIN:-}"

CERT_DIR="/etc/letsencrypt/live/${PRIMARY_DOMAIN}"

if [ ! -f "$CERT_DIR/fullchain.pem" ]; then
  echo "Sem certificado ainda; a configuração HTTP continua valendo."
  exit 0
fi

DOMINIOS=""
for dominio in "$PRIMARY_DOMAIN" "$WWW_DOMAIN" "$ADMIN_DOMAIN"; do
  [ -z "$dominio" ] && continue
  if openssl x509 -in "$CERT_DIR/fullchain.pem" -noout -text | grep -q "DNS:${dominio}\b"; then
    DOMINIOS="$DOMINIOS $dominio"
  else
    echo "Aviso: ${dominio} não está no certificado; fica fora do HTTPS." >&2
  fi
done

DOMINIOS="$(echo "$DOMINIOS" | xargs)"

if [ -z "$DOMINIOS" ]; then
  echo "::warning::O certificado não cobre nenhum domínio esperado; mantendo HTTP." >&2
  exit 0
fi

APP_ROOT="$APP_ROOT" SITE_NAME="$SITE_NAME" DOMAINS="$DOMINIOS" CERT_DIR="$CERT_DIR" \
  bash "$APP_ROOT/current/.github/scripts/configurar-nginx.sh" --https
