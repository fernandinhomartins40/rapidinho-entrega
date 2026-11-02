# Banca R5 — SRE: VPS, infraestrutura e desempenho

Auditoria PIE V2 · Rapidinho Entrega · commit `d65c0e5` (main) · data 2026-11-01.
Revisão independente: o revisor não leu os pareceres R1 a R4. Os números de desempenho
detalhados estão em `docs/pie/RELATORIO_PERFORMANCE_VPS.md`. As saídas brutas estão em
`C:\Users\fusea\AppData\Local\Temp\claude\c--FuseDev-rapidinho-entrega\f9c02d86-2f36-47ac-a919-6a836a7d0812\scratchpad\r5`.

Nenhum código, configuração ou estado do git foi alterado. Durante a checagem de imports do
R3-012 (ver R5-017), um arquivo temporário foi criado em `apps/worker` e apagado no mesmo comando.
O `git status` final mostra só `docs/pie/` e `docs/revisao/evidencias/`, que já estavam lá.

## Resumo dos achados

| ID     | Título                                                                                                                                | Sev.  | Estado                      |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------- | ----- | --------------------------- |
| R5-001 | `/uploads/` em produção não serve nenhum arquivo (MinIO: "invalid hostname"; a URL pública ainda omite o bucket)                      | Alta  | CONFIRMADO                  |
| R5-002 | Imagens do MinIO e do mc fixadas no compose não existem mais (R3-011); um host novo não sobe nem o site                               | Alta  | CONFIRMADO                  |
| R5-003 | Deploy entra como root por senha (sshpass), sem checar a chave do host, com IP e usuário num repositório público                      | Alta  | CONFIRMADO                  |
| R5-004 | Segredos interpolados na linha de comando SSH remota (visíveis no `ps` da VPS compartilhada; risco de injeção por aspas)              | Média | CONFIRMADO                  |
| R5-005 | Deploy promete "a versão anterior continua no ar", mas troca os containers antes do health; sem rollback automático; health só do web | Alta  | CONFIRMADO                  |
| R5-006 | Migrations aplicadas sem backup prévio; rollback documentado nunca testado; documentação de retenção divergente                       | Alta  | CONFIRMADO / FORTE INDÍCIO  |
| R5-007 | Backups só no mesmo disco da VPS, sem cópia externa, sem criptografia, sem teste; MinIO e `.env` sem backup nenhum                    | Alta  | CONFIRMADO (código)         |
| R5-008 | Redis `allkeys-lru` pode descartar jobs do BullMQ (R3-013)                                                                            | Média | CONFIRMADO                  |
| R5-009 | `limit_req` do nginx interno conta todos os clientes como um IP só (gateway do Docker): 6 OTP/min para a plataforma inteira           | Alta  | FORTE INDÍCIO               |
| R5-010 | Observabilidade: sem alerta externo, container `unhealthy` não reinicia, Sentry sem instrumentação do Next, sem log de consulta lenta | Média | CONFIRMADO                  |
| R5-011 | Vitrine da cidade sem cache: TTFB de 0,44 a 0,76 s, HTML de 615 KB, carga de dados sem limite                                         | Média | CONFIRMADO (medido)         |
| R5-012 | Índices: consultas quentes que crescem com o histórico; 39 chaves estrangeiras sem índice                                             | Baixa | HIPÓTESE                    |
| R5-013 | Encerramento e limites: worker sem `stop_grace_period`; migrate e minio-init sem teto; loopback depende do `.env`                     | Baixa | CONFIRMADO                  |
| R5-014 | `liberar-espaco.sh` trunca logs de containers de **todos** os projetos da VPS (e é código morto)                                      | Baixa | CONFIRMADO                  |
| R5-015 | nginx do host expõe a versão; `proxy_cache_valid` sem `proxy_cache` (sem efeito)                                                      | Baixa | CONFIRMADO                  |
| R5-016 | Imagem `migrate` com 398 MB e worker com 170 MB comprimidos: cerca de 882 MB por deploy                                               | Baixa | CONFIRMADO (medido)         |
| R5-017 | Reconfirmação do R3-012 (worker e realtime em `pnpm dev`)                                                                             | —     | NÃO REPRODUZIDO (corrigido) |

---

## Achados

### R5-001 — `/uploads/` em produção não serve nenhum arquivo

- **Categoria:** Infra / disponibilidade de funcionalidade (fotos de produto, logos, banners).
- **Severidade:** Alta. Toda imagem enviada por lojista ou admin fica inacessível ao público. O app
  cai para a arte SVG, então o pedido não para, mas o cardápio com foto, que é central para vender,
  não funciona. Não é Crítica porque o fluxo de pedido segue.
