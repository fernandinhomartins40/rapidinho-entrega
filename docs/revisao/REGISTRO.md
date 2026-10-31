# Registro de achados — rodada 3

Um achado por linha na tabela-resumo e uma seção de detalhe por achado.
Estados: **aberto** → **reproduzido** → **corrigido** → **verificado** (só o
agente `verificador` marca) · ou **descartado** (falso positivo, com motivo) ·
ou **pendente** (depende de decisão ou de ambiente, com motivo).

Os achados R3-001 a R3-010 vêm da leitura inicial e das varreduras de
2026-10-31 (`scripts/auditoria/`). Os marcados _a confirmar_ ainda não foram
reproduzidos em runtime: a Fase 2 confirma ou descarta.

## Resumo

| Id      | Sev. | Área         | Título                                                                                     | Estado    | Commit | Evidência |
| ------- | ---- | ------------ | ------------------------------------------------------------------------------------------ | --------- | ------ | --------- |
| R3-001  | S1   | LGPD         | Aceite de termos do cliente nunca é gravado; `ConsentRecord` sem uso                       | aberto    |        |           |
| R3-001b | S2   | LGPD         | Pedidos do titular (`DataRequest`) sem tela de atendimento; exportação não registra pedido | aberto    |        |           |
| R3-002  | S2   | Admin        | Super admin entra no "modo lojista" e não tem como sair                                    | aberto    |        |           |
| R3-003  | S2   | Entregador   | Localização do entregador pela metade                                                      | aberto    |        |           |
| R3-004  | S2   | Financeiro   | Repasses (`Payout`) exibidos e nunca gerados                                               | aberto    |        |           |
| R3-005  | S1   | Permissão    | Operador da loja vê o financeiro (a confirmar)                                             | aberto    |        |           |
| R3-006  | S2   | Cadastro     | Admin aprova documentos que ninguém consegue enviar                                        | aberto    |        |           |
| R3-007  | S1   | LGPD         | Loja registra aceite de termos em nome do entregador convidado                             | aberto    |        |           |
| R3-008  | S2   | LGPD         | Campanhas sem checagem de consentimento de marketing (a confirmar)                         | aberto    |        |           |
| R3-009  | S3   | Código morto | Fila `reports` declarada e nunca usada                                                     | aberto    |        |           |
| R3-010  | —    | Triagem      | Valores de enum nunca usados (lista abaixo)                                                | aberto    |        |           |
| R3-011  | S1   | Infra        | Imagem do MinIO fixada no compose não pode mais ser baixada                                | aberto    |        | fase0     |
| R3-012  | S2   | Dev          | Worker e realtime não sobem com `pnpm dev`                                                 | corrigido |        | fase0     |
| R3-013  | S1   | Infra        | Redis com `allkeys-lru` pode descartar jobs do BullMQ                                      | aberto    |        | fase0     |

## Detalhes

### R3-001 — Aceite de termos do cliente nunca é gravado

- **Onde:** `apps/web/src/app/entrar/actions.ts:35` afirma que "nome e termos
  vêm depois, no checkout", mas `apps/web/src/app/checkout/actions.ts` não
  grava `acceptedTermsAt`/`acceptedPrivacyAt`. Loja (`cadastro-loja/actions.ts:102`)
  e entregador (`entregador/actions.ts:57`) gravam; cliente não.
  O modelo `ConsentRecord` (histórico com versão e IP) não é gravado nem lido
  em lugar nenhum fora da exportação.
- **Por que importa:** LGPD art. 8º §2º — cabe ao controlador provar o
  consentimento/ciência. Sem registro não há prova de qual versão foi aceita.
- **Reproduzir:** login de cliente novo + pedido completo; consultar
  `User.acceptedTermsAt` e `ConsentRecord` daquele usuário → ambos vazios.
- **Correção esperada:** gravar aceite (data, versão, IP) no momento em que o
  cliente realmente vê o aviso, de preferência em `ConsentRecord`, e preencher
  os campos de `User` para compatibilidade. Definir onde fica a versão vigente
  dos termos (constante em `packages/shared`?).

### R3-001b — Pedidos do titular sem atendimento

- **Onde:** `excluirMinhaConta` cria `DataRequest`; nenhuma tela ou job lê
  `DataRequest`. `exportarMeusDados` não cria `DataRequest` (o valor
  `DataRequestType.EXPORT` nunca é usado).
- **Correção esperada:** registrar também a exportação; tela em `/admin` para
  listar e concluir pedidos (ou ao menos registro auditável). Decidir com o
  controlador se a exclusão é imediata (como hoje) e o `DataRequest` é só
  prova.

### R3-002 — Não há como sair do "modo lojista"

