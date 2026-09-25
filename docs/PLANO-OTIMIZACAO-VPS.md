# Plano de otimização — Rapidinho Entrega na VPS compartilhada

> Derivado de `AUDITORIA-OTIMIZACAO-VPS.md`. Ordenado por **impacto ÷ risco**, respeitando
> dependências. Itens que exigem medição em produção ficam por último.
>
> **Regra que não pode ser quebrada:** nenhuma funcionalidade sai. A meta é consumir menos
> mantendo a mesma capacidade funcional.

## Ordem de execução

| #   | Prioridade | Item                                        | Impacto          | Risco  |
| --- | ---------- | ------------------------------------------- | ---------------- | ------ |
| 1   | 🔴 CRÍTICA | Política de log em todos os containers      | Alto             | Mínimo |
| 2   | 🔴 CRÍTICA | `pids_limit` em todos os containers         | Alto             | Mínimo |
| 3   | 🔴 CRÍTICA | Limite de CPU em todos os containers        | Alto             | Médio  |
| 4   | 🔴 CRÍTICA | `mem_limit` no nginx                        | Médio            | Mínimo |
| 5   | 🟠 ALTA    | Tuning do Postgres dentro do limite de 1 GB | Alto             | Médio  |
| 6   | 🟠 ALTA    | `connection_limit` explícito no Prisma      | Alto             | Baixo  |
| 7   | �          | Medi��es na VPS (fora do escopo)            | Ignorado         | �      |
| 8   | 🟡 MÉDIA   | `realtime` com dependências só de produção  | −158 MB          | Baixo  |
| 9   | 🟡 MÉDIA   | `worker` com dependências só de produção    | −118 MB          | Baixo  |
| 10  | 🟡 MÉDIA   | Ignorar `generated/` no contexto de build   | −42,8 MB         | Mínimo |
| 11  | 🔵 BAIXA   | Fixar versão do MinIO                       | Previne surpresa | Mínimo |
| 12  | 🔵 BAIXA   | Remover estágio `migrator` morto do admin   | Higiene          | Mínimo |
| 13  | 🔵 BAIXA   | Healthcheck do worker                       | Observabilidade  | Baixo  |

---

## 1. 🔴 Política de log em todos os containers

**Problema.** Nenhum dos 9 containers configura `logging` (**MEDIDO**). O driver `json-file` padrão
do Docker **não tem rotação**: cresce até encher o disco. A VPS está com 84 % de uso (**MEDIDO**).
Num host compartilhado, encher o disco derruba **todas** as aplicações, não só esta.

**Solução.** `json-file` com `max-size: 10m` e `max-file: 3` em todos os serviços, via âncora YAML
para não repetir nove vezes.

**Impacto.** Teto de 30 MB por container, 270 MB no total (**ESTIMADO** — 9 × 3 × 10 MB). Hoje o
teto é o disco inteiro.

**Risco.** Mínimo. Perde-se histórico além de 30 MB por container; o que importa vai para o Pino em
JSON e, quando houver DSN, para o Sentry.

**Arquivos.** `docker-compose.yml`

**Testar.** `docker compose config` valida; conferir que todo serviço herdou a âncora.
**Medir.** `du -sh /var/lib/docker/containers/*/*-json.log` na VPS.
**Reverter.** Remover a chave `logging`.

---

## 2. 🔴 `pids_limit` em todos os containers

**Problema.** Nenhum container limita processos (**MEDIDO**). Um vazamento de processos ou fork bomb
consome a tabela de PIDs do **host** e afeta as outras aplicações.

**Solução.** `pids_limit` dimensionado por serviço.

| Serviço             | pids_limit | Justificativa                                                 |
| ------------------- | ---------- | ------------------------------------------------------------- |
| web, admin          | 256        | Node usa ~40 threads; folga de 6×                             |
| worker              | 256        | sharp abre threads de libvips                                 |
| realtime            | 128        | processo único, I/O bound                                     |
| postgres            | 512        | **um processo por conexão** + autovacuum + background writers |
| redis, nginx, minio | 128        |                                                               |

**Impacto.** Isolamento de falha. Uma app deixa de conseguir comprometer o host — critério de
sucesso nº 6.

