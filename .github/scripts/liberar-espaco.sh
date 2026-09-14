#!/usr/bin/env bash
#
# Executado NA VPS antes de enviar e construir a release.
#
# O build do Docker precisa de alguns GB livres, e o deploy anterior falhou
# exatamente por isso ("no space left on device" copiando o standalone do
# Next). A limpeza existia, mas só no fim do remote-deploy.sh — ou seja, só
# rodava quando o build dava certo. Disco cheio virava falha permanente.
#
# A VPS é compartilhada com outros sites, então aqui só se remove o que é
# nosso ou o que o Docker sabe regenerar:
#   - releases antigas sob APP_ROOT
#   - imagens órfãs (`<none>`, restos de build) — nunca `prune -a`, que
#     apagaria imagens de containers parados dos vizinhos
#   - cache do BuildKit, que é regenerável por definição

set -euo pipefail

APP_ROOT="${APP_ROOT:?APP_ROOT não informado}"
# Espaço mínimo para o build do Docker caber com folga.
MINIMO_GB="${MINIMO_GB:-6}"
# Acima disto a limpeza é pulada por inteiro.
FOLGA_CONFORTAVEL_GB="${FOLGA_CONFORTAVEL_GB:-15}"
MANTER_RELEASES="${MANTER_RELEASES:-3}"

livre_gb() {
  df -BG --output=avail /var/lib/docker 2>/dev/null | tail -1 | tr -dc '0-9'
}

relatar() {
  echo "    $1: $(livre_gb) GB livres"
}

echo "==> Liberando espaço na VPS"
relatar "Antes"

# Com folga de sobra não há o que limpar. O `docker builder prune` chega a
# levar minutos num cache grande, e foi assim que um deploy morreu: o SSH
# fechou por inatividade ("broken pipe") enquanto ele varria o cache — sem
# necessidade nenhuma, porque havia 25 GB livres.
if [ "$(livre_gb)" -ge "$FOLGA_CONFORTAVEL_GB" ]; then
  echo "    Espaço de sobra; nada a limpar."
  exit 0
fi

# 1. Releases antigas nossas. Roda antes do build, e não depois, porque é
#    justamente quando falta espaço que elas precisam sair.
if [ -d "$APP_ROOT/releases" ]; then
  atual=""
  if [ -L "$APP_ROOT/current" ]; then
    atual="$(basename "$(readlink -f "$APP_ROOT/current")")"
  fi

  (
    cd "$APP_ROOT/releases"
    ls -1dt */ 2>/dev/null | tail -n "+$((MANTER_RELEASES + 1))" | while read -r antiga; do
      alvo="${antiga%/}"
      # Nunca remove a release que está no ar: se o build novo falhar, é ela
      # que continua servindo.
      if [ "$alvo" != "$atual" ]; then
        rm -rf -- "$alvo"
        echo "    Release removida: $alvo"
      fi
    done
  )
fi

# 2. Imagens órfãs. Sem `-a`: containers parados dos outros sites da VPS
#    dependem das imagens deles, que `prune -a` levaria junto.
timeout 120 docker image prune -f >/dev/null 2>&1 || true
relatar "Após imagens órfãs"

# 3. Cache de build. Começa pelo antigo; só apaga o cache recente se ainda
#    faltar espaço, porque perdê-lo deixa o próximo build bem mais lento.
timeout 300 docker builder prune -f --filter 'until=48h' >/dev/null 2>&1 || true
relatar "Após cache antigo"

if [ "$(livre_gb)" -lt "$MINIMO_GB" ]; then
  echo "    Ainda apertado — limpando todo o cache de build"
  timeout 600 docker builder prune -af >/dev/null 2>&1 || true
  relatar "Após cache completo"
fi

# 4. Logs de container que passaram do tamanho razoável. Truncar não derruba
#    o container; o Docker segue escrevendo no mesmo arquivo.
find /var/lib/docker/containers -name '*-json.log' -size +200M -exec truncate -s 0 {} \; 2>/dev/null || true

LIVRE="$(livre_gb)"
echo "==> $LIVRE GB livres"

if [ "$LIVRE" -lt 3 ]; then
  echo "::error::Só restam ${LIVRE} GB livres na VPS, insuficiente para o build." >&2
  echo "Maiores ocupantes de /var/lib/docker e /opt:" >&2
  du -sh /var/lib/docker/* /opt/* 2>/dev/null | sort -rh | head -15 >&2
  echo "Nada foi removido de outros sites. Libere espaço manualmente." >&2
  exit 1
fi
