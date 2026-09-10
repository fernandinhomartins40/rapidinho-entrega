#!/usr/bin/env bash
#
# Instala o que o deploy precisa na VPS. Idempotente: nos deploys seguintes
# não faz nada além de conferir.
#
# A VPS é compartilhada com outros sites, então este script só ADICIONA:
# nunca remove pacote, site do nginx ou container de terceiros.

set -euo pipefail

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
garantir_pacotes ca-certificates certbot curl gettext-base nginx openssl tar iproute2

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
