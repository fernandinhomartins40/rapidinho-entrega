# Padrão para rodar muitas aplicações Docker na mesma VPS

> Derivado da auditoria do Rapidinho Entrega (2026-09-15), não de teoria genérica. Cada regra
> aponta o problema real que a originou e o seu **status de validação**.
>
> A pergunta que orienta tudo: *esta solução continua funcionando com 10, 20 ou 30 aplicações no
> mesmo host?* O que funciona isolado e quebra em escala não serve.

## As cinco regras que mais importam

### 1. Todo container tem teto de memória, CPU e PIDs — sem exceção

Sem limite não é "padrão permissivo", é **proteção ausente**: um vazamento em qualquer aplicação
derruba as outras. No Rapidinho, **0 de 9 containers** tinham limite de CPU ou PID.

```yaml
mem_limit: 512m
cpus: ${MINHA_APP_CPUS:-0.5}   # sobrescrevível: calibrar não deve exigir deploy
pids_limit: 256
```

`cpus` é **teto, não reserva** — container ocioso não segura nada. A soma dos tetos pode passar do
número de vCPU sem problema.

*Status: aplicado, ainda não validado sob carga real.*

### 2. Todo container tem política de log

O driver `json-file` padrão do Docker **não rotaciona**. Num host compartilhado com o disco a 84%,
um erro em laço enche o disco e derruba **todas** as aplicações.

```yaml
x-log: &log
  driver: json-file
  options: { max-size: '10m', max-file: '3' }
```

*Status: aplicado. Teto de 30 MB por container — antes o teto era o disco inteiro.*

### 3. Limite de banco sem ajuste interno é pior que limite nenhum

`mem_limit: 1g` no Postgres **sem** ajustar `shared_buffers` e `max_connections` faz o processo ser
morto por falta de memória exatamente sob carga. O banco acredita que tem a máquina inteira.

Dimensione os dois lados juntos: `shared_buffers` em 25% do teto, `max_connections` conversando com
o pool de cada aplicação (`connection_limit` na URL do Prisma).

*Status: aplicado. Pior caso calculado em ~520 MB dentro de 1 GB — **não medido sob carga**.*

### 4. Build fora da máquina de produção, imagem versionada por hash

Compilar em produção disputa CPU com os usuários. No Rapidinho isso custou **três deploys** antes
de virar regra: a VPS não completava o build.

- Build no runner de CI, imagem enviada pronta
- Tag = hash do commit, **nunca `latest`** — é o que torna rollback uma troca de variável
- Nome de imagem **fixo**: sem ele o compose nomeia pelo diretório do projeto, que muda a cada
  release, e a imagem enviada não é a que ele procura

*Status: aplicado e validado — build de 6 min 38 s no runner contra "nunca terminou" na VPS.*

### 5. Limpeza sempre com escopo restrito

Em host compartilhado, `docker system prune -a` apaga imagem de **outras aplicações**. Filtre por
idade, remova só o que não tem referência, e entenda o que cada comando apaga antes de rodar.

*Status: já era assim; confirmado correto na auditoria.*

---

## Imagem: o que entra e o que não entra

### Empacote o código do workspace; deixe externo só o que quebra empacotado

Num monorepo com pacotes em TypeScript, **o Node não carrega pacote do workspace como fonte**: se
o pacote é ESM, o carregador exige extensão em import relativo, e `./x.js` **não** mapeia para
`x.ts`. Foi o que manteve dois serviços sem iniciar sem ninguém perceber.

Empacotar no build resolve os dois lados: o serviço passa a subir, e `packages/` sai da imagem.

Deixe externo apenas o que tem motivo:

| Motivo | Exemplos |
|---|---|
| Binário nativo | `sharp` |
| Lê arquivo do disco em runtime | `bullmq` (scripts Lua) |
| Resolve caminho com `__dirname` | cliente gerado do Prisma |
| Entra por import dinâmico | `@sentry/node` |

Se precisar manter algo externo, exponha-o como **subcaminho do pacote** em vez de copiá-lo para
o lado — copiar duplica (aconteceu: 43 MB).

### O contexto de build não é a sua árvore de trabalho

**84% do contexto** do Rapidinho era o cliente Prisma gerado localmente — descartado logo em
seguida, porque o Dockerfile regenera. Artefato de máquina de desenvolvimento não entra em imagem.

No `.dockerignore`, no mínimo: `node_modules`, saídas de build, `.git`, `.env`, **artefatos
gerados** e **caches incrementais**.

> ⚠️ `*.tsbuildinfo` é traiçoeiro: com ele no contexto, o `tsc` acredita que já emitiu e **não gera
> `dist/`**. O CI não pega, porque faz checkout limpo.

### Poda de devDependencies tem exceção

`pnpm deploy --prod` é o padrão — **menos onde o deploy invoca ferramenta de desenvolvimento dentro
do container**. No Rapidinho a imagem de migration roda `prisma` e `tsx`, ambos devDependencies:
podar quebraria migration e seed, ou seja, o deploy inteiro.

