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

echo "==> Construindo imagens da release $RELEASE"

# UM SERVIÇO DE CADA VEZ, e não `compose build` de uma vez só.
#
# O compose constrói em paralelo por padrão. Aqui isso significa quatro builds
# do Next disputando a memória de uma VPS compartilhada: o deploy #15 ficou 38
# minutos sem emitir uma linha e morreu no teto de tempo do job. Em série cada
# build tem a máquina inteira — é mais rápido no total, e quando algo trava dá
# para ver onde.
#
# `--progress=plain` porque sem TTY o progresso do BuildKit sai agrupado e
# aparece só no fim. Era por isso que aqueles 38 minutos foram um silêncio: não
# havia como saber se estava construindo ou travado.
#
# O `migrate` entra por último e é obrigatório: sem `--profile ferramentas` o
# build o ignora e o `run` mais abaixo reaproveita a imagem do migrator de um
# deploy anterior — as migrations rodavam com o código da primeira release
# publicada, não com o desta.
for servico in realtime worker admin web migrate; do
  echo "--> $servico"
  inicio=$(date +%s)

  if [ "$servico" = "migrate" ]; then
    compose --profile ferramentas build --progress=plain --pull migrate
  else
    compose build --progress=plain --pull "$servico"
  fi

  echo "--> $servico pronto em $(( $(date +%s) - inicio ))s"
done

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
