#!/usr/bin/env bash
#
# Emite o certificado Let's Encrypt e garante que a renovação está armada.
#
# Este script NUNCA derruba o deploy: a aplicação já está no ar quando ele
# roda, e um problema de DNS ou de lock do certbot não deve reverter uma
# release boa. Falhas viram aviso.

set -uo pipefail

PRIMARY_DOMAIN="${PRIMARY_DOMAIN:?PRIMARY_DOMAIN não informado}"
WWW_DOMAIN="${WWW_DOMAIN:-}"
ADMIN_DOMAIN="${ADMIN_DOMAIN:-}"
SSL_EMAIL="${SSL_EMAIL:?SSL_EMAIL não informado}"
VPS_HOST="${VPS_HOST:?VPS_HOST não informado}"

mkdir -p /var/www/certbot

# A VPS roda os timers de renovação de dezenas de domínios. Matar o certbot
# aqui abortaria a renovação de OUTROS sites no meio do caminho.
aguardar_certbot() {
  local esperou=0
  while pgrep -x certbot >/dev/null 2>&1; do
    if [ "$esperou" -ge 180 ]; then
      echo "Outro certbot segue rodando após 180s; pulando a emissão." >&2
      return 1
    fi
    echo "Aguardando outra instância do certbot (${esperou}s)..."
    sleep 10
    esperou=$((esperou + 10))
  done
  return 0
}

# Um domínio que não aponta para esta VPS faz a Let's Encrypt recusar o PEDIDO
# INTEIRO. Então só entram os que resolvem para cá — na prática, o registro do
# painel costuma ser o que ainda falta criar.
ARGS=""
for dominio in "$PRIMARY_DOMAIN" "$WWW_DOMAIN" "$ADMIN_DOMAIN"; do
  [ -z "$dominio" ] && continue

  ip="$(getent hosts "$dominio" 2>/dev/null | awk '{print $1}' | head -1)"
  if [ "$ip" = "$VPS_HOST" ]; then
    ARGS="$ARGS -d $dominio"
    echo "DNS confere: $dominio -> $ip"
  else
    echo "Aviso: $dominio resolve para '${ip:-nada}', não para $VPS_HOST. Fica fora do certificado." >&2
  fi
done

if [ -z "$ARGS" ]; then
  echo "::warning::Nenhum domínio aponta para a VPS. O site segue em HTTP." >&2
  exit 0
fi

if [ -f "/etc/letsencrypt/live/${PRIMARY_DOMAIN}/fullchain.pem" ]; then
  echo "Certificado já existe para ${PRIMARY_DOMAIN}."

  # Domínio novo no DNS (o painel, tipicamente) não entra sozinho num
  # certificado já emitido: --expand acrescenta sem recomeçar do zero.
  for dominio in "$WWW_DOMAIN" "$ADMIN_DOMAIN"; do
    [ -z "$dominio" ] && continue
    case "$ARGS" in *"-d $dominio"*) ;; *) continue ;; esac

    if ! openssl x509 -in "/etc/letsencrypt/live/${PRIMARY_DOMAIN}/fullchain.pem" \
         -noout -text 2>/dev/null | grep -q "DNS:${dominio}\b"; then
      echo "Domínio ${dominio} ainda não está no certificado; ampliando."
      if aguardar_certbot; then
        # shellcheck disable=SC2086
        certbot certonly --webroot -w /var/www/certbot $ARGS \
          --cert-name "$PRIMARY_DOMAIN" --expand \
          --email "$SSL_EMAIL" --agree-tos --non-interactive \
          || echo "::warning::Não foi possível ampliar o certificado agora." >&2
      fi
      break
    fi
  done
else
  if aguardar_certbot; then
    # shellcheck disable=SC2086
    certbot certonly --webroot -w /var/www/certbot $ARGS \
      --cert-name "$PRIMARY_DOMAIN" \
      --email "$SSL_EMAIL" --agree-tos --non-interactive \
      || echo "::warning::certbot falhou; o site segue em HTTP neste deploy." >&2
  fi
fi

# Sem este hook, depois de renovar o nginx segue servindo o certificado velho
# que tem em memória — e o site cai por "certificado vencido" com o arquivo
# novo já em disco.
mkdir -p /etc/letsencrypt/renewal-hooks/deploy
printf '%s\n' '#!/bin/sh' 'systemctl reload nginx' \
  > /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
chmod +x /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh

if systemctl list-unit-files 2>/dev/null | grep -q '^certbot.timer'; then
  systemctl enable --now certbot.timer
  echo "Renovação automática pelo certbot.timer."
elif [ -f /etc/cron.d/certbot ]; then
  echo "Renovação automática pelo cron do pacote."
else
  printf '%s\n' '0 3 * * * root certbot renew --quiet --webroot -w /var/www/certbot' \
    > /etc/cron.d/certbot-rapidinho
  echo "Cron de renovação criado."
fi

# Confere que o webroot do desafio está sendo servido. É um GET simples de
# propósito: `certbot renew --dry-run` revalidaria os dezenas de domínios da
# VPS e falharia por causa de um vizinho com DNS errado.
DESAFIO=/var/www/certbot/.well-known/acme-challenge
mkdir -p "$DESAFIO"
TOKEN="verificacao-$(date +%s)"
printf '%s' "$TOKEN" > "$DESAFIO/$TOKEN"

if [ "$(curl -fsS --max-time 15 "http://${PRIMARY_DOMAIN}/.well-known/acme-challenge/${TOKEN}" 2>/dev/null)" = "$TOKEN" ]; then
  echo "Desafio ACME acessível: a renovação vai funcionar."
else
  echo "::warning::O desafio ACME não respondeu em ${PRIMARY_DOMAIN}; confira o bloco /.well-known no nginx." >&2
fi
rm -f "$DESAFIO/$TOKEN"

exit 0
