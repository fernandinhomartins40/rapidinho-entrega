#!/usr/bin/env bash
#
# Monta o /opt/rapidinho/.env na VPS.
#
# Duas regras que governam este arquivo:
#  - segredo gerado aqui NUNCA é regerado: trocar o AUTH_SECRET desconectaria
#    todo mundo, e trocar a senha do Postgres deixaria o banco inacessível;
#  - configuração derivada do domínio é sempre reescrita, para o deploy
#    conseguir corrigir um valor errado.

set -euo pipefail

APP_ROOT="${APP_ROOT:?APP_ROOT não informado}"
GHCR_OWNER="${GHCR_OWNER:?GHCR_OWNER não informado}"
CANONICAL_URL="${CANONICAL_URL:?CANONICAL_URL não informado}"
PRIMARY_DOMAIN="${PRIMARY_DOMAIN:?PRIMARY_DOMAIN não informado}"
ADMIN_DOMAIN="${ADMIN_DOMAIN:?ADMIN_DOMAIN não informado}"
SSL_EMAIL="${SSL_EMAIL:-admin@${PRIMARY_DOMAIN}}"
PORT_RANGE_START="${PORT_RANGE_START:-3100}"
PORT_RANGE_END="${PORT_RANGE_END:-3199}"

ENV_FILE="$APP_ROOT/.env"
mkdir -p "$APP_ROOT"
touch "$ENV_FILE"
chmod 600 "$ENV_FILE"

ler_env() {
  awk -F= -v chave="$1" '$1 == chave { sub(/^[^=]*=/, "", $0); print $0; exit }' "$ENV_FILE" | tr -d '\r'
}

gravar_env() {
  local chave="$1" valor="$2" tmp
  tmp="$(mktemp)"
  awk -v chave="$chave" -v valor="$valor" '
    BEGIN { atualizado = 0 }
    index($0, chave "=") == 1 { print chave "=" valor; atualizado = 1; next }
    { print }
    END { if (!atualizado) print chave "=" valor }
  ' "$ENV_FILE" > "$tmp"
  mv "$tmp" "$ENV_FILE"
}

garantir_env() {
  [ -n "$(ler_env "$1")" ] || gravar_env "$1" "$2"
}

garantir_segredo() {
  # Sem "/" nem "+": o valor entra na DATABASE_URL, onde esses caracteres
  # quebrariam a URL.
  [ -n "$(ler_env "$1")" ] || gravar_env "$1" "$(openssl rand -hex "$2")"
}

# ── Porta externa ────────────────────────────────────────────────────────────
# Escolhida uma única vez. Trocar de porta a cada deploy deixaria o nginx do
# host apontando para o vazio entre um step e outro.
porta_em_uso() {
  local porta="$1"

  if ss -ltn 2>/dev/null | awk 'NR>1 {print $4}' | sed 's/.*://' | grep -qx "$porta"; then
    return 0
  fi

  # Porta que outro site reservou no nginx conta como ocupada, mesmo que o
  # serviço dele esteja parado neste momento.
  if grep -rhoE "proxy_pass +https?://127\.0\.0\.1:${porta}([^0-9]|$)" \
       /etc/nginx/sites-available/ 2>/dev/null | grep -q .; then
    return 0
  fi

  return 1
}

DEPLOY_PORT="$(ler_env "DEPLOY_PORT")"

if [ -n "$DEPLOY_PORT" ]; then
  echo "Porta já fixada para esta aplicação: $DEPLOY_PORT"
else
  for porta in $(seq "$PORT_RANGE_START" "$PORT_RANGE_END"); do
    if ! porta_em_uso "$porta"; then
      DEPLOY_PORT="$porta"
      break
    fi
  done

  if [ -z "$DEPLOY_PORT" ]; then
    echo "Nenhuma porta livre entre $PORT_RANGE_START e $PORT_RANGE_END." >&2
    exit 1
  fi

  echo "Porta livre escolhida: $DEPLOY_PORT"
  gravar_env "DEPLOY_PORT" "$DEPLOY_PORT"
fi