- **Onde:** `apps/admin/src/app/admin/lojas/actions.ts` exporta
  `sairDoModoLojista`, mas nenhuma tela a chama. `entrarComoLojista` é usada em
  `admin/lojas/[id]/acoes-da-loja.tsx:224`. O `CurrentUser.impersonatedBy`
  existe, mas nenhuma tela do `/loja` mostra que a sessão é de impersonation.
- **Efeito:** o super admin fica operando como lojista até o cookie expirar
  (1 h) ou apagar cookies; o `ImpersonationLog` nunca recebe `endedAt`.
- **Reproduzir:** super admin → `/admin/lojas/[id]` → "Entrar como lojista" →
  procurar como voltar.
- **Correção esperada:** faixa fixa no `loja-shell` quando `impersonatedBy`
  estiver presente ("Você está vendo como {loja} — Sair"), chamando
  `sairDoModoLojista`.

### R3-003 — Localização do entregador pela metade

- **Onde:** `apps/admin/src/app/entregador/actions.ts` `atualizarLocalizacao`
  publica `REALTIME_EVENTS.courierLocation`; nenhuma tela chama a ação e
  nenhuma tela escuta o evento.
- **Decisão pendente:** completar (envio periódico pelo navegador do
  entregador durante a corrida + mapa/ETA para o cliente e loja) ou remover.
  Se completar, ver LGPD M5 (só durante corrida, sem histórico).

### R3-004 — Repasses exibidos e nunca gerados

- **Onde:** `apps/admin/src/app/loja/financeiro/page.tsx:66` e
  `admin/financeiro/page.tsx` leem `prisma.payout`; nada grava `Payout`.
- **Efeito:** a área de repasses fica sempre vazia; a loja não sabe quanto vai
  receber. Verificar também `SettlementMode.PLATFORM_COLLECTS` (nunca usado).
- **Decisão pendente:** como funciona o repasse hoje (a loja recebe direto?).
  Se a loja recebe direto, a tela não deveria prometer repasse.

### R3-005 — Operador da loja vê o financeiro (a confirmar)

- **Onde:** `packages/auth/src/guards.ts` documenta financeiro como ação de
  dono; `apps/admin/src/app/loja/financeiro/page.tsx` usa `getStoreContext()`
  sem checar `staffRole`; o layout de `/loja` libera qualquer membro.
- **Reproduzir:** criar operador da loja 1 no seed:e2e, entrar, abrir
  `/loja/financeiro`.

### R3-006 — Documentos de cadastro sem envio

- **Onde:** `admin/entregadores/page.tsx:60` e `admin/lojas/[id]/page.tsx:49`
  exibem `documents`; `admin/entregadores/actions.ts:50` aprova
  `courierDocument`. Nenhum código cria `StoreDocument` ou `CourierDocument`;
  `MediaContext.STORE_DOCUMENT`/`COURIER_DOCUMENT` nunca são usados.
- **Efeito:** a plataforma aprova loja e entregador sem documento, embora a
  tela de aprovação sugira o contrário.
- **Decisão pendente:** exigir documentos (upload privado no cadastro) ou
  tirar a seção da tela de aprovação.

### R3-007 — Aceite gravado por terceiro

- **Onde:** `apps/admin/src/app/loja/entregadores/actions.ts:65-66`: ao convidar
  um entregador, a loja cria o usuário com `acceptedTermsAt` e
  `acceptedPrivacyAt` = agora.
- **Por que importa:** o aceite precisa ser do titular (LGPD art. 8º). Correção
  esperada: deixar nulo e pedir o aceite no primeiro acesso do entregador.

### R3-008 — Campanha sem consentimento de marketing (a confirmar)

- **Onde:** `apps/admin/src/app/admin/notificacoes/actions.ts` e o worker de
  campanhas. Conferir por qual canal saem (push, WhatsApp) e se há filtro de
  opt-in/opt-out. Push depende de permissão do navegador; WhatsApp promocional
  sem opt-in é problema também perante a Meta.

### R3-009 — Fila `reports` sem uso

`QUEUES.reports` em `packages/shared/src/constants/index.ts:102`, sem produtor
nem worker. Remover ou registrar como funcionalidade futura.

### R3-010 — Valores de enum nunca usados (triagem)

Cada um pode ser regra de negócio que ficou pela metade. Veredito por item:

| Valor                                            | Hipótese                                              | Veredito |
| ------------------------------------------------ | ----------------------------------------------------- | -------- |
| `PaymentStatus.ON_DELIVERY`                      | pagamento na entrega nunca marcado com status próprio |          |
| `SettlementMode.PLATFORM_COLLECTS`               | ligado a R3-004                                       |          |
| `SubscriptionStatus.PAST_DUE`                    | cobrança de plano nunca marca inadimplência?          |          |
| `NotificationChannel.SMS`                        | canal previsto, não implementado                      |          |
| `NotificationStatus.QUEUED`/`READ`               | log de notificação sem ciclo completo                 |          |
| `MediaContext.CATEGORY_ICON`/`PIZZA_FLAVOR`      | upload de ícone de categoria/foto de sabor sem tela   |          |
| `MediaContext.STORE_DOCUMENT`/`COURIER_DOCUMENT` | R3-006                                                |          |
| `DataRequestType.EXPORT`                         | R3-001b                                               |          |

### R3-011 — Imagem do MinIO não baixa mais

- **Onde:** `docker-compose.yml` (`minio` e `minio-init`, `quay.io/minio/*:RELEASE.2025-*`).
- **Observado (2026-10-31):** `docker compose up minio` → `401 UNAUTHORIZED`
  no quay.io; `minio/minio` no Docker Hub → "repository does not exist". O
  MinIO deixou de publicar imagens da edição comunitária.
- **Efeito:** a VPS atual funciona enquanto a imagem estiver em cache; um
  servidor novo, um `docker system prune` ou uma restauração de desastre não
  sobe o storage — uploads, fotos de produto e receitas param.
- **Contorno usado na revisão:** SeaweedFS (`chrislusf/seaweedfs`, API S3) na
  porta 9000, com o bucket criado por script.
- **Decisão pendente:** trocar o storage (SeaweedFS, Garage, RustFS, ou S3
  gerenciado) ou manter a imagem num registry próprio. Afeta produção; precisa
  de aval antes de mexer no compose.

### R3-012 — Worker e realtime não sobem em desenvolvimento

- **Observado:** `pnpm dev` sobe web e admin, mas:
  - realtime: `Variável de ambiente ausente: REDIS_URL` — os apps Next carregam
    o `.env` da raiz, o realtime e o worker não;
  - worker: `SyntaxError: '@rapidinho/services' does not provide an export
named 'capturarErro'` — o worker é ESM (`"type": "module"`) e importa
    `@rapidinho/services` e `@rapidinho/database`, que eram tratados como
    CommonJS pelo `tsx`; o Node não enxerga os nomes reexportados com
    `export *`. Em produção não aparece porque o esbuild empacota tudo.
- **Efeito:** em dev nenhum job roda (expiração de pedido, lembrete, imagens,
  campanhas, cobranças) e não há tempo real — metade dos fluxos não pode ser
  validada localmente.
- **Correção:** `"type": "module"` em `packages/services` e
  `packages/database`; seeds trocam `__dirname` por `import.meta.dirname`;
  scripts `dev` do worker e do realtime passam `--env-file-if-exists=../../.env`.
- **Validação:** os quatro processos sobem (`/api/health` 200 nos dois apps,
  handshake do Socket.io 200, worker "ouvindo filas"); `pnpm typecheck` e
  `pnpm test` verdes; `pnpm db:seed` e `db:seed:e2e` rodam; build do worker e
  do realtime ok. Falta: `pnpm build` completo dos apps Next (verificador).

### R3-013 — Redis pode descartar jobs

- **Onde:** `docker-compose.yml:238`: `--maxmemory 256mb --maxmemory-policy allkeys-lru`.
- **Observado:** o BullMQ avisa no log do worker, a cada conexão:
  `IMPORTANT! Eviction policy is allkeys-lru. It should be "noeviction"`.
- **Efeito:** quando o Redis encher, ele apaga chaves quaisquer — inclusive
  jobs agendados de expiração de pedido e cobrança, e o estado das filas.
  Falha silenciosa: o pedido não expira, a cobrança não sai.
- **Correção esperada:** `noeviction` (o rate limit e o cache precisam de TTL
  próprio, que já usam?) ou separar o Redis das filas do Redis de cache.
  Mexe em produção: confirmar antes.

## Fila da varredura (Fase 1)

Saída integral de `node scripts/auditoria/mapa-de-acoes.mjs --suspeitas` e
`node scripts/auditoria/fantasmas.mjs` a ser triada item a item. Cole aqui o
veredito de cada linha (bug / pela metade / morto / falso positivo + motivo).

## Decisões pendentes (para o responsável pelo produto)

1. R3-003: completar ou remover a localização do entregador?
2. R3-004: como o dinheiro chega à loja hoje? A tela de repasses deve existir?
3. R3-006: documentos são obrigatórios para aprovar loja/entregador?
4. Matriz: o que Gerente e Operador podem fazer (cardápio, horários, entrega, cupons, financeiro)?
5. Exclusão de conta de dono de loja ou entregador com corrida ativa: bloquear, transferir ou encerrar?
6. Versão vigente dos termos e da política: quem define e onde fica?