- **Estado:** CONFIRMADO para o sintoma. A causa é FORTE INDÍCIO, com duas falhas somadas.
- **Onde:**
  - `docker/nginx/nginx.conf.template:97-102`, `135-138` e `170-173`: `location /uploads/` com
    `proxy_set_header Connection ''`. Pela regra de herança do nginx, declarar qualquer
    `proxy_set_header` no `location` descarta **todos** os herdados do bloco `http`
    (`:74` `Host $host`). O Host enviado ao MinIO passa a ser `$proxy_host` = `minio_upstream`, e o
    `_` é inválido em hostname.
  - `apps/web/src/lib/media.ts:27` monta `…/uploads/${key}`. As chaves começam com `public/…`
    (`packages/services/src/images/processor.ts:44-49`) e o `proxy_pass http://minio_upstream/;`
    corta `/uploads/`. O MinIO recebe `/public/produtos/…`, ou seja, o **bucket `public`**, que não
    existe: o bucket é `rapidinho` (`docker-compose.yml:288`). O mesmo vale para
    `S3_PUBLIC_URL=$CANONICAL_URL/uploads` (`.github/scripts/preparar-env.sh:123`).
- **Reprodução segura:** `curl -s -i https://rapidinhoentrega.com.br/uploads/rapidinho/public/` (GET).
- **Esperado × observado:** esperado 200 ou 404 de objeto. Observado **400
  `InvalidRequest — Invalid Request (invalid hostname)`** em cinco caminhos diferentes, incluindo
  `/uploads/` e `/uploads/minio/health/live` (`prod-uploads.txt`, 2026-11-02 02:37 UTC). A vitrine de
  produção não contém nenhuma URL `/uploads/`.
- **Impacto:** fotos, logos, capas, banners e ícones de categoria nunca aparecem. O upload grava no
  MinIO e enche o disco à toa.
- **Correção proposta:** no `location /uploads/`, repetir `proxy_set_header Host minio:9000;` (ou
  `$host`, com `MINIO_DOMAIN` ajustado) e trocar para `proxy_pass http://minio_upstream/rapidinho/;`
  (prefixo do bucket), ou incluir o bucket em `mediaUrl`/`S3_PUBLIC_URL`. Usar um único ponto de verdade.
- **Teste de aceite:** um teste e2e ou de fumaça no deploy (`verificar-deploy.sh`) envia uma imagem de
  teste ao bucket e espera 200 com `content-type: image/webp` em `https://<domínio>/uploads/public/...`.
  O GET em `/uploads/rapidinho/` não pode mais devolver "invalid hostname".

### R5-002 — Imagem do MinIO e do mc não pode mais ser baixada (R3-011)

