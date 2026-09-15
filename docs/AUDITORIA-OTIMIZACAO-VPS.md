# Auditoria de consumo de recursos — Rapidinho Entrega

> Feita em 2026-09-15 sobre o commit `c457202`.
> Toda afirmação numérica está marcada como **MEDIDO**, **ESTIMADO** ou **NÃO MEDIDO**.
> `MEDIDO` significa que um comando foi executado e o resultado observado; o comando está citado.

## Contexto desta auditoria

| Campo                     | Valor                                                                                  |
| ------------------------- | -------------------------------------------------------------------------------------- |
| Aplicação                 | Rapidinho Entrega — marketplace de delivery multi-cidade (Palmital/PR)                 |
| Stack                     | pnpm + Turborepo, Next.js 15, Prisma 6, Postgres 16, Redis 7, MinIO, Socket.io, BullMQ |
| VPS                       | 15,6 GB RAM, 194 GB disco (**MEDIDO**). vCPU: **NÃO MEDIDO**                           |
| Outras apps no mesmo host | Compartilhada, quantidade **NÃO MEDIDA**                                               |
| Acesso à VPS nesta sessão | **Não.** Só através do runner do GitHub Actions                                        |
| Deploy                    | GitHub Actions; build no runner desde `cf8ca35`                                        |
| Commit dispara deploy     | **Sim** — push na `main` publica                                                       |
| Suíte de testes           | Existe e roda: 107 unitários + 16 E2E (**MEDIDO**)                                     |

### O que não pôde ser medido, e por quê

Não tenho shell na VPS — a senha é secret do repositório e não passa por esta sessão. Também não
há daemon Docker neste ambiente, então **nenhum tamanho de imagem construída foi medido**. Onde
isso importa, o número está marcado ESTIMADO com a base do cálculo.

- Contagem de vCPU da VPS — **NÃO MEDIDO**
- **Steal time** — **NÃO MEDIDO**, e é a lacuna mais importante (ver §6)
- Tamanho real das imagens Docker — **NÃO MEDIDO**
- Consumo de RAM por container em pico — **NÃO MEDIDO**
- `docker system df` — **tentado e falhou**: não respondeu em 60 s

---

## 1. Resumo executivo

A aplicação em si **não tem vazamento nem desperdício estrutural**. Os clientes de banco, Redis,
filas e S3 são todos singletons corretos, não há polling, e os jobs agendados rodam em frequência
razoável. O problema de consumo está em três lugares, nenhum deles no código de negócio:

1. **Ausência total de proteção de recursos.** Nenhum dos 9 containers tem limite de CPU, nenhum
   tem `pids_limit`, e nenhum tem política de log. Num host compartilhado isso significa que esta
   aplicação _pode_ comprometer as outras — e que os logs crescem sem teto.
2. **Imagens carregando o que não executam.** As imagens de `worker` e `realtime` levam
   devDependencies para produção, e o cliente Prisma gerado localmente entra no contexto de build.
3. **Banco sem dimensionamento.** `mem_limit: 1g` no Postgres sem ajustar `shared_buffers`,
   `work_mem` ou `max_connections`, e sem `connection_limit` no Prisma.

**Ressalva que muda a leitura de tudo:** a VPS foi medida com **load average 243** e 2,7 GB de swap
em uso, assim já na média de 15 minutos — ou seja, antes de qualquer deploy nosso encostar nela.
Nenhuma otimização aqui dentro explica ou resolve isso. Ver §6.

---

## 2. Arquitetura atual

```
internet ─443─► nginx do HOST ─► nginx do CONTAINER (porta única) ─┬─► web:3000    (PWA cliente)
                                                                   └─► admin:3001  (lojista + super admin)
                                       realtime:3002 (Socket.io sobre Redis) ◄── WebSocket
                                       worker (BullMQ, 7 filas) ─► postgres, redis, minio
```

Arquivos de orquestração realmente usados em produção (**MEDIDO** — `grep` no workflow):
`docker-compose.yml` + `docker-compose.prod.yml`. O `docker-compose.override.yml` é só de
desenvolvimento e o CI nunca o carrega, porque passa `-f` explícito.

---

## 3. Inventário de containers

Classificação conforme §1.4 do prompt de auditoria.

