# Relatório de performance e VPS — R5 (SRE)

Auditoria PIE V2 · commit `d65c0e5` · revisor R5 · data local 2026-11-01 (BRT).
As sondas de produção rodaram em **2026-11-02 02:35–02:40 UTC** (2026-11-01, 23:35–23:40 BRT),
a partir da máquina do revisor (Windows, curl 8.22 / Schannel, sem HTTP/2 no curl).

Scripts e saídas brutas:
`C:\Users\fusea\AppData\Local\Temp\claude\c--FuseDev-rapidinho-entrega\f9c02d86-2f36-47ac-a919-6a836a7d0812\scratchpad\r5`
(arquivos `prod-*.txt`, `image-sizes.txt`, `minio-manifest.txt`, `explain.sql/.txt`, `fk-sem-indice.*`,
`pg-*.txt`, `redis-local.txt`, `docker-local.txt`, `bundle-prod.txt`, `local-timing.txt`).

O documento tem três partes, que não se misturam:

1. **Medições reais**: comando, data e número observado.
2. **Hipóteses e recomendações não medidas**: cada uma diz por que não foi medida.
3. **BLOQUEADO**: o que exigia acesso à VPS.

---

## 1. Medições reais

### 1.1 Produção: saúde (5 requisições por domínio, 3 s de intervalo)

Comando (`prod-health.txt`):

```bash
curl -s -o /dev/null -w "%{http_code} total=%{time_total} ttfb=%{time_starttransfer} tls=%{time_appconnect} conn=%{time_connect}" URL
```

| Domínio | Status | total (s) | TTFB (s) | TLS concluído (s) | TCP (s) |
| --- | --- | --- | --- | --- | --- |
| rapidinhoentrega.com.br/api/health | 200 ×5 | 0,114 – 0,149 (mediana 0,137) | 0,114 – 0,147 | 0,089 – 0,110 | 0,054 – 0,070 |
| painel.rapidinhoentrega.com.br/api/health | 200 ×5 | 0,109 – 0,137 (mediana 0,116) | 0,109 – 0,137 | 0,083 – 0,105 | 0,046 – 0,067 |

- Corpo: `{"status":"ok","service":"web"}` e `{"status":"ok","service":"admin"}`.
- Tempo de servidor estimado (TTFB menos TLS): **23 a 41 ms**. O health faz `SELECT 1` no Postgres
  (`apps/web/src/app/api/health/route.ts:13`).

### 1.2 Produção: páginas quentes (requisições únicas, espaçadas)

| Página | Status | Tamanho sem compressão | Tamanho gzip | TTFB (s) |
| --- | --- | --- | --- | --- |
| `/` | 200 | 110.385 B | — | 0,172 |
| `/palmital-pr` (vitrine da cidade) | 200 | **615.883 B** | **174.599 B** e 174.464 B | **0,757** / 0,435 / 0,496 |
| `/palmital-pr/cantina-da-nona` (loja) | 200 | — | 16.555 B | 0,212 |

Composição do HTML da vitrine (script Python sobre `cidade.html`): **363.568 B (59%) são o payload
RSC** (`self.__next_f.push`), 96.923 B são SVG inline (204 `<svg>`, 597 `<path>`). A cidade tem 12
lojas no ar. Nenhuma URL `/uploads/` aparece na página.

### 1.3 Produção: bundle de JS e CSS (arquivos de `/_next/static` referenciados pela página)

`bundle-prod.txt`: um GET por arquivo, com 0,3 s de intervalo, com e sem `Accept-Encoding: gzip`.

| Página | Arquivos | gzip | Sem compressão |
| --- | --- | --- | --- |
| `/` | 14 | 243.090 B | 794.056 B |
| `/palmital-pr` | 15 | 244.724 B | 797.752 B |

Primeira visita à vitrine pelo celular: cerca de **420 KB gzip** (175 KB de HTML + 245 KB de JS/CSS),
sem contar fontes e imagens.

### 1.4 Produção: TLS, redirecionamentos e cabeçalhos