**Risco.** Mínimo se dimensionado com folga. O valor do Postgres **depende do item 5**
(`max_connections`): precisa ser maior que ele.

**Dependencia.** Nenhuma; a etapa de medicao na VPS foi exclu;da do escopo.
**Testar.** Subir e conferir `docker compose ps`; o Postgres precisa aceitar conexões.
**Medir.** `cat /sys/fs/cgroup/pids.current` no container.
**Reverter.** Remover a chave.

---

## 3. 🔴 Limite de CPU em todos os containers

**Problema.** Nenhum container limita CPU (**MEDIDO**). É a proteção que falta para o critério
"uma aplicação não consegue comprometer todo o host".

**Solução.** `cpus` por serviço, com o worker deliberadamente abaixo dos apps que atendem usuário.

| Serviço  | cpus | Justificativa                                            |
| -------- | ---- | -------------------------------------------------------- |
| web      | 1.0  | Atende o cliente final; é quem não pode engasgar         |
| admin    | 0.75 | Menos tráfego que o web                                  |
| postgres | 1.0  | Serve os três apps                                       |
| worker   | 0.5  | Trabalho de fundo **deve** ceder para quem espera a tela |
| nginx    | 0.5  | Só roteia e comprime                                     |
| minio    | 0.5  | I/O, não CPU                                             |
| realtime | 0.25 | Repassa mensagens; I/O bound                             |
| redis    | 0.25 | Operações O(1) em memória                                |

**Impacto.** ⚠️ **ESTIMADO, não medido.** Não medi consumo de CPU por container em pico — não tenho
shell na VPS. Os valores vêm do perfil de cada processo, não de medição.

`cpus` é **teto, não reserva**: um container ocioso não segura nada. A soma (4,75) pode passar do
número de vCPU sem problema — significa apenas que sob pico simultâneo há disputa, e é por isso que
o worker recebe a menor fatia.

**Risco.** Médio, e é o item mais arriscado do plano. Teto baixo demais causa lentidão sob pico.
Mitigação: os valores são **sobrescrevíveis por variável de ambiente**, para ajustar na VPS sem
novo deploy. Os limites permanecem como tetos configurados; n�o ser�o calibrados por medi��es na VPS.

**Dependencia.** Nenhuma; a etapa de medicao na VPS foi exclu;da do escopo.

**Testar.** `docker compose config`; suíte E2E contra os containers.
**Medir.** Fora do escopo por decis�o: n�o coletar m�tricas na VPS.
**Reverter.** `RAPIDINHO_CPUS_<serviço>` no `.env`, sem redeploy.

---

## 4. 🔴 `mem_limit` no nginx

**Problema.** Único serviço de longa duração sem teto de memória (**MEDIDO**).
**Solução.** `mem_limit: 128m`. **Impacto.** Fecha a última porta aberta. **Risco.** Mínimo — nginx
com proxy e gzip opera bem abaixo disso (**ESTIMADO**).
**Arquivos.** `docker-compose.yml`. **Reverter.** Remover a chave.

---

## 5. 🟠 Tuning do Postgres dentro do limite de 1 GB

**Problema.** `mem_limit: 1g` sem ajustar a configuração interna (**MEDIDO**). O Postgres acredita
que tem a máquina inteira: `shared_buffers` 128 MB, `max_connections` 100, `work_mem` 4 MB.

Esta é **exatamente a armadilha da §1.6** do prompt de auditoria: limite externo sem ajuste interno
faz o processo ser morto por falta de memória **sob carga** — pior do que não limitar.

**Solução.** `command:` explícito, dimensionado para caber em 1 GB:

| Parâmetro              | Valor | Razão                                   |
| ---------------------- | ----- | --------------------------------------- |
| `shared_buffers`       | 256MB | 25 % do limite, recomendação oficial    |
| `effective_cache_size` | 512MB | Estimativa para o planejador; não aloca |
| `work_mem`             | 4MB   | Pior caso 50 × 4 = 200 MB               |
| `maintenance_work_mem` | 64MB  | Vacuum e criação de índice              |
| `max_connections`      | 50    | Ver item 6                              |

Soma no pior caso: 256 + 200 + 64 ≈ 520 MB, mais ~5 MB por backend. Cabe em 1 GB com folga
(**ESTIMADO** a partir da documentação do Postgres 16).