# ── Segredos: gerados uma vez, preservados para sempre ───────────────────────
garantir_env "POSTGRES_USER" "rapidinho"
garantir_env "POSTGRES_DB" "rapidinho"
garantir_segredo "POSTGRES_PASSWORD" 24
garantir_segredo "AUTH_SECRET" 32
garantir_env "MINIO_ROOT_USER" "rapidinho"
garantir_segredo "MINIO_ROOT_PASSWORD" 24

# ── Configuração derivada: sempre reescrita ──────────────────────────────────
gravar_env "NODE_ENV" "production"
# O nginx do compose escuta só no loopback; quem expõe à internet, com TLS, é
# o nginx do host.
gravar_env "NGINX_BIND" "127.0.0.1"
gravar_env "HTTP_PORT" "$DEPLOY_PORT"
gravar_env "GHCR_OWNER" "$GHCR_OWNER"
gravar_env "WEB_DOMAIN" "$PRIMARY_DOMAIN"
gravar_env "ADMIN_DOMAIN" "$ADMIN_DOMAIN"

gravar_env "AUTH_URL" "$CANONICAL_URL/api/auth"
gravar_env "AUTH_TRUST_HOST" "true"
gravar_env "NEXT_PUBLIC_WEB_URL" "$CANONICAL_URL"
gravar_env "NEXT_PUBLIC_ADMIN_URL" "https://${ADMIN_DOMAIN}"
gravar_env "NEXT_PUBLIC_SOCKET_URL" "$CANONICAL_URL"

gravar_env "REDIS_URL" "redis://redis:6379"
gravar_env "S3_ENDPOINT" "http://minio:9000"
gravar_env "S3_REGION" "us-east-1"
gravar_env "S3_BUCKET" "rapidinho"
gravar_env "S3_FORCE_PATH_STYLE" "true"
gravar_env "S3_PUBLIC_URL" "$CANONICAL_URL/uploads"
gravar_env "S3_ACCESS_KEY" "$(ler_env "MINIO_ROOT_USER")"
gravar_env "S3_SECRET_KEY" "$(ler_env "MINIO_ROOT_PASSWORD")"

gravar_env "DATABASE_URL" \
  "postgresql://$(ler_env "POSTGRES_USER"):$(ler_env "POSTGRES_PASSWORD")@postgres:5432/$(ler_env "POSTGRES_DB")?schema=public"

# ── Provedores externos ──────────────────────────────────────────────────────
# Entram quando as credenciais existirem; editar o .env na VPS basta.
# OTP não pode ficar em "console" com NODE_ENV=production — a validação de
# ambiente recusa e o app não sobe, que é o comportamento desejado.
garantir_env "PAYMENT_PROVIDER" "fake"
garantir_env "WHATSAPP_PROVIDER" "fake"
garantir_env "OTP_PROVIDER" "whatsapp"
garantir_env "OTP_TTL_SECONDS" "300"
garantir_env "OTP_MAX_ATTEMPTS" "5"
garantir_env "LOG_LEVEL" "info"
garantir_env "VAPID_SUBJECT" "mailto:${SSL_EMAIL}"

# Telefone do super admin. Sem ele o seed essencial não cria administrador
# nenhum, e é assim de propósito: cair para um número fixo daria acesso ao
# painel a quem soubesse o número. `garantir_env` só grava se ainda não houver
# valor, então editar o .env na VPS à mão continua valendo.
if [ -n "${SUPER_ADMIN_PHONE:-}" ]; then
  garantir_env "SUPER_ADMIN_PHONE" "$SUPER_ADMIN_PHONE"
fi

# Monitoramento de erro. Opcional de propósito: sem DSN o erro vai só para o
# log estruturado, e ninguém precisa criar conta em serviço de terceiro para
# subir o projeto.
if [ -n "${SENTRY_DSN:-}" ]; then
  gravar_env "SENTRY_DSN" "$SENTRY_DSN"
fi

chmod 600 "$ENV_FILE"

echo "Ambiente pronto. DEPLOY_PORT=$(ler_env "DEPLOY_PORT")"