Arquivos `prod-tls.txt`, `prod-redirects.txt` e `prod-headers.txt`.

- Certificado: Let's Encrypt (YR1), CN `rapidinhoentrega.com.br`, SAN com `painel.`, apex e `www.`.
  Validade de 2026-10-07 a **2027-01-05**. Cadeia verificada (`Verify return code: 0`).
- Os dois hosts negociam TLS 1.3 (`TLS_AES_256_GCM_SHA384`) e ALPN **h2**.
- `http://rapidinhoentrega.com.br/x?y=1` responde 301 para `https://rapidinhoentrega.com.br/x?y=1`.
- `http://www…/x` e `https://www…/x` respondem 301 para `https://rapidinhoentrega.com.br/x`, num salto só.
- `http://painel…/` responde 301 para `https://painel…/`.
- Cabeçalhos da home e de `/entrar` no painel: `Strict-Transport-Security: max-age=31536000; includeSubDomains`,
  `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`,
  `Permissions-Policy` e uma CSP com nonce e `strict-dynamic`.
- `Server: nginx/1.18.0 (Ubuntu)`: o nginx do host expõe a versão.
- HTML dinâmico: `Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate`, com gzip ativo.

### 1.5 Produção: cache de estáticos e do APK (`prod-cache.txt`)

| Recurso | Cache-Control | Observação |
| --- | --- | --- |
| `/_next/static/media/*.woff2` | `public, max-age=31536000, immutable` | correto |
| `/_next/static/css/*.css` (painel) | `public, max-age=31536000, immutable` | correto |
| `/baixar/rapidinho.apk` | `public, max-age=0` com ETag e Last-Modified | 101.135 B, `application/vnd.android.package-archive`; revalida a cada download, o que é adequado para um APK que muda sem mudar de nome |
| `/manifest.webmanifest` | `public, max-age=0, must-revalidate` | `x-nextjs-cache: HIT` |
| `/sw.js` | `no-cache, no-store, must-revalidate` | correto para service worker |

### 1.6 Produção: rota `/uploads/` (MinIO por trás do nginx) — **quebrada**

Arquivo `prod-uploads.txt`, cinco GETs:

```text
GET /uploads/                            → 400 <Code>InvalidRequest</Code> "Invalid Request (invalid hostname)"
GET /uploads/minio/health/live           → 400 (mesma resposta)
GET /uploads/rapidinho/                  → 400 InvalidRequest (invalid hostname)
GET /uploads/rapidinho/public/           → 400 InvalidRequest (invalid hostname)
GET /uploads/rapidinho?list-type=2&...   → 400 InvalidRequest (invalid hostname)
```

O MinIO recusa a requisição na validação do Host, antes de procurar qualquer objeto. Nenhum arquivo
enviado pode ser servido por essa rota (ver R5-001 na banca).

### 1.7 Imagens das releases (GHCR, tag `d65c0e517980…`)

`docker manifest inspect -v`, soma das camadas comprimidas (`image-sizes.txt`). O pacote é público:
o manifesto foi baixado com token anônimo e devolveu HTTP 200.

| Imagem | Camadas | Tamanho comprimido |
| --- | --- | --- |
| web | 12 | 112,6 MB |
| admin | 12 | 112,0 MB |
| realtime | 9 | 68,3 MB |
| worker | 11 | 170,1 MB |
| **migrate** | 22 | **398,0 MB** |
| nginx | 11 | 21,0 MB |
| **Total por deploy** | | **≈ 882 MB** (sem cache de camadas na VPS) |

### 1.8 Imagens de terceiros fixadas no compose (`minio-manifest.txt`)

```text
docker manifest inspect quay.io/minio/minio:RELEASE.2025-09-07T16-13-09Z → no such manifest
docker manifest inspect quay.io/minio/mc:RELEASE.2025-08-13T08-35-41Z    → no such manifest
docker manifest inspect quay.io/minio/minio:latest                       → no such manifest
docker manifest inspect minio/minio:RELEASE.2025-09-07T16-13-09Z         → denied / authentication required
```