| Serviço    | Classificação             | mem_limit   | cpus        | pids        | log         | Observação                            |
| ---------- | ------------------------- | ----------- | ----------- | ----------- | ----------- | ------------------------------------- |
| nginx      | Necessário                | **ausente** | **ausente** | **ausente** | **ausente** | Porta única; gzip e cache já corretos |
| web        | Necessário                | 1g          | **ausente** | **ausente** | **ausente** | PWA do cliente                        |
| admin      | Necessário                | 768m        | **ausente** | **ausente** | **ausente** | Lojista + super admin                 |
| realtime   | Necessário mas otimizável | 256m        | **ausente** | **ausente** | **ausente** | Imagem leva devDeps (§4)              |
| worker     | Necessário mas otimizável | 768m        | **ausente** | **ausente** | **ausente** | Idem; e sem healthcheck               |
| postgres   | Necessário mas otimizável | 1g          | **ausente** | **ausente** | **ausente** | Sem tuning (§5)                       |
| redis      | Necessário                | 320m        | **ausente** | **ausente** | **ausente** |                                       |
| minio      | Necessário                | 512m        | **ausente** | **ausente** | **ausente** | Tag `latest`, móvel                   |
| minio-init | Necessário (one-shot)     | —           | —           | —           | —           | Cria o bucket e sai                   |

**Nenhum container é Obsoleto ou Duplicado.** Cada um tem ciclo de vida próprio: o `realtime`
existe porque o Next em modo standalone não expõe o servidor HTTP para anexar WebSocket, e o
`worker` porque job pesado no mesmo processo que atende requisição rouba CPU de quem espera a
página. Juntá-los reduziria a contagem de containers e pioraria a aplicação.

---

## 4. Dependências

**MEDIDO** com `pnpm --filter <app> deploy [--prod]` e `du -sm`:

| App      | node_modules com devDeps | prod-only  | Desperdício       |
| -------- | ------------------------ | ---------- | ----------------- |
| realtime | **174 MB**               | **16 MB**  | **158 MB (−91%)** |
| worker   | **452 MB**               | **334 MB** | **118 MB (−26%)** |

Causa (**MEDIDO** — leitura dos Dockerfiles): o estágio `deps` roda `pnpm install --frozen-lockfile`
sem `--prod`, e o estágio `runner` copia `/app/node_modules` inteiro. O `realtime` executa apenas
`socket.io`, `ioredis` e `pino`; carrega junto `typescript`, `eslint`, `tsx` e `@types/node`.

O `web` e o `admin` **não têm esse problema**: usam `output: standalone` do Next, que já poda a
árvore. **MEDIDO**: 122 MB de standalone + 1,6 MB de static por app.

### Contexto de build

**MEDIDO** (varredura aplicando as regras do `.dockerignore`):

|                                            | Tamanho           |
| ------------------------------------------ | ----------------- |
| Contexto enviado hoje                      | **50,7 MB**       |
| Dentro dele, `packages/database/generated` | **42,8 MB (84%)** |
| Contexto se `generated` fosse ignorado     | **7,9 MB**        |

O `.dockerignore` **não cobre** `packages/database/generated`. O Dockerfile roda
`prisma generate` de qualquer forma (linha 30 dos três), então o diretório enviado é descartado —
mas viaja no contexto a cada build.

Pior: o cliente gerado em máquina glibc contém `libquery_engine-debian-openssl-3.0.x.so.node`
(**MEDIDO: 16,7 MB**), que é inútil numa imagem Alpine. Como `prisma generate` escreve no mesmo
diretório sem remover arquivos estranhos, **ESTIMADO** que esse engine sobrevive dentro da imagem.

### Configuração morta

`apps/admin/Dockerfile` tem um estágio `FROM builder AS migrator` que **nada referencia**: o
serviço `migrate` usa `apps/web/Dockerfile` (**MEDIDO** — `grep` nos composes). Docker só constrói
o alvo pedido, então isso não custa tempo de build; é configuração morta a limpar, não desperdício.

---

## 5. Banco de dados

| Item                                            | Estado                                                             |
| ----------------------------------------------- | ------------------------------------------------------------------ |
| `mem_limit` do container                        | 1g (**MEDIDO** no compose)                                         |
| `shared_buffers`, `work_mem`, `max_connections` | **Não configurados** — usam o padrão do Postgres 16                |
| `connection_limit` do Prisma                    | **Ausente** — usa o padrão `nº_cpus × 2 + 1`                       |
| Serviços que abrem conexão                      | `web`, `admin`, `worker`, `migrate` (**MEDIDO**)                   |
| Índices de busca                                | Presentes e **agora efetivamente usados** (corrigido em `60092c6`) |