- **Categoria:** Infra / recuperação de desastre.
- **Severidade:** Alta. Hoje funciona só porque a imagem está em cache na VPS ("a mesma versão que
  outro projeto da VPS já usa", `docker-compose.yml:252-254`). Num servidor novo, depois de um
  `docker image prune -a` de um vizinho ou numa restauração, o `compose up` falha. Como o nginx exige
  `minio: service_healthy` (`docker-compose.yml:41-42`), **o site inteiro não sobe**, não só os
  uploads. O `remote-deploy.sh:51` (`compose up -d postgres redis minio minio-init` com `set -e`)
  aborta o deploy.
- **Estado:** CONFIRMADO.
- **Onde:** `docker-compose.yml:255` (`quay.io/minio/minio:RELEASE.2025-09-07T16-13-09Z`) e `:278`
  (`quay.io/minio/mc:RELEASE.2025-08-13T08-35-41Z`).
- **Reprodução segura e evidência:**
  ```text
  docker manifest inspect quay.io/minio/minio:RELEASE.2025-09-07T16-13-09Z → no such manifest
  docker manifest inspect quay.io/minio/mc:RELEASE.2025-08-13T08-35-41Z    → no such manifest
  docker manifest inspect quay.io/minio/minio:latest                       → no such manifest
  docker manifest inspect minio/minio:RELEASE.2025-09-07T16-13-09Z         → denied / authentication required
  ```
  O ambiente local de revisão já usa SeaweedFS (`rapidinho-s3-revisao`) como contorno.
- **Esperado × observado:** esperado que a imagem fixada seja baixável. Observado manifesto inexistente.
- **Impacto:** RTO indefinido em qualquer desastre, e dependência oculta do cache de um projeto vizinho.
- **Correção proposta:** (a) espelhar já a imagem em cache na VPS para o GHCR do projeto
  (`docker tag` + `push`, por digest) e apontar o compose para ela; (b) a médio prazo, trocar o storage
  (SeaweedFS, Garage ou S3 gerenciado). Tirar `minio` do `depends_on` do nginx, para que storage fora
  não derrube o site.
- **Teste de aceite:** `docker manifest inspect <imagem do compose>` responde em CI (job que falha se
  qualquer imagem do compose não resolver) e um `compose up` num runner limpo fica saudável.

### R5-003 — Deploy por SSH como root com senha, sem verificação da chave do host

- **Categoria:** Segurança operacional / segredos.
- **Severidade:** Alta. A VPS é compartilhada com "dezenas" de domínios (`emitir-ssl.sh`). O acesso é
  root por senha, guardada num secret, e o repositório é **público** (a API do GitHub responde 200
  anonimamente). IP e usuário ficam publicados (`deploy.yml:13-14`), o que convida a força bruta
  contra um sshd que aceita senha de root. Sem `StrictHostKeyChecking`, um MITM na rota do runner
  captura a senha. Comprometer essa conta compromete todos os sites do host.
- **Estado:** CONFIRMADO (arquivo).
- **Onde:** `.github/workflows/deploy.yml:13-14` (`VPS_HOST`, `VPS_USER: root`), `:24`
  (`StrictHostKeyChecking=no`, `PreferredAuthentications=password`, `PubkeyAuthentication=no`),
  `:323-327` (sshpass) e todos os passos seguintes.
- **Reprodução segura:** leitura do arquivo e `curl -s -o /dev/null -w "%{http_code}"
https://api.github.com/repos/fernandinhomartins40/rapidinho-entrega` responde 200, logo é público.
- **Esperado × observado:** esperado chave SSH dedicada, usuário sem privilégio com `sudo` restrito e
  `known_hosts` fixado. Observado root, senha e host não verificado.
- **Impacto:** escalada lateral para todos os projetos da VPS. O vazamento da senha é irrevogável sem
  trocar a senha de root.
- **Correção proposta:** usuário `deploy` no grupo `docker` (ou `sudo` restrito aos scripts), chave
  ed25519 em secret, `known_hosts` com a impressão digital da VPS em secret (`StrictHostKeyChecking=yes`),
  e `PasswordAuthentication no` mais `PermitRootLogin prohibit-password` no sshd. Para a mudança no
  sshd é preciso combinar com os donos dos outros projetos.
- **Teste de aceite:** o workflow roda sem `sshpass` e com `StrictHostKeyChecking=yes`;
  `ssh -o PreferredAuthentications=password root@VPS` é recusado.

### R5-004 — Segredos na linha de comando SSH remota

- **Categoria:** Segredos.
- **Severidade:** Média. O valor fica visível no `ps`/`/proc/*/cmdline` da VPS durante o passo (a
  máquina hospeda outros projetos e usuários), e um secret com `'` quebra o comando ou injeta shell
  como root.
- **Estado:** CONFIRMADO (arquivo).
- **Onde:** `.github/workflows/deploy.yml:367-370`: `SUPER_ADMIN_PHONE='…' SENTRY_DSN='…'
SMS_GATEWAY_NUMBER='…' SMSDEV_API_KEY='…'` na string do comando remoto.
- **Reprodução segura:** leitura do arquivo.
- **Esperado × observado:** esperado que o segredo chegue por stdin ou arquivo temporário com
  `umask 077`, como já é feito com o token do GHCR (`:380`). Observado o segredo em argv.
- **Impacto:** exposição da chave da SMSDev (custo de SMS) e do DSN.
- **Correção proposta:** enviar um arquivo `KEY=VALUE` por stdin (`printf … | ssh … 'umask 077; cat > $APP_ROOT/.env.entrada'`),
  ler no `preparar-env.sh` e apagar em seguida.
- **Teste de aceite:** `grep -n "SMSDEV_API_KEY='" .github/workflows/deploy.yml` não encontra nada; o
  deploy grava o mesmo `.env`.

### R5-005 — "Se algo falhar, a versão anterior continua no ar" é falso

- **Categoria:** Deploy / disponibilidade.
- **Severidade:** Alta. Toda release que suba e não fique saudável deixa produção fora do ar até
  alguém intervir à mão, e o workflow só fica vermelho.
- **Estado:** CONFIRMADO (análise do script). A falha real não foi provocada (proibido).
- **Onde:** `.github/scripts/remote-deploy.sh:6-7` (promessa), `:91` (`compose up -d --remove-orphans`
  recria **todos** os containers com as imagens novas), `:93-109` (health depois da troca; em falha
  `exit 1` sem voltar para a tag anterior). O `current` (`:113`) e o `RELEASE_TAG` do `.env` continuam
  apontando para a release antiga, mas os containers no ar são os novos. O health (`:96`) consulta
  `127.0.0.1:${DEPLOY_PORT}/api/health`, que o `default_server` do nginx manda **só para o web**.
  Admin, worker e realtime não entram na decisão. `container_name` fixo (`docker-compose.yml:19,55,…`)
  impede blue/green.
- **Reprodução segura (em staging):** publicar uma imagem web cujo `/api/health` devolva 503 → o
  script sai com 1 e `docker ps` mostra a imagem nova em execução.
- **Esperado × observado:** esperado manter ou restaurar a release anterior. Observado containers novos
  e quebrados no ar.
- **Impacto:** indisponibilidade total enquanto ninguém fizer o rollback manual (§R5-006).
- **Correção proposta:** em falha, `RELEASE_TAG=<anterior> compose up -d` automático (a tag anterior
  está no `.env`, `:114-118`). Checar saúde de cada serviço (`docker compose ps --format json`,
  `Health=healthy` para web, admin, realtime e worker), e não só a porta.
- **Teste de aceite:** um deploy com imagem propositalmente doente em staging termina com a tag
  anterior rodando e todos os serviços `healthy`.

### R5-006 — Migrations sem backup prévio; rollback documentado e nunca testado

- **Categoria:** Deploy / dados.
- **Severidade:** Alta. Uma migration destrutiva (DROP/RENAME, que já existem no histórico, como
  `20260928120000_pedidos_por_ramo` e `20260929120000_pesagem_justa`) é irreversível pelo rollback de
  código, e o último backup pode ter até 24 h.
- **Estado:** CONFIRMADO para a falta de backup prévio. FORTE INDÍCIO de que o rollback nunca foi
  testado: não há registro, script nem job.
- **Onde:**
  - `remote-deploy.sh:69-77`: `migrate deploy` (o Prisma usa advisory lock, e o
    `concurrency: deploy-production` em `deploy.yml:8-10` impede deploys paralelos, então concorrência
    está coberta) roda **antes** do `up`, com a versão antiga ainda servindo, e sem nenhum `pg_dump`
    antes.
  - `:83-88`: o seed essencial roda em todo deploy.
  - `DEPLOY.md:41-50`: rollback manual. `DEPLOY.md:25` fala em "cinco builds", mas são seis.
  - `remote-deploy.sh:121` mantém 5 releases e `liberar-espaco.sh:24` mantém 3, só que este último não
    é chamado por nenhum workflow (código morto).
  - `docs/PADRAO-VPS-MULTI-APPS.md:176` exige "rollback testado".
- **Reprodução segura:** `grep -n "pg_dump\|backup" .github/scripts/remote-deploy.sh` não encontra nada.
- **Esperado × observado:** esperado um dump antes de migrar e um rollback ensaiado. Observado nenhum
  dos dois.
- **Impacto:** perda de dados ou downtime longo numa migration ruim.
- **Correção proposta:** chamar `scripts/backup-postgres.sh` antes do passo de migrations e abortar se
  falhar. Adotar a política expand/contract (migration destrutiva só uma release depois). Criar um
  `scripts/rollback.sh <sha>` e ensaiá-lo em staging a cada trimestre.
- **Teste de aceite:** o log de deploy mostra "Backup concluído" antes de "Aplicando migrations";
  `rollback.sh` é executado em staging com sucesso e registrado.

### R5-007 — Backups frágeis: mesmo disco, sem cópia externa, sem teste; MinIO e `.env` sem backup

- **Categoria:** Dados / continuidade.
- **Severidade:** Alta. Perder o disco ou a VPS significa perder pedidos, contas e todas as imagens. A
  VPS já registrou disco com 84% de uso e load 243 (`docs/AUDITORIA-OTIMIZACAO-VPS.md:160-166`).
- **Estado:** CONFIRMADO no código. A execução real (cron instalado, dumps existentes) está BLOQUEADA
  (sem SSH).
- **Onde:**
  - `.github/scripts/preparar-vps.sh:74-81`: cron diário às 03:15 → `scripts/backup-postgres.sh`.
  - `scripts/backup-postgres.sh:11-58`: dump gzip em `/opt/rapidinho/backups`, **no mesmo disco**,
    sem criptografia, retenção de 14 dias, só `gzip -t` como "verificação".
  - Nenhum backup de `minio-data`: `grep "mc mirror|rclone|restic"` não encontra nada.
  - O `.env` com `AUTH_SECRET` e senhas fica só em `/opt/rapidinho/.env`.
  - `scripts/restaurar-postgres.sh:102`: restaura com os apps no ar, sem parar web, admin e worker.
  - `backup.log` sem rotação.
- **Reprodução segura:** leitura dos arquivos e as buscas acima.
- **Esperado × observado:** esperado backup 3-2-1 com teste de restauração. Observado uma cópia local,
  sem teste.
- **Impacto:** RPO de até 24 h no melhor caso e perda total no pior. As imagens não têm backup nenhum.
- **Correção proposta:** enviar o dump e um `mc mirror` (ou equivalente) de `minio-data` para storage
  externo (bucket S3/B2 com retenção), cifrar com age ou gpg, guardar o `.env` num cofre, e rodar um
  restore semanal automatizado num container descartável com contagem de linhas.
- **Teste de aceite:** um job agendado restaura o dump mais recente num Postgres efêmero e confere a
  contagem de `orders`/`users`. Alerta se o último backup externo tiver mais de 26 h.

### R5-008 — Redis com `allkeys-lru` descarta jobs do BullMQ (R3-013)

- **Categoria:** Infra / perda de dados de fila.
- **Severidade:** Média. O impacto é alto e silencioso (expiração de Pix, lembrete à loja e agendadores
  de cobrança e boost somem), mas a probabilidade hoje é baixa: o uso local é de 2,5 MB para 256 MB, e
  `removeOnComplete`/`removeOnFail` são limitados (`packages/services/src/queues.ts:37-38`).
- **Estado:** CONFIRMADO.
- **Onde:** `docker-compose.yml:238`
  (`--maxmemory 256mb --maxmemory-policy allkeys-lru`). Jobs atrasados em `queues.ts:105-135` e
  schedulers em `:144-157`. As chaves de rate limit dividem o mesmo Redis.
- **Reprodução segura:** `docker exec rapidinho-redis redis-cli CONFIG GET maxmemory-policy` devolve
  `allkeys-lru`. `INFO stats`: `evicted_keys:0`.
- **Esperado × observado:** o BullMQ exige `noeviction`. Observado `allkeys-lru`.
- **Impacto:** pedido preso em `PENDING_PAYMENT`, cobrança que não roda, sem erro em log.
- **Correção proposta:** `--maxmemory-policy noeviction` (rate limit e batimento já usam TTL), mais um
  alerta de `used_memory` acima de 70%. Opcional: um Redis separado para cache e rate limit.
- **Teste de aceite:** `CONFIG GET maxmemory-policy` devolve `noeviction` em produção e o aviso
  "Eviction policy is allkeys-lru" some do log do worker.

### R5-009 — Rate limit do nginx interno é global (todos os clientes com o mesmo IP)

- **Categoria:** Disponibilidade / rate limit.
- **Severidade:** Alta, se confirmado. O login do cliente é só por SMS. Com `otp_zone` em `6r/m` e
  `burst=3`, a plataforma inteira teria cerca de 6 pedidos de código por minuto, e o restante recebe 503.
  O `/api/` teria 30 r/s somados para todos.
- **Estado:** FORTE INDÍCIO. A prova em runtime exige o log do container na VPS (BLOQUEADO), e
  sondar com OTP real é proibido.
- **Onde:** `docker/nginx/nginx.conf.template:70-71` (`limit_req_zone $binary_remote_addr …`),
  `:106`, `:111` e `:177`. Não há `set_real_ip_from`/`real_ip_header` no arquivo (`grep real_ip` não
  encontra nada). A cadeia é: nginx do host → `127.0.0.1:${DEPLOY_PORT}` (bind no loopback,
  `preparar-env.sh`) → docker-proxy ou DNAT → container. O `$remote_addr` dentro do container é o
  gateway da bridge, igual para todo mundo.
- **Achado correlato (confirmado no código):** `packages/services/src/rate-limit.ts:50-56` usa o
  **primeiro** item do `X-Forwarded-For`, que o cliente controla, porque o host usa
  `$proxy_add_x_forwarded_for`. Basta enviar um IP falso para o limite por IP do app não pegar. Cabe
  ao revisor de segurança aprofundar.
- **Reprodução segura (staging):** `docker logs rapidinho-nginx | awk '{print $1}' | sort | uniq -c`
  depois de acessos de IPs diferentes mostra um IP só (172.x.0.1).
- **Esperado × observado:** esperado limite por cliente. Observado (inferido) limite por gateway.
- **Impacto:** 503 no login em horário de pico; lojistas e clientes travados.
- **Correção proposta:** no nginx interno, `set_real_ip_from 127.0.0.1; set_real_ip_from 172.16.0.0/12;
real_ip_header X-Real-IP;` (o host já envia `X-Real-IP $remote_addr`). No app, usar `x-real-ip`, ou o
  último salto confiável do XFF.
- **Teste de aceite:** o access log do container mostra IPs públicos distintos; 7 pedidos de OTP de
  um IP dão 503 e o oitavo, de outro IP, passa.

### R5-010 — Observabilidade insuficiente

- **Categoria:** Observabilidade.
- **Severidade:** Média. Hoje uma queda é descoberta pelo cliente.
- **Estado:** CONFIRMADO.
- **Onde:**
  - `DEPLOY.md:62`: "O deploy não coleta métricas".
  - Não existe uptime monitor nem alerta (`grep uptime|alert` nos workflows e scripts não encontra
    nada).
  - Healthchecks existem (`docker-compose.yml:43-50, 76-81, 107-112, 133-138, 164-173`), mas o Docker
    **não reinicia** container `unhealthy`: `restart: always` só age na saída do processo.
  - `/api/health` testa só o Postgres (`apps/web/src/app/api/health/route.ts:13`), não Redis nem MinIO.
  - Sentry opcional (`packages/services/src/observability.ts:28-29`) e só via `capturarErro` manual.
    Não há `instrumentation.ts` nos apps Next, então erros de renderização de RSC não são enviados.
  - Postgres sem `log_min_duration_statement` nem `pg_stat_statements` (`docker-compose.yml:192-203`).
- **Reprodução segura:** leitura dos arquivos; `ls apps/web/src/instrumentation*` não encontra nada.
- **Esperado × observado:** esperado alerta em menos de 5 min de queda. Observado nenhum alerta.
- **Impacto:** MTTR alto e cegueira para problemas como o R5-001.
- **Correção proposta:** monitor externo gratuito em `/api/health` dos dois domínios e numa URL de
  `/uploads/`; `instrumentation.ts` com `@sentry/nextjs` ou `onRequestError`; `log_min_duration_statement=500ms`;
  um autoheal simples (cron que reinicia container `unhealthy` há mais de 5 min) ou um alerta.
- **Teste de aceite:** derrubar o web em staging gera alerta em até 5 min; um erro lançado numa page é
  registrado no Sentry.

### R5-011 — Vitrine da cidade sem cache e com carga sem limite

- **Categoria:** Desempenho.
- **Severidade:** Média. Medido em produção com só 12 lojas: **TTFB de 0,435 a 0,757 s**, contra 23 a
  41 ms de servidor no health. HTML de **615.883 B** (174,6 KB gzip), 59% de payload RSC, mais 245 KB
  gzip de JS/CSS. O público usa 3G e celular antigo (comentário em `nginx.conf.template`).
- **Estado:** CONFIRMADO (medição). O crescimento com o volume é HIPÓTESE.
- **Onde:**
  - `apps/web/src/app/[cidade]/page.tsx:20` (`force-dynamic`, sem cache nem para anônimos), `:47-130`
    (cidade → lojas, banners e boosts → produtos), `:255-260` (cliente → pratos, em cascata).
  - `apps/web/src/lib/pratos.ts:121-170`: **todos** os produtos de **todos** os restaurantes da
    cidade, com descrição e imagem, sem `take`, para mostrar 12.
  - `:53-85`: agregação de 30 dias de `order_items × orders` a cada visita.
  - Não há N+1 clássico: `produtosDasLojas` já agrupa
    (`apps/web/src/lib/produtos-da-loja.ts:55-100`), e as relações do Prisma vão em lote.
- **Reprodução segura:** `curl -s -H 'Accept-Encoding: gzip' -o /dev/null -w "%{size_download} %{time_starttransfer}" https://rapidinhoentrega.com.br/palmital-pr` (3 vezes, espaçadas).
- **Esperado × observado:** esperado TTFB abaixo de 200 ms e HTML gzip abaixo de 60 KB. Observado
  0,44 a 0,76 s e 175 KB.
- **Impacto:** primeira tela lenta no 3G; CPU de web e Postgres cresce linearmente com acessos e
  com o catálogo.
- **Correção proposta:** separar a parte anônima (lojas, produtos, pratos) num
  `unstable_cache(…, {revalidate: 30, tags:['vitrine:'+cidade]})`, invalidado nas ações de loja e
  produto. Limitar `products` em `pratosDaCidade` (`take` por loja). Materializar "pedidos por hora"
  numa tabela ou job. Enxugar as props enviadas ao cliente (cartões com menos campos; SVG de arte por
  `<use>` ou sprite).
- **Teste de aceite:** TTFB p50 abaixo de 200 ms em 5 sondas e HTML gzip abaixo de 80 KB na mesma cidade.

### R5-012 — Índices: consultas que crescem com o histórico e chaves estrangeiras sem índice

- **Categoria:** Desempenho / banco.
- **Severidade:** Baixa hoje, porque o volume é pequeno.
- **Estado:** HIPÓTESE. Os planos foram medidos em base quase vazia (`explain.txt`).
- **Onde:**
  - `apps/admin/src/app/loja/pedidos/page.tsx:22-34`: `storeId AND (status IN … OR createdAt >= hoje)`.
    O plano usa só `storeId` no índice e filtra e ordena todo o histórico da loja a cada
    `router.refresh()`.
  - `apps/web/src/lib/pratos.ts:56-68`: o plano entra por `orders_status_idx (DELIVERED)`.
  - `fk-sem-indice.txt`: 39 chaves estrangeiras sem índice (`order_items.productId`,
    `cart_items.productId`, `orders.couponId`, `orders.addressId`…).
  - Os demais índices quentes estão adequados (`sessions_sessionToken_key`,
    `store_boosts_status_startsAt_endsAt_idx`, `orders_store_active_idx`).
- **Reprodução segura:** `docker exec -i rapidinho-postgres psql … < explain.sql` (transação
  READ ONLY com rollback).
- **Correção proposta:** reescrever a consulta do lojista como `UNION` (abertos via
  `orders_store_active_idx` + hoje via `(storeId, createdAt)`); criar `orders(cityId, status, createdAt)`
  e `order_items(productId)` com `CREATE INDEX CONCURRENTLY`, depois de medir com dados sintéticos.
- **Teste de aceite:** com 100 mil pedidos sintéticos em staging, `EXPLAIN ANALYZE` abaixo de 20 ms
  nas duas consultas.

### R5-013 — Encerramento e limites incompletos

- **Categoria:** Infra.
- **Severidade:** Baixa.
- **Estado:** CONFIRMADO (`docker compose … config`).
- **Onde:**
  - Nenhum serviço tem `stop_grace_period`, então vale o padrão de 10 s. O worker promete esperar a
    cobrança terminar (`apps/worker/src/main.ts:121-135`), mas leva SIGKILL depois de 10 s.
  - `migrate` (`docker-compose.prod.yml:22-31`) não tem `mem_limit`, `cpus`, `pids_limit` nem `logging`.
  - `minio-init` não tem `mem_limit` nem `cpus`.
  - O bind no loopback está só no `.env` (`docker-compose.yml:30`, padrão `0.0.0.0:80`); o comentário em
    `docker-compose.prod.yml:9-12` diz o contrário.
  - Positivo: todos os serviços de longa duração têm `cpus`, `pids_limit`, log rotacionado (10 MB × 3),
    healthcheck e `restart: always`. Em produção, Postgres, Redis e MinIO não publicam porta.
    Soma dos tetos: cerca de 4,75 vCPU e 4,7 GB.
- **Correção proposta:** `stop_grace_period: 120s` no worker e 30 s nos apps; limites no migrate;
  `127.0.0.1` fixo no `docker-compose.prod.yml` (`ports: !override`).
- **Teste de aceite:** `docker compose config` mostra os valores; o comando de config com `.env` vazio
  não publica nada em `0.0.0.0`.

### R5-014 — `liberar-espaco.sh` trunca logs de containers de terceiros

- **Categoria:** Isolamento na VPS compartilhada.
- **Severidade:** Baixa: o script não é chamado por nenhum workflow (código morto), mas está no
  repositório como ferramenta oficial.
- **Estado:** CONFIRMADO.
- **Onde:** `.github/scripts/liberar-espaco.sh:86`
  (`find /var/lib/docker/containers -name '*-json.log' -size +200M -exec truncate -s 0 {} \;`), em
  contradição com `:10-15` ("só se remove o que é nosso") e `:95` ("Nada foi removido de outros sites").
- **Correção proposta:** filtrar pelos IDs de `docker ps -q --filter label=com.docker.compose.project=rapidinho`
  ou remover a etapa, já que os logs têm rotação. Decidir se o script fica ou sai.
- **Teste de aceite:** o script só toca arquivos de containers do projeto `rapidinho`.

### R5-015 — Pequenos ajustes de nginx

- **Severidade:** Baixa · **Estado:** CONFIRMADO.
- `Server: nginx/1.18.0 (Ubuntu)` em todas as respostas (`prod-headers.txt`). O nginx do host não tem
  `server_tokens off`; o do container tem (`nginx.conf.template`, bloco http).
- `proxy_cache_valid 200 30d;` (`nginx.conf.template:101`) sem `proxy_cache`/`proxy_cache_path`: não
  tem efeito.
- **Correção:** `server_tokens off` no host (acordar com os vizinhos) e remover ou ativar o cache.
- **Teste:** o `curl -I` mostra `Server: nginx` sem versão.

### R5-016 — Imagens grandes puxadas a cada deploy

- **Severidade:** Baixa · **Estado:** CONFIRMADO (medido via manifesto do GHCR).
- Tamanhos comprimidos: migrate 398,0 MB, worker 170,1 MB, web 112,6 MB, admin 112,0 MB, realtime
  68,3 MB, nginx 21,0 MB, total de cerca de 882 MB.
- A imagem migrate vem do estágio `deps` com o `node_modules` de **todo** o workspace
  (`apps/web/Dockerfile:57-65`). Numa VPS registrada com load 243 e com pulls que já passaram de 50 min
  (`docs/AUDITORIA-OTIMIZACAO-VPS.md:170-174`), isso alonga o deploy.
- **Correção:** um estágio migrate com só `prisma` + `@prisma/client` + `packages/database`
  (`pnpm deploy --filter @rapidinho/database`).
- **Teste:** a imagem migrate fica abaixo de 150 MB comprimida e roda `migrate deploy` em staging.

### R5-017 — Reconfirmação do R3-012 (worker e realtime em `pnpm dev`)

- **Estado:** NÃO REPRODUZIDO, consistente com "corrigido" no REGISTRO.
- **Evidência:**
  - `packages/{database,services,shared}/package.json` têm `"type": "module"`.
  - Os scripts `dev` usam `--env-file-if-exists=../../.env` (`apps/worker/package.json:7`,
    `apps/realtime/package.json:36`).
  - Realtime: `REALTIME_PORT=3292 tsx --env-file-if-exists=../../.env src/server.ts` → `/health` 200
    em 5 s.
  - Worker: importar `@rapidinho/services` e `@rapidinho/database` via tsx resolve `capturarErro`,
    `agendarRotinas`, `notificarUsuario` etc. como função, e `prisma` como objeto.
  - O worker completo não foi iniciado de propósito, para não consumir filas nem acionar provedores
    do `.env`.
- **Lacuna:** o e2e do CI sobe só web e admin (`deploy.yml:85-98`). Worker e realtime não são
  exercitados em nenhum teste de ponta a ponta.

---

## Inspecionado

- `docker-compose.yml`, `docker-compose.prod.yml`, `docker-compose.override.yml`.
- `docker/nginx/*` (container e templates do host).
- Dockerfiles de web, admin, worker e realtime; `.dockerignore`.
- `.github/workflows/ci.yml` e `deploy.yml`; os 8 scripts de `.github/scripts/`.
- `scripts/backup-postgres.sh`, `scripts/restaurar-postgres.sh`, `scripts/diagnosticar-vps.py` e
  `scripts/analisar-vps.py` (sem credencial embutida; usam `AutoAddPolicy`).
- `DEPLOY.md`, `docs/PADRAO-VPS-MULTI-APPS.md`, `docs/AUDITORIA-OTIMIZACAO-VPS.md`,
  `docs/PLANO-OTIMIZACAO-VPS.md`, `Otmização VPS.md`.
- `packages/services/src/{queues,redis,rate-limit,observability}.ts` e `storage/s3.ts`.
- `apps/worker/src/main.ts`.
- `apps/web/src/app/[cidade]/page.tsx`, `apps/web/src/lib/{pratos,produtos-da-loja,media}.ts`,
  `apps/admin/src/app/loja/pedidos/page.tsx`, health routes.
- Migrations (12).

## Testado (comandos)

- Produção, só GET: `/api/health` 5 vezes por domínio; home, vitrine e loja; 15 arquivos estáticos;
  APK, manifest e sw; redirecionamentos http/https/www; `openssl s_client` (TLS, ALPN, certificado);
  5 GETs em `/uploads/`.
- GHCR: `docker manifest inspect -v` das 6 imagens; token anônimo; API pública do repositório.
- quay.io e Docker Hub: `docker manifest inspect` de minio e mc.
- Local: `docker stats --no-stream`, `docker inspect`, `docker system df`, `docker compose … config`
  (`--quiet` e JSON sem segredos); Redis `CONFIG GET` e `INFO`; Postgres (`pg_stat_*`, índices,
  chaves estrangeiras sem índice, EXPLAIN em transação READ ONLY); tempos em 3200 e 3201 (dev, sem
  valor de referência); realtime em dev na porta 3292; imports do worker.

## Não testado e limitações

- **Nenhuma métrica da VPS** (CPU, RAM, disco, steal, `docker stats`, cron, dumps): o SSH foi negado e
  o MCP da Hostinger não foi usado (dúvida sobre ser só leitura). Ficou BLOQUEADO.
- Cold start das imagens, bundle local (não há build; os servidores locais são `next dev`) e carga ou
  pool sob concorrência: HIPÓTESE.
- A causa do R5-001 é inferida pela regra de herança do nginx e pelo formato da URL. O sintoma foi
  medido.
- O R5-009 depende de como o Docker da VPS trata a origem (userland-proxy ou DNAT). Nos dois casos o
  container vê o gateway, mas isso não foi observado diretamente.
- A medição de tempo foi feita de uma única origem, com rede residencial; não representa o 3G.

## Parecer

A infraestrutura melhorou de verdade desde a auditoria anterior:

- todo container de longa duração tem teto de CPU e PIDs, log rotacionado, healthcheck e restart;
- Postgres, Redis e MinIO não publicam porta em produção, e o nginx do app fica no loopback;
- o build saiu da VPS, com tag imutável por SHA;
- o TLS está correto (1.3, h2, HSTS), os redirecionamentos levam ao canônico num salto e o cache de
  estáticos é imutável;
- o pool do Prisma (29 conexões) cabe em `max_connections=50`.

Em produção, os health respondem 200 com 23 a 41 ms de servidor.

Mesmo assim, **o parecer é DESFAVORÁVEL à operação no estado atual**, por quatro motivos de
severidade Alta que não dependem de carga para acontecer:

1. **R5-001:** as imagens enviadas não são servidas em produção. Foi medido: todo `/uploads/` devolve 400.
2. **R5-002 e R5-007:** não há recuperação de desastre possível. A imagem do storage não existe mais,
   o backup fica no mesmo disco e nunca foi restaurado, e as imagens e o `.env` não têm backup.
3. **R5-005 e R5-006:** o deploy não cumpre a promessa de manter a versão anterior no ar, migra sem
   backup prévio e não tem rollback ensaiado.
4. **R5-003:** o acesso à VPS compartilhada é root por senha, com o host não verificado, num
   repositório público.

O R5-009 (rate limit global do OTP) precisa ser confirmado com o log do container. Se confirmado, sobe
para a mesma prioridade, porque trava o único login do cliente.

Ordem recomendada:

1. R5-001 (correção de poucas linhas no nginx);
2. R5-002 (espelhar a imagem em cache para o GHCR hoje);
3. R5-007 e R5-006 (backup externo e dump antes de migrar);
4. R5-005;
5. R5-003 e R5-004;
6. R5-009 (validar e, se confirmado, `real_ip`);
7. R5-008 (`noeviction`);
8. o resto.

R3-011 e R3-013 seguem **abertos e reconfirmados**. O R3-012 está **corrigido** (não reproduzido).