### 1.9 Local: Postgres (somente leitura)

- `max_connections` = 50 e `shared_buffers` = 256 MB, iguais ao compose.
- Conexões abertas durante a medição: 15 ociosas do usuário da aplicação (os dois `next dev`) e 1 do psql.
- Banco de 12 MB, com 12 lojas, 105 produtos e 0 pedidos. As estatísticas de `pg_stat_user_tables` estão
  defasadas: `n_live_tup` de `stores` marca 2.
- Pool do Prisma: `connection_limit=8` em web, admin e worker (`docker-compose.yml:66,97,154`), mais 5 no
  migrate (`docker-compose.prod.yml:332`). São 29 conexões no pior caso, abaixo de 50, então
  **não há estouro de conexões**.
- `explain.txt`: EXPLAIN (COSTS OFF) com `enable_seqscan=off` dentro de `BEGIN READ ONLY … ROLLBACK`.
  Com tabelas quase vazias, o plano mostra qual índice **pode** ser usado, não qual será usado em
  produção.
  - Pedidos do lojista: `orders_storeId_status_createdAt_idx` só com `storeId` no Index Cond. O `OR`
    vira filtro e é seguido de um Sort. O custo cresce com **todo o histórico** da loja.
  - Pratos por horário: entra por `orders_status_idx (status='DELIVERED')` e filtra cidade e data.
    Com volume, varre todos os pedidos entregues da plataforma.
  - Produtos das lojas (window), boosts ativos e sessão usam índice adequado.
- `fk-sem-indice.txt`: **39 chaves estrangeiras sem índice próprio**. As mais relevantes são
  `order_items.productId`, `cart_items.productId`, `orders.couponId` e `orders.addressId`.

### 1.10 Local: Redis (`redis-local.txt`)

- `maxmemory-policy` = **allkeys-lru**, `maxmemory` = 256 MB, `appendonly` = yes. O valor bate com
  `docker-compose.yml:238`.
- Uso: 2,5 MB, 57 chaves, `evicted_keys:0`. As chaves `bull:*` (schedulers, order-timeout,
  notifications) convivem com `ratelimit:*` no mesmo Redis.

### 1.11 Local: containers (`docker-local.txt`)

`docker stats --no-stream`:

| Container | CPU | Memória | PIDs |
| --- | --- | --- | --- |
| postgres | 0,66% | 102 MiB | 23 |
| redis | 0,81% | 11,6 MiB | 6 |
| SeaweedFS (substituto do MinIO) | — | 155 MiB | — |

Pelo `docker inspect`, os containers locais têm `cpus` e `pids_limit` do compose e não têm `mem_limit`,
que só existe no override de produção.

### 1.12 Local: tempo de resposta (`local-timing.txt`)

Os servidores em 3200 e 3201 rodam **`next dev`**, sem `.next/BUILD_ID`. Os tempos (5 a 27 s no web,
0,2 a 0,8 s no painel) medem a compilação sob demanda e **não servem como referência de desempenho**.
Também não há build pronto para medir o bundle localmente, por isso o bundle foi medido em produção
(§1.3).

### 1.13 Local: R3-012

- `REALTIME_PORT=3292 tsx --env-file-if-exists=../../.env src/server.ts`: `/health` respondeu 200 em 5 s.
- No worker, importar `@rapidinho/services` e `@rapidinho/database` com tsx resolve `capturarErro`,
  `agendarRotinas` e os demais exports, e `prisma` é um objeto.
- O worker em si não foi iniciado de propósito: consumiria filas e poderia acionar provedores
  configurados no `.env`.

---

## 2. Hipóteses e recomendações não medidas

