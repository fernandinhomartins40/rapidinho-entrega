#!/usr/bin/env bash
#
# Executado NA VPS pelo workflow de deploy.
#
# Recebe por ambiente: APP_ROOT, RELEASE e (opcional) DEPLOY_PORT.
# Sobe a release nova, aplica as migrations e só troca o link `current` depois
# que a aplicação responde — se algo falhar, a versão anterior continua no ar.

set -euo pipefail

APP_ROOT="${APP_ROOT:?APP_ROOT não informado}"
RELEASE="${RELEASE:?RELEASE não informada}"
# Sem isto o compose cairia na tag `dev` e subiria outra imagem que não a desta
# release — o pior tipo de deploy: o que diz que funcionou.
RELEASE_TAG="${RELEASE_TAG:?RELEASE_TAG não informada}"
export RELEASE_TAG

RELEASE_DIR="$APP_ROOT/releases/$RELEASE"
CURRENT_LINK="$APP_ROOT/current"
ENV_FILE="$APP_ROOT/.env"

cd "$RELEASE_DIR"

# O .env vive fora da release: sobrevive a deploy e guarda as senhas geradas.
ln -sfn "$ENV_FILE" "$RELEASE_DIR/.env"

DEPLOY_PORT="$(awk -F= '$1=="DEPLOY_PORT"{sub(/^[^=]*=/,"");print;exit}' "$ENV_FILE" | tr -d '\r')"
: "${DEPLOY_PORT:?DEPLOY_PORT ausente no .env}"

compose() {
  docker compose -f docker-compose.yml -f docker-compose.prod.yml "$@"
}

echo "==> Estado da VPS"
# O deploy #21 mediu esta máquina e achou load average 243, 494 MB de RAM livre
# e 2,7 GB de swap em uso — assim já nos 15 minutos anteriores, antes de o
# deploy encostar nela. Foi por isso que o build saiu daqui. Os números
# continuam no log porque explicam qualquer lentidão do que sobrou.
echo "-- disco --";     df -h "$APP_ROOT" / 2>/dev/null | sed 's/^/   /' || true
echo "-- memória --";   free -m 2>/dev/null | sed 's/^/   /' || true
echo "-- carga --";     uptime 2>/dev/null | sed 's/^/   /' || true
echo "-- vCPU --";      echo "   $(nproc 2>/dev/null || echo '?') núcleo(s)"

# STEAL TIME — a pergunta que decide se vale otimizar mais (plano §7).
#
# A coluna `st` do vmstat é o tempo em que esta VM estava pronta para rodar e o
# hipervisor deu a CPU para outro cliente. Se ela for alta, o load não vem
# desta aplicação e nenhuma otimização aqui dentro resolve — é hospedagem.
# Medir isso evita atribuir à aplicação um problema do provedor.
echo "-- steal time (coluna st: CPU que o provedor não entregou) --"
if command -v vmstat >/dev/null 2>&1; then
  vmstat 1 3 2>/dev/null | tail -2 | sed 's/^/   /' || true
else
  # Sem vmstat, o /proc/stat serve: o 8º campo da linha `cpu` é o steal
  # acumulado em jiffies desde o boot.
  awk '/^cpu /{printf "   steal acumulado: %d jiffies de %d total (%.1f%%)\n", $9, $2+$3+$4+$5+$6+$7+$8+$9, ($9*100)/($2+$3+$4+$5+$6+$7+$8+$9)}' /proc/stat 2>/dev/null || true
fi

# Consumo real por container: é o número que calibra os limites de CPU do
# plano §3, hoje ESTIMADOS por falta de medição.
echo "-- consumo por container --"
timeout 30 docker stats --no-stream --format '   {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.PIDs}}' 2>/dev/null || echo "   (docker stats não respondeu em 30s)"