**Risco.** Médio. `max_connections` baixo demais recusa conexão. Mitigação: o item 6 limita o pool
de cada app para caber com folga.

**Dependencia.** Nenhuma; a etapa de medicao na VPS foi exclu;da do escopo.
**Testar.** Subir o Postgres e rodar a suíte; `SHOW shared_buffers;`.
**Medir.** `SELECT count(*) FROM pg_stat_activity;` sob uso.
**Reverter.** Remover o `command:` — volta ao padrão.

---

## 6. 🟠 `connection_limit` explícito no Prisma

**Problema.** A URL do banco não define `connection_limit` (**MEDIDO**), então o Prisma usa
`nº_cpus × 2 + 1`. O container enxerga os núcleos do **host**, não os do seu limite. Com `web`,
`admin`, `worker` e `migrate` falando com o banco, **ESTIMADO** que o total possa passar de 50
conexões — cada backend do Postgres custa memória dentro de um teto de 1 GB.

**Solução.** `connection_limit=8` na `DATABASE_URL` de cada app, gerada em `preparar-env.sh`.

Orçamento: web 8 + admin 8 + worker 8 = 24, mais o `migrate` esporádico. Cabe nos 50 do item 5 com
mais de 100 % de folga.

**Risco.** Baixo. Pool pequeno demais enfileira queries em vez de falhar.
**Dependencia.** Nenhuma; a etapa de medicao na VPS foi exclu;da do escopo.
**Testar.** Suíte E2E, que exercita os três apps contra o banco.
**Medir.** `SELECT count(*) FROM pg_stat_activity GROUP BY application_name;`
**Reverter.** Remover o parâmetro da URL.

---

## 7. Medi��es da VPS � fora do escopo

Por decisao do responsavel, esta etapa foi ignorada. O deploy nao coleta nproc, steal time, I/O, docker stats ou amostras de capacidade na VPS. Os limites configurados sao tetos operacionais estimados, nao consumo medido.

---

## 8. 🟡 `realtime` com dependências só de produção

**Problema.** A imagem copia `/app/node_modules` inteiro, com devDependencies
(**MEDIDO: 174 MB**). Em runtime executa apenas `socket.io`, `ioredis` e `pino`.

**Solução.** `pnpm deploy --prod` no estágio `builder`, e o `runner` copia só o resultado.

**Impacto.** **MEDIDO: 174 MB → 16 MB (−158 MB, −91 %)** na árvore de dependências.

**Verificação §1.6 — já feita.** `pino-pretty` é a única devDependency que o código toca, e só sob
`NODE_ENV === 'development'` (**MEDIDO** — `apps/realtime/src/logger.ts:16`). Em produção nunca é
carregada. Podar é seguro.

**Risco.** Baixo. Se faltar algo, o container não sobe — falha visível, não silenciosa.
**Testar.** Build local da imagem; container sobe e o healthcheck passa.
**Medir.** `docker image ls`. **Reverter.** Voltar o `COPY` anterior.

---

## 9. 🟡 `worker` com dependências só de produção

Mesmo problema e mesma solução. **MEDIDO: 452 MB → 334 MB (−118 MB, −26 %)**.

A economia é menor porque o worker realmente precisa de `sharp` (processa imagem), do cliente
Prisma e do SDK da S3 — todos **Necessário**, não desperdício.

**Verificação §1.6.** O worker executa `node dist/main.js`, já compilado: não invoca `tsx` nem
`typescript` em runtime (**MEDIDO** — `apps/worker/Dockerfile:46`).

---

## 10. 🟡 Ignorar `packages/database/generated` no contexto de build

**Problema.** **MEDIDO: 42,8 MB dos 50,7 MB do contexto (84 %)** são o cliente Prisma gerado
localmente. O Dockerfile roda `prisma generate` de qualquer forma, então esse conteúdo é descartado.

Pior: gerado em máquina glibc, ele traz `libquery_engine-debian-openssl-3.0.x.so.node`
(**MEDIDO: 16,7 MB**), inútil numa imagem Alpine. Como `prisma generate` escreve no mesmo diretório
sem remover arquivos estranhos, **ESTIMADO** que o engine errado sobreviva dentro da imagem.