Antes de podar, pergunte: *o que este container executa além do processo principal?*

---

## Container separado: quando sim, quando não

Pergunte: **isto tem ciclo de vida próprio?**

| Sim, separe | Não, não separe |
|---|---|
| Precisa de servidor HTTP que o framework não expõe (WebSocket) | "Fica mais bonito no diagrama" |
| Trabalho pesado que roubaria CPU de quem espera a tela | Reduzir contagem de containers |
| Escala em ritmo diferente do resto | Separar camadas do mesmo processo |

*Número de containers não é métrica de qualidade.* No Rapidinho, juntar `realtime` e `worker` nos
apps Next reduziria de 9 para 7 e **pioraria** a aplicação.

---

## Observabilidade barata

### Meça o host antes de culpar a aplicação

⚠️ **Steal time primeiro.** Se o provedor não entrega a CPU contratada, o load alto não vem do seu
código e **nenhuma otimização resolve**. O Rapidinho mediu **load average 243** na VPS — estável na
média de 15 minutos, portanto anterior ao deploy.

Registre a cada deploy, antes de qualquer conclusão:

```bash
nproc; uptime; free -m; df -h
vmstat 1 3                  # coluna `st` = CPU que o provedor não entregou
docker stats --no-stream    # consumo real por container
```

Sem esses números, "está lento" vira chute. Com eles, a conversa é com o provedor ou com o código —
e dá para saber qual.

### Processo sem HTTP também precisa de healthcheck

Worker sem healthcheck é cego: laço de eventos travado mantém o PID vivo e as filas paradas. Foi o
que escondeu que o worker **nunca subia**.

Padrão barato: o processo renova uma chave no Redis com TTL; o healthcheck confere a chave. Use
`start_period` generoso — reiniciar container saudável é pior que demorar a perceber um travado.

### Configuração não basta; execute o binário

A auditoria por leitura deu "sem desperdício estrutural" e estava certa — e **dois serviços não
iniciavam**. Rode o processo. Faça uma conexão de verdade. Consulte o banco de verdade.

---

## Checklists

### Aplicação nova

- [ ] `mem_limit`, `cpus` e `pids_limit` em **todos** os containers
- [ ] `logging` com `max-size` e `max-file` em todos
- [ ] Banco com configuração interna ajustada ao teto de memória
- [ ] Pool da aplicação conversando com `max_connections` do banco
- [ ] Build fora de produção, imagem por hash do commit, nome de imagem fixo
- [ ] `.dockerignore` cobrindo gerados e caches incrementais
- [ ] Imagem final sem devDependency — salvo exceção justificada por escrito
- [ ] Healthcheck em todo processo de longa duração, inclusive sem HTTP
- [ ] **Cada serviço iniciado de verdade** e exercitado no caminho crítico
- [ ] Deploy idempotente, com rollback testado
- [ ] Limpeza com escopo restrito, nunca global

### Revisão periódica

- [ ] `docker system df` e **volumes órfãos** (o maior desperdício silencioso)
- [ ] Tamanho dos logs em `/var/lib/docker/containers/`
- [ ] Releases antigas podadas
- [ ] `docker stats` sob uso real × os limites configurados
- [ ] Steal time — mudou?
- [ ] Alguma imagem ainda em tag móvel?

### Remover um serviço

Remoção pela metade deixa a aplicação **pior**: o custo da configuração morta sem nenhum benefício.

- [ ] Definição na orquestração
- [ ] Volumes e redes associados
- [ ] Variáveis de ambiente
- [ ] **Geradores de configuração** — se algo reescreve o `.env` a cada deploy, a configuração morta
      ressuscita sozinha
- [ ] `depends_on` de outros serviços
- [ ] Passos de build e de deploy
- [ ] **Rotas e proxies que apontam para ele**
- [ ] **Clientes que chamam essas rotas**, e **telas que usam esses clientes**
- [ ] Volumes e containers órfãos no host

> **Se a funcionalidade continua existindo no produto, não é remoção — é migração**, e precisa de
> destino definido antes de desligar o antigo.

---

## Não faça

| Não faça | Por quê |
|---|---|
| Juntar serviços para reduzir a contagem | Cada um tem ciclo de vida próprio; junta e piora |
| Podar devDeps sem verificar o que o container executa | Quebra migration e seed |
| Limitar memória do banco sem ajustar a configuração dele | Morte por falta de memória **sob carga** |
| Trocar a imagem base por uma menor sem conferir dependência de sistema | `sharp` precisa de libvips; Prisma, de OpenSSL |
| `docker system prune -a` em host compartilhado | Apaga imagem de outras aplicações |
| Tag `latest` | Muda em silêncio, impossibilita rollback |
| Concluir "não tem uso" sem provar onde procurou | Já removeu funcionalidade ativa em produção |
| Atribuir load alto à aplicação sem medir steal time | Pode ser hospedagem; otimizar não resolve |
| Auditar só configuração | Dois serviços quebrados passaram por essa peneira |
