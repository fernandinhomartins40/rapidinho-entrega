#!/usr/bin/env bash
#
# Conferência final: mostra o estado dos containers e testa a aplicação por
# dentro (loopback) e por fora (domínio público).

set -uo pipefail

APP_ROOT="${APP_ROOT:?APP_ROOT não informado}"
PRIMARY_DOMAIN="${PRIMARY_DOMAIN:?PRIMARY_DOMAIN não informado}"
ADMIN_DOMAIN="${ADMIN_DOMAIN:-}"

DEPLOY_PORT="$(awk -F= '$1=="DEPLOY_PORT"{sub(/^[^=]*=/,"");print;exit}' "$APP_ROOT/.env" | tr -d '\r')"

echo "── Containers ──"
cd "$APP_ROOT/current"
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps

echo
echo "── Saúde interna (127.0.0.1:${DEPLOY_PORT}) ──"
if curl -fsS --max-time 10 "http://127.0.0.1:${DEPLOY_PORT}/api/health"; then
  echo
else
  echo "::error::A aplicação não responde nem no loopback." >&2
  docker compose -f docker-compose.yml -f docker-compose.prod.yml logs --tail=60 nginx web admin >&2
  exit 1
fi

echo
echo "── Domínio público ──"
FALHAS=0

for dominio in "$PRIMARY_DOMAIN" "$ADMIN_DOMAIN"; do
  [ -z "$dominio" ] && continue

  if curl -fsS --max-time 15 "https://${dominio}/api/health" >/dev/null 2>&1; then
    echo "  https://${dominio} → OK"
  elif curl -fsS --max-time 15 "http://${dominio}/api/health" >/dev/null 2>&1; then
    echo "  http://${dominio} → OK (ainda sem HTTPS)"
  else
    echo "  ${dominio} → não respondeu" >&2
    FALHAS=$((FALHAS + 1))
  fi
done

if [ "$FALHAS" -gt 0 ]; then
  # Aviso, não erro: a aplicação está no ar e o problema costuma ser DNS de um
  # subdomínio que ainda não foi criado.
  echo "::warning::${FALHAS} domínio(s) não responderam. Confira DNS e certificado." >&2
fi


echo
echo "── Cabeçalhos de segurança ──"
# A CSP é montada no middleware com valores que o Next fixa no BUILD. Se a URL
# do socket não chegar como build arg, a política sobe sem ela e o tempo real é
# bloqueado pelo navegador — com a página carregando normalmente, que é o tipo
# de falha que ninguém percebe até o lojista reclamar que o pedido não aparece.
SOCKET_URL="$(awk -F= '$1=="NEXT_PUBLIC_SOCKET_URL"{sub(/^[^=]*=/,"");print;exit}' "$APP_ROOT/.env" | tr -d '\r')"
# A CSP lista a ORIGEM, sem barra final: comparar com a URL como está no .env
# daria falso negativo se alguém a escrever com "/" no fim.
SOCKET_URL="${SOCKET_URL%/}"
CSP="$(curl -fsS --max-time 10 -o /dev/null -D - "http://127.0.0.1:${DEPLOY_PORT}/" 2>/dev/null \
  | tr -d '\r' | grep -i '^content-security-policy:' || true)"

if [ -z "$CSP" ]; then
  echo "::error::A resposta não trouxe Content-Security-Policy — o middleware não rodou." >&2
  exit 1
fi

case "$CSP" in
  *"nonce-"*) echo "  CSP com nonce → OK" ;;
  *) echo "::error::A CSP saiu sem nonce; os scripts do Next seriam bloqueados." >&2; exit 1 ;;
esac

if [ -n "$SOCKET_URL" ] && ! printf '%s' "$CSP" | grep -qF "$SOCKET_URL"; then
  echo "::error::A CSP não libera ${SOCKET_URL}: o tempo real seria bloqueado no navegador." >&2
  echo "  Política recebida: $CSP" >&2
  exit 1
fi

echo "  connect-src cobre ${SOCKET_URL:-(não configurado)} → OK"

echo
echo "Deploy verificado."
