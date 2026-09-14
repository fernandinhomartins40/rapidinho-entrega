#!/usr/bin/env bash
#
# Restaura um backup. Usado em emergência — e por isso pede confirmação
# explícita: restaurar por engano apaga o banco de produção.

set -euo pipefail

ARQUIVO="${1:?Uso: restaurar-postgres.sh <arquivo.sql.gz>}"
APP_ROOT="${APP_ROOT:-/opt/rapidinho}"
CONTAINER="${POSTGRES_CONTAINER:-rapidinho-postgres}"

ENV_FILE="$APP_ROOT/.env"
ler_env() {
  awk -F= -v chave="$1" '$1==chave{sub(/^[^=]*=/,"");print;exit}' "$ENV_FILE" | tr -d '\r'
}

POSTGRES_USER="$(ler_env POSTGRES_USER)"
POSTGRES_DB="$(ler_env POSTGRES_DB)"
: "${POSTGRES_USER:=rapidinho}"
: "${POSTGRES_DB:=rapidinho}"

[ -f "$ARQUIVO" ] || { echo "Arquivo não encontrado: $ARQUIVO" >&2; exit 1; }
gzip -t "$ARQUIVO" || { echo "Arquivo corrompido: $ARQUIVO" >&2; exit 1; }

echo "Isto vai SUBSTITUIR o banco '$POSTGRES_DB' pelo conteúdo de:"
echo "  $ARQUIVO ($(du -h "$ARQUIVO" | cut -f1), de $(date -r "$ARQUIVO" '+%d/%m/%Y %H:%M'))"
echo
read -r -p "Digite RESTAURAR para confirmar: " confirmacao

if [ "$confirmacao" != "RESTAURAR" ]; then
  echo "Cancelado."
  exit 1
fi

# Um backup do estado atual antes de sobrescrever: se o dump restaurado for o
# errado, ainda dá para voltar.
echo "==> Guardando o estado atual antes de restaurar"
BACKUP_DIR="$APP_ROOT/backups" bash "$(dirname "$0")/backup-postgres.sh"

echo "==> Restaurando"
gunzip -c "$ARQUIVO" | docker exec -i "$CONTAINER" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"

echo "==> Restauração concluída"