| # | Hipótese | Por que não foi medido | Recomendação |
| --- | --- | --- | --- |
| H1 | O `limit_req` do nginx interno vê o IP do gateway do Docker para **todos** os clientes, então os 6 OTP/min e os 30 r/s em `/api/` valem para a plataforma inteira (R5-009) | Exige ler o `$remote_addr` no access log do container na VPS (BLOQUEADO). Não dá para provar com carga em produção | `set_real_ip_from 172.16.0.0/12; real_ip_header X-Real-IP;` no nginx interno, ou mover o `limit_req` para o nginx do host |
| H2 | A vitrine piora linearmente: `pratosDaCidade` carrega todos os produtos de todos os restaurantes da cidade, e a agregação de 30 dias roda a cada visita | Não há base com volume, e a carga em produção é proibida | Cache de 30 a 60 s por cidade (`unstable_cache` com tag), `take` nos produtos, agregação materializada por hora |
| H3 | Índice `orders(cityId, status, createdAt)` e reescrita do `OR` de pedidos do lojista em `UNION` | Plano medido em tabela vazia | Medir com dados sintéticos em staging antes de criar |
| H4 | Cold start: web e admin levam até 40 s (`start_period`) e o worker até 90 s | Não há imagem local nem permissão para subir as imagens de produção na VPS | Medir `docker run` até o primeiro 200 em staging |
| H5 | O pool de 8 conexões pode enfileirar com vitrines simultâneas (cerca de 10 consultas por render) | Exige carga | Medir `pool_timeout` com k6 em staging |
| H6 | A reescrita de AOF do Redis (fork) pode passar de 320 MB perto do `maxmemory` | Uso atual de 2,5 MB | `noeviction` mais alerta de memória do Redis |
| H7 | Puxar 882 MB por deploy numa VPS já registrada com load 243 deixa o deploy lento | Sem métricas da VPS | Reduzir a imagem migrate: `prisma` CLI só com `--prod` e sem o `node_modules` inteiro do workspace |
| H8 | O nginx 1.18 do host (Ubuntu) pode não ter correções recentes | Versão vista só pelo cabeçalho | `server_tokens off` no host e conferir os patches da distribuição |

---

## 3. BLOQUEADO

| Item | Motivo |
| --- | --- |
| CPU, RAM, swap, load, steal time e disco da VPS | O SSH à VPS foi **negado** nesta sessão pelo modo de permissões, e o revisor não tentou contornar |
| `docker stats` e `docker ps` em produção; uso real × `mem_limit` | Mesmo motivo |
| Existência e idade dos dumps em `/opt/rapidinho/backups`; cron instalado; `backup.log` | Mesmo motivo |
| Teste de restauração do backup | Mesmo motivo; nada indica no repositório que já tenha sido feito |
| Logs do nginx do container (IP visto pelo `limit_req`) | Mesmo motivo |
| Métricas pelo MCP `hostinger-vps` | Não usado. Não houve garantia de que todas as operações fossem só de leitura, e o protocolo manda registrar como BLOQUEADO na dúvida |
| Teste de carga | Proibido em produção pelo escopo |
| TLS 1.0/1.1 recusados | O OpenSSL local não oferece mais esses protocolos, então o teste foi inconclusivo. O template só lista `TLSv1.2 TLSv1.3` (`docker/nginx/host/rapidinho-https.conf.template:35`) |

---

## Adendo do Auditor-Chefe (2026-11-02): o que mudou na infraestrutura nesta rodada

| Item | Mudança | Medição |
|---|---|---|
| R5-001 `/uploads` | `proxy_pass` com o bucket, `Host minio:9000`, `nosniff` e sem `Set-Cookie` | `nginx -t` ok; a resposta 200 em produção ainda precisa ser **medida depois do deploy** |
| R5-009 limit_req global | `set_real_ip_from` (redes privadas) + `real_ip_header X-Real-IP` | Não medido: depende do log do nginx em produção |
| R5-008 Redis | `--maxmemory-policy noeviction` | Sem medição nova; uso anterior medido de 2,5 MB de 256 MB |
| R5-004 segredos no ssh | stdin com `%q` | Simulação local |

Não houve nova medição de CPU, RAM ou disco da VPS: o acesso continua bloqueado. Nenhum número foi estimado.
