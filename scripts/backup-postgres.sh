#!/usr/bin/env bash
#
# Backup do Postgres, rodado por cron na VPS.
#
# Guarda um dump comprimido por dia e mantém 14 dias. Duas semanas cobre o
# tempo real de descobrir um problema: erro de dado raramente aparece no mesmo
# dia, e guardar para sempre enche o disco da VPS — que já encheu uma vez.

set -euo pipefail

APP_ROOT="${APP_ROOT:-/opt/rapidinho}"
DESTINO="${BACKUP_DIR:-$APP_ROOT/backups}"
MANTER_DIAS="${BACKUP_KEEP_DAYS:-14}"
CONTAINER="${POSTGRES_CONTAINER:-rapidinho-postgres}"

ENV_FILE="$APP_ROOT/.env"

ler_env() {
  awk -F= -v chave="$1" '$1==chave{sub(/^[^=]*=/,"");print;exit}' "$ENV_FILE" | tr -d '\r'
}

POSTGRES_USER="$(ler_env POSTGRES_USER)"
POSTGRES_DB="$(ler_env POSTGRES_DB)"
: "${POSTGRES_USER:=rapidinho}"
: "${POSTGRES_DB:=rapidinho}"

mkdir -p "$DESTINO"

CARIMBO="$(date +%Y%m%d-%H%M%S)"
ARQUIVO="$DESTINO/rapidinho-$CARIMBO.sql.gz"

echo "==> Gerando backup em $ARQUIVO"

# O dump sai pelo stdout do container e é comprimido aqui: sem arquivo
# intermediário dentro do container, que teria de caber no volume também.
if ! docker exec "$CONTAINER" pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists \
  | gzip -9 > "$ARQUIVO.parcial"; then
  echo "::error::pg_dump falhou" >&2
  rm -f "$ARQUIVO.parcial"
  exit 1
fi

# Só vira backup válido depois de terminar. Um dump interrompido com o nome
# final seria restaurado como se estivesse inteiro — o pior resultado possível.
mv "$ARQUIVO.parcial" "$ARQUIVO"

TAMANHO="$(du -h "$ARQUIVO" | cut -f1)"
echo "    Backup concluído: $TAMANHO"

# Um dump que não abre não é backup. Verifica a integridade do gzip.
if ! gzip -t "$ARQUIVO"; then
  echo "::error::o arquivo gerado está corrompido" >&2
  rm -f "$ARQUIVO"
  exit 1
fi

echo "==> Removendo backups com mais de $MANTER_DIAS dias"
find "$DESTINO" -name 'rapidinho-*.sql.gz' -type f -mtime "+$MANTER_DIAS" -print -delete

echo "==> Backups atuais:"
ls -lh "$DESTINO" | tail -n +2 | awk '{print "    " $9 " (" $5 ")"}'