**Solução.** Acrescentar ao `.dockerignore`.
**Impacto.** **MEDIDO: contexto 50,7 → 7,9 MB (−84 %)**. Mais 16,7 MB **ESTIMADOS** por imagem.
**Risco.** Mínimo — o Dockerfile regenera. Se não regenerasse, o build falharia na hora.
**Testar.** Build local; conferir que o cliente existe na imagem.
**Reverter.** Remover a linha.

---

## 11. 🔵 Fixar a versão do MinIO

**Problema.** `minio/minio:latest` e `minio/mc:latest` (**MEDIDO**) — tags móveis. A regra da
Parte 7 pede identificador imutável; com `latest`, um `docker pull` troca a versão em silêncio e
não há rollback.
**Solução.** Fixar em versão datada. **Risco.** Mínimo. **Reverter.** Voltar a tag.

---

## 12. 🔵 Remover o estágio `migrator` morto do Dockerfile do admin

**Problema.** `apps/admin/Dockerfile` define `FROM builder AS migrator` que nada referencia — o
serviço `migrate` usa `apps/web/Dockerfile` (**MEDIDO**).
**Impacto.** Nenhum em recursos: o Docker só constrói o alvo pedido. É higiene — configuração morta
que confunde quem for mexer depois.
**Risco.** Mínimo. Verificado que nenhum compose ou workflow aponta para ele.

---

## 13. 🔵 Healthcheck do worker

**Problema.** Único serviço de longa duração sem healthcheck (**MEDIDO**). Se as filas travarem, o
Docker não percebe.
**Solução.** Healthcheck que confere se o processo responde e as filas estão conectadas.
**Risco.** Baixo — mas healthcheck mal feito reinicia container saudável. Por isso fica por último
e com `start_period` generoso.

---

# NÃO FAZER

Considerado e **recusado**. Esta seção vale tanto quanto a lista acima: evita que a próxima
passagem refaça a análise e cometa o erro.

### ❌ Juntar `realtime` e `worker` nos apps Next

Reduziria de 9 para 7 containers e **pioraria a aplicação**. O `realtime` existe porque o Next em
modo standalone não expõe o servidor HTTP para anexar WebSocket. O `worker` existe porque job
pesado no mesmo processo que atende requisição rouba CPU de quem espera a página carregar. Ambos
têm ciclo de vida próprio. _Número de containers não é métrica de qualidade._

### ❌ Podar devDependencies da imagem `migrate`

**É a armadilha nomeada na §1.6, e aqui ela se aplica de verdade.** A imagem roda
`prisma migrate deploy` e `pnpm seed:essencial`; `prisma` e `tsx` são **devDependencies**
(**MEDIDO** — `packages/database/package.json`). Podar quebraria migration e seed — ou seja, o
deploy inteiro. Os itens 8 e 9 podam **apenas** `realtime` e `worker`, onde foi verificado que
nenhuma devDependency é usada em runtime.

### ❌ Remover `"native"` de `binaryTargets` no Prisma

Parece economia (16,7 MB de engine), mas quebraria o desenvolvimento local e o CI, que rodam em
glibc. O item 10 resolve o mesmo problema pelo caminho certo: impedir que o artefato de uma
máquina entre no contexto da outra.

### ❌ Trocar a imagem base por uma menor (distroless, scratch)

`sharp` depende de libvips e de bibliotecas de sistema; o Prisma depende de OpenSSL. A §1.6 avisa
exatamente sobre isso. `node:22-alpine` já é enxuta e é o que os engines musl esperam.

### ❌ Remover o MinIO e usar o disco direto

Funcionaria hoje e quebraria na primeira segunda cidade. O `StorageProvider` é uma interface
justamente para trocar por S3 real sem tocar em código de aplicação. Trocar por disco é migração
de produto, não otimização — exigiria decisão explícita.

### ❌ Política de retenção de dados do banco

🔴 Fora de escopo por decisão. Apagar ou arquivar dado de produção é proposta separada, com impacto
explicado e autorização explícita. **Nada neste plano apaga dado.**

### ❌ Reduzir a frequência dos jobs agendados