Esta é a armadilha nomeada na §1.6 do prompt: **limitar a memória do banco sem ajustar a
configuração dele faz o processo ser morto por falta de memória sob carga** — pior do que não
limitar. Hoje o Postgres acredita que tem a máquina inteira.

O `connection_limit` ausente é o mesmo risco pelo outro lado: o container enxerga os núcleos do
**host**, não os do limite. Com 4 processos falando com o banco, **ESTIMADO** que o total de
conexões possa passar de 50 — cada backend do Postgres custa memória, dentro de um teto de 1 GB.

🔴 **Nenhum dado será apagado.** Não há proposta de retenção neste documento.

---

## 6. Infraestrutura — o achado que domina todos os outros

**MEDIDO na VPS** em 2026-09-14 16:16 UTC, pelo passo de diagnóstico do deploy #21:

```
load average: 243.67, 245.10, 247.30
Mem:  15988 total, 7684 used, 494 free, 7809 buff/cache, 7509 available
Swap:  4095 total, 2757 used, 1338 free
Disco: /dev/sda1 194G, 162G usados, 32G livres (84%)
uptime: 144 dias
docker system df: não respondeu em 60 s
```

Load average 243 numa máquina que deveria girar perto do número de núcleos. E **estável nas três
janelas** (1, 5 e 15 minutos), o que significa que já estava assim antes do deploy começar.

Consequências observadas, todas **MEDIDAS** nos logs dos deploys:

- Deploy #20: transferir um Dockerfile de **1,82 kB levou 1484 segundos**
- Deploy #21: `TLS handshake timeout` contra o Docker Hub
- Deploy #24: `docker load` passou de 50 minutos

⚠️ **Steal time não foi medido, e é a pergunta que falta.** A §2.6 do prompt de auditoria é
explícita: se o provedor não entrega a CPU contratada, o load alto não vem da aplicação e nenhuma
otimização resolve. Sem esse número **não é possível afirmar** de quem é a carga. O plano inclui
adicionar essa medição ao deploy.

**Não atribuo esse load à aplicação.** Os containers do Rapidinho respondem: o site retorna 200 e
`/api/health` responde `ok` (**MEDIDO** por `curl` várias vezes durante a sessão).

---

## 7. Armazenamento por categoria

| Categoria                        | Tamanho             | Origem                           | Retenção hoje                         |
| -------------------------------- | ------------------- | -------------------------------- | ------------------------------------- |
| Logs de container                | **NÃO MEDIDO**      | driver `json-file` padrão        | **Nenhuma** — cresce sem teto         |
| Releases antigas                 | **NÃO MEDIDO**      | `/opt/rapidinho/releases/`       | Poda existente em `liberar-espaco.sh` |
| Imagens Docker                   | **NÃO MEDIDO**      | `docker system df` não respondeu | Poda por idade acima de 48 h          |
| Volumes (postgres, redis, minio) | **NÃO MEDIDO**      | dados reais                      | Backup diário 03:15                   |
| Volumes órfãos                   | **NÃO MEDIDO**      | —                                | ⚠️ nunca verificados                  |
| Contexto de build                | **MEDIDO: 50,7 MB** | repo                             | —                                     |
| `node_modules` local             | **MEDIDO: 1003 MB** | desenvolvimento                  | fora da imagem                        |

**A ausência de política de log é o maior risco silencioso de disco.** Com 84 % do disco já em uso
e o driver padrão sem rotação, um erro em laço pode encher o disco e derrubar **todas** as
aplicações do host.

---

## 8. Problemas por severidade