echo "==> Conferindo as imagens da release $RELEASE_TAG"
# As imagens chegam prontas do runner, por `docker save | docker load`. Aqui
# não se constrói nada: esta VPS não completa nem um handshake TLS com o Docker
# Hub quando está carregada, quanto mais um `next build`.
FALTANDO=""
for servico in web admin realtime worker migrate; do
  if docker image inspect "rapidinho-${servico}:${RELEASE_TAG}" >/dev/null 2>&1; then
    echo "    rapidinho-${servico}:${RELEASE_TAG} ok"
  else
    FALTANDO="$FALTANDO rapidinho-${servico}:${RELEASE_TAG}"
  fi
done

if [ -n "$FALTANDO" ]; then
  echo "::error::Imagens ausentes na VPS:$FALTANDO — o envio a partir do runner falhou." >&2
  exit 1
fi

echo "==> Subindo banco, cache e storage"
compose up -d postgres redis minio minio-init

# `depends_on: service_healthy` cobre o boot dos apps, mas a migration roda
# fora do compose e precisa do banco pronto antes.
echo "==> Aguardando o Postgres aceitar conexão"
for tentativa in $(seq 1 30); do
  if compose exec -T postgres pg_isready -q; then
    echo "    Postgres pronto (tentativa $tentativa)"
    break
  fi
  if [ "$tentativa" -eq 30 ]; then
    echo "Postgres não respondeu em 60s" >&2
    compose logs --tail=50 postgres >&2
    exit 1
  fi
  sleep 2
done

echo "==> Aplicando migrations"
# O estágio `migrator` do Dockerfile: a imagem final é o standalone do Next e
# não carrega o CLI do Prisma, que é devDependency.
compose --profile ferramentas run --rm migrate || {
  echo "Falha ao aplicar migrations — a versão anterior segue no ar." >&2
  exit 1
}

# Cidade, bairros, categorias e planos são configuração, não dado de teste:
# sem eles a home não tem nem cidade para oferecer. Roda sempre, porque é
# idempotente, e nunca semeia lojas ou produtos fictícios.
echo "==> Semeando dados essenciais"
compose --profile ferramentas run --rm \
  -e SEED_MODE=essencial \
  migrate pnpm --filter @rapidinho/database seed:essencial || {
  echo "Falha ao semear os dados essenciais — a versão anterior segue no ar." >&2
  exit 1
}

echo "==> Subindo aplicação"
compose up -d --remove-orphans

echo "==> Verificando saúde na porta $DEPLOY_PORT"
SAUDAVEL=0
for tentativa in $(seq 1 30); do
  if curl -fsS --max-time 5 "http://127.0.0.1:${DEPLOY_PORT}/api/health" >/dev/null 2>&1; then
    echo "    Aplicação respondendo (tentativa $tentativa)"
    SAUDAVEL=1
    break
  fi
  sleep 4
done

if [ "$SAUDAVEL" -ne 1 ]; then
  echo "A aplicação não respondeu em 120s. Logs recentes:" >&2
  compose ps >&2
  compose logs --tail=80 nginx web admin >&2
  exit 1
fi

# Só agora a release vira a atual: até aqui um erro deixaria o link apontando
# para uma versão que sobe.
ln -sfn "$RELEASE_DIR" "$CURRENT_LINK"
echo "==> Release $RELEASE publicada"

# Mantém as 5 últimas releases para rollback manual; o resto é lixo em disco.
if [ -d "$APP_ROOT/releases" ]; then
  cd "$APP_ROOT/releases"
  ls -1dt */ 2>/dev/null | tail -n +6 | while read -r antiga; do
    alvo="${antiga%/}"
    if [ "$alvo" != "$RELEASE" ]; then
      rm -rf -- "$alvo"
      echo "    Release antiga removida: $alvo"
    fi
  done
fi

# Imagens órfãs das builds anteriores enchem o disco da VPS em poucas semanas.
# A limpeza principal é o liberar-espaco.sh, que roda ANTES do build — esta
# aqui só devolve o que a build recém-concluída deixou para trás.
docker image prune -f >/dev/null 2>&1 || true
docker builder prune -f --filter 'until=48h' >/dev/null 2>&1 || true

echo "==> Deploy concluído"