Cobrança diária às 9h e expiração de impulsionamento de hora em hora (**MEDIDO**). Ambos já são
sadios. Espaçar a expiração faria impulsionamento pago continuar no ar depois de vencido — é
mudança de produto disfarçada de otimização.

### ❌ Desativar o Turborepo ou o cache de build

O cache é o que faz `lint` e `typecheck` responderem em 88 ms em vez de minutos (**MEDIDO**). Ele
vive no runner e no ambiente de desenvolvimento, **não na VPS**. Não custa nada ao servidor.

### ❌ Tentar consertar o load 243 pelo código

**MEDIDO:** o load já estava em 247 na média de 15 minutos antes de o deploy encostar na máquina.
Não é esta aplicação. O as medi��es na VPS foram exclu�das para descobrir se é o provedor. Otimizar mais o
código não muda esse número, e dizer o contrário seria atribuir à aplicação um problema de
hospedagem — o que a §2.6 pede explicitamente para não fazer.

---

# Execução — o que mudou em relação ao plano (§1.3)

## Itens 8 e 9 foram resolvidos de outra forma

O plano dizia: "`pnpm deploy --prod` no builder, e o runner copia só o resultado". **Não bastava.**

Ao executar os binários — coisa que a auditoria, por só ler configuração, não fez — descobriu-se
que `realtime` e `worker` **não iniciavam**. Podar dependências de um processo que não sobe não
tem efeito nenhum.

A correção foi **empacotar o código do workspace no build** (`scripts/empacotar-servico.mjs`, com
esbuild), o que resolve as duas coisas ao mesmo tempo: elimina a resolução de TypeScript cru em
runtime (a causa da quebra) e tira `packages/` inteiro da imagem (o objetivo de recurso).

A poda com `pnpm deploy --prod` continua no plano e foi aplicada — só não era suficiente sozinha.

## Item novo, não previsto: três defeitos de inicialização

Ver §11 da auditoria. Um deles fui eu que introduzi em `1e6ce89`; os outros dois são anteriores.
Todos corrigidos e **verificados executando os processos**, não por leitura.

## Regra de empacotamento: o que fica de fora, e por quê

| Externo                                | Motivo                                  |
| -------------------------------------- | --------------------------------------- |
| `sharp`                                | Binário nativo por plataforma           |
| `bullmq`                               | Carrega scripts Lua do disco em runtime |
| `ioredis`                              | Compartilhada com o bullmq              |
| `@prisma/client`                       | Resolve os engines por caminho          |
| `@sentry/node`                         | Entra por import dinâmico, é opcional   |
| `@rapidinho/database/generated/client` | Localiza engines com `__dirname`        |

Tudo o mais é empacotado. Quem acrescentar a esta lista: justifique **por que não pode** ser
empacotado.

## Resultado medido

| Métrica                        | Antes                | Depois            | Método                             |
| ------------------------------ | -------------------- | ----------------- | ---------------------------------- |
| Contexto de build              | 50,7 MB              | **5,5 MB** (−89%) | Mesma varredura do `.dockerignore` |
| `realtime` (dist + deps)       | 174 MB + `packages/` | **17 MB** (−90%)  | `pnpm deploy --prod` + `du -sm`    |
| `worker` (dist + deps)         | 452 MB + `packages/` | **337 MB** (−25%) | idem                               |
| Containers com limite de CPU   | 0 de 9               | **9 de 9**        | `docker-compose.yml`               |
| Containers com `pids_limit`    | 0 de 9               | **9 de 9**        | idem                               |
| Containers com política de log | 0 de 9               | **9 de 9**        | idem                               |
| Serviços que iniciam           | **7 de 9**           | **9 de 9**        | Execução real dos binários         |

⚠️ **Não medido:** tamanho final das imagens Docker. Não há daemon Docker nesta sessão. Os números
acima são das árvores que **entram** na imagem, medidos com `du`, não da imagem construída.

## Pendências registradas

1. **57 MB de CLI do `prisma` e `typescript`** na árvore de produção do worker, por peers opcionais
   do `@prisma/client`. Exige mexer em resolução de peer do pnpm; não feito.
2. **Limites de CPU permanecem estimados.** A coleta de m�tricas na VPS foi exclu�da do escopo a pedido.