| #   | Severidade | Problema                                            | Evidência         |
| --- | ---------- | --------------------------------------------------- | ----------------- |
| 1   | 🔴 CRÍTICA | Nenhum container tem limite de CPU nem `pids_limit` | MEDIDO no compose |
| 2   | 🔴 CRÍTICA | Nenhum container tem política de log; disco a 84 %  | MEDIDO            |
| 3   | 🟠 ALTA    | Postgres limitado a 1 GB sem tuning interno         | MEDIDO            |
| 4   | 🟠 ALTA    | `connection_limit` do Prisma ausente                | MEDIDO            |
| 5   | 🟠 ALTA    | Steal time nunca medido; load 243 sem dono          | NÃO MEDIDO        |
| 6   | 🟡 MÉDIA   | `realtime` leva 158 MB de devDeps                   | MEDIDO            |
| 7   | 🟡 MÉDIA   | `worker` leva 118 MB de devDeps                     | MEDIDO            |
| 8   | 🟡 MÉDIA   | `generated/` = 84 % do contexto de build            | MEDIDO            |
| 9   | 🟡 MÉDIA   | `nginx` sem `mem_limit`                             | MEDIDO            |
| 10  | 🔵 BAIXA   | `minio:latest` e `mc:latest` — tags móveis          | MEDIDO            |
| 11  | 🔵 BAIXA   | Estágio `migrator` morto no Dockerfile do admin     | MEDIDO            |
| 12  | 🔵 BAIXA   | `worker` sem healthcheck                            | MEDIDO            |
| 13  | 🔵 BAIXA   | Volumes órfãos nunca verificados                    | NÃO MEDIDO        |

---

## 9. O que já está correto — não mexer

Esta seção existe para impedir que uma próxima passagem "otimize" o que já está certo.

- **Singletons de recurso.** `prisma` com guarda em `globalThis`, `getRedis()` com cache,
  `getQueue()` com `Map`, e as seis fábricas de provedor (`getStorage`, `getPush`, `getEmail`,
  `getWhatsApp`, `getOtpSender`, `getPaymentGateway`) todas memoizadas. **Nenhum recurso é criado
  por requisição** — o achado mais perigoso da §2.2 simplesmente não existe aqui.
- **Sem polling.** O painel de pedidos usa `router.refresh()` disparado por evento de socket, não
  por relógio. Verificado: nenhum `setInterval` em código de servidor.
- **Jobs em frequência sadia.** Cobrança diária (`0 12 * * *`) e expiração de impulsionamento de
  hora em hora (`5 * * * *`).
- **Multi-stage em todos os Dockerfiles**, com `deps` / `builder` / `runner` separados.
- **`output: standalone`** no web e no admin, que já poda a árvore de dependências.
- **`.dockerignore` cobre** `node_modules`, `.next`, `.turbo`, `dist`, `.git`, `coverage` e `.env`.
- **nginx com gzip** e `Cache-Control: immutable` para estáticos.
- **Usuário não-root** em todos os runtimes.
- **Healthchecks** em 7 dos 9 serviços.
- **Build já saiu da VPS** (`cf8ca35`) — regra "build fora da máquina de produção" já cumprida.
- **Limpeza com escopo restrito**: `liberar-espaco.sh` nunca usa `prune -a`, filtra por idade e só
  age abaixo de um limiar de espaço livre. Correto para host compartilhado.

---

## 10. Linha de base

