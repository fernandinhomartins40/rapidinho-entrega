#!/usr/bin/env bash
#
# Instala o que o deploy precisa na VPS. Idempotente: nos deploys seguintes
# não faz nada além de conferir.
#
# A VPS é compartilhada com outros sites, então este script só ADICIONA:
# nunca remove pacote, site do nginx ou container de terceiros.

set -euo pipefail

# O script chega por `bash -s`, sem ambiente nenhum a menos que o workflow
# repasse. Com `set -u` uma variável ausente derruba o deploy inteiro — foi o
# que aconteceu no deploy #11, no agendamento do backup, depois de quatro
# minutos instalando pacotes.
APP_ROOT="${APP_ROOT:-/opt/rapidinho}"

if ! command -v apt-get >/dev/null 2>&1; then
  echo "Distribuição sem apt-get não é suportada por este deploy." >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
APT_ATUALIZADO=0

atualizar_apt_uma_vez() {
  if [ "$APT_ATUALIZADO" -eq 0 ]; then
    apt-get update
    APT_ATUALIZADO=1
  fi
}

garantir_pacotes() {
  local faltando=0 pacote
  for pacote in "$@"; do
    if ! dpkg-query -W -f='${Status}' "$pacote" 2>/dev/null | grep -q 'install ok installed'; then
      faltando=1
      break
    fi
  done
  if [ "$faltando" -eq 1 ]; then
    atualizar_apt_uma_vez
    apt-get install -y --no-install-recommends "$@"
  fi
}

# gettext-base traz o envsubst, usado para gerar a config do nginx.
# zstd descomprime as imagens que chegam prontas do runner — a VPS não constrói
# mais nada por conta própria.
garantir_pacotes ca-certificates certbot curl gettext-base nginx openssl tar iproute2 zstd

if ! command -v docker >/dev/null 2>&1; then
  atualizar_apt_uma_vez
  apt-get install -y --no-install-recommends docker.io
fi

if ! docker compose version >/dev/null 2>&1; then
  atualizar_apt_uma_vez
  apt-get install -y --no-install-recommends docker-compose-v2 \
    || apt-get install -y --no-install-recommends docker-compose-plugin
fi

systemctl enable --now docker
systemctl enable --now nginx

docker compose version >/dev/null
nginx -v
certbot --version >/dev/null

echo "Ambiente da VPS pronto."

# ── Backup diário do Postgres ────────────────────────────────────────────────
# Cron do host, e não container próprio: o container precisaria do socket do
# Docker para chamar pg_dump, o que é acesso de root disfarçado.
echo "==> Agendando o backup diário"

CRON_BACKUP="15 3 * * * APP_ROOT=$APP_ROOT bash $APP_ROOT/current/scripts/backup-postgres.sh >> $APP_ROOT/backups/backup.log 2>&1"

mkdir -p "$APP_ROOT/backups"

# Substitui a linha anterior em vez de acumular uma por deploy.
( crontab -l 2>/dev/null | grep -v 'backup-postgres.sh' ; echo "$CRON_BACKUP" ) | crontab -

echo "    Backup agendado para 03:15 (retenção de 14 dias)"