| Métrica                                 | Valor                              | Origem                                          |
| --------------------------------------- | ---------------------------------- | ----------------------------------------------- |
| Contexto de build                       | 50,7 MB                            | **MEDIDO**                                      |
| `node_modules` realtime (imagem)        | 174 MB                             | **MEDIDO**                                      |
| `node_modules` worker (imagem)          | 452 MB                             | **MEDIDO**                                      |
| Standalone web / admin                  | 122 MB / 122 MB                    | **MEDIDO**                                      |
| First Load JS compartilhado             | 102 kB                             | **MEDIDO** (`pnpm build`)                       |
| Build das 5 imagens no runner           | 6 min 38 s                         | **MEDIDO** (deploy #24)                         |
| `lint` / `typecheck` / `test` / `build` | 9/9, 9/9, 107 testes, 4/4          | **MEDIDO**                                      |
| Lighthouse celular (home)               | perf 97, a11y 100, bp 100, seo 100 | **MEDIDO**                                      |
| Containers em produção                  | 9                                  | **MEDIDO**                                      |
| Containers com limite de CPU            | **0 de 9**                         | **MEDIDO**                                      |
| Containers com `pids_limit`             | **0 de 9**                         | **MEDIDO**                                      |
| Containers com política de log          | **0 de 9**                         | **MEDIDO**                                      |
| RAM/CPU por container em pico           | —                                  | **NÃO MEDIDO**                                  |
| Tamanho das imagens                     | —                                  | **NÃO MEDIDO** (sem daemon Docker nesta sessão) |
| Steal time da VPS                       | —                                  | **NÃO MEDIDO**                                  |

---

## 11. Correções a esta auditoria (§1.3)

Escritas depois da implementação, quando a execução contradisse o diagnóstico.
Um relatório que esconde o próprio erro é pior que um incompleto.

### 11.1 O §1 dizia "a aplicação não tem desperdício estrutural". Estava incompleto.

Não tinha desperdício, mas **dois dos nove containers não iniciavam**. Descoberto ao tentar
executar os binários durante a implementação — a auditoria só leu configuração, e leitura não
pega isso.

| Serviço               | Erro                                          | Origem                               |
| --------------------- | --------------------------------------------- | ------------------------------------ |
| `realtime`            | `ERR_MODULE_NOT_FOUND: './logger'`            | **Introduzido por mim** em `1e6ce89` |
| `realtime` e `worker` | `ERR_MODULE_NOT_FOUND` em `@rapidinho/shared` | Pré-existente                        |
| `worker`              | `BullMQ: maxRetriesPerRequest must be null`   | Pré-existente                        |

Causa comum dos dois primeiros: `apps/realtime`, `apps/worker` e `packages/shared` são ESM
(`"type": "module"`), e o carregador ESM do Node **exige extensão** em import relativo. O código
não as tem. Comprovado que corrigir por extensão não resolve: **o Node não mapeia `./x.js` para
`x.ts`** (testado em caso mínimo isolado).

O terceiro é independente: o BullMQ recusa conexão com `maxRetriesPerRequest` diferente de `null`
porque usa comandos bloqueantes, e `getRedis()` usava `3`.

**Nenhum deploy chegou a subir container desde que esses serviços existem** (todos falharam antes),
então isso nunca apareceu em produção. Apareceria no primeiro deploy bem-sucedido, como queda das
filas e do tempo real.

### 11.2 A §3 classificava `realtime` e `worker` como "Necessário mas otimizável". Errado.

Eram **funcionalidade quebrada** (§1.5 do prompt): código presente, consumidor presente, serviço
que não executa. A classificação correta teria mudado a prioridade — e mudou: limitar CPU de
container que não sobe não serve para nada.

### 11.3 Introduzi uma duplicação e desfiz

Ao tirar o cliente do Prisma do pacote, copiei-o para `dist/prisma-client/` — mas ele **já vinha**
em `node_modules` pela árvore de produção. Eram 43 MB duplicados, **medidos**. Corrigido expondo
`./generated/client` nos `exports` de `@rapidinho/database` e mantendo-o externo por nome:
`dist` caiu de 46 MB para 3 MB.

### 11.4 Pendente, não resolvido

A árvore "de produção" do worker ainda traz **o CLI do `prisma` (34 MB) e o `typescript` (23 MB)**
(**MEDIDO**), porque o `@prisma/client` os declara como peers opcionais e o pnpm os instala. São
57 MB que nada executam em runtime. Não resolvi: exige mexer em resolução de peer do pnpm, com
risco de quebrar o build. **Fica registrado como decisão pendente.**

---

## 12. Por que o deploy não roda (respondido pela API do GitHub)

A auditoria registrava isto como inferência. Agora é **MEDIDO**, pela anotação do próprio job
(`GET /repos/{repo}/check-runs/{job}/annotations`):

> _The job was not started because recent account payments have failed or your spending limit
> needs to be increased. Please check the 'Billing & plans' section in your settings_

Os jobs terminam em ~7 s, com `total_ms: 0` e **nenhum runner atribuído** — nada a ver com o
código, o workflow ou a VPS. Enquanto o faturamento não for regularizado, **nenhum deploy roda**,
e nenhuma das otimizações deste documento chega à produção.

### Steal time continua NÃO MEDIDO

Tentei medir por SSH direto e não foi possível: **a porta 22 está bloqueada na saída** do ambiente
onde esta sessão roda (só 443 passa, através do proxy). Tunelar SSH pelo proxy é escapar da
contenção do ambiente, e não foi feito.

`scripts/diagnosticar-vps.py` responde a essa pergunta em um comando, executado de uma máquina com
acesso à VPS:

```bash
pip install paramiko
VPS_PASSWORD='...' python3 scripts/diagnosticar-vps.py
```

Ele é somente-leitura. Se a coluna `st` do `vmstat` vier alta, o load 243 é da hospedagem e
nenhuma otimização no código resolve — e é essa a conversa a ter com o provedor.
