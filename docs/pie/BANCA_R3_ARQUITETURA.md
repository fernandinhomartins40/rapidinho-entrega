# Banca R3 — Arquitetura, engenharia e dados

Revisor: R3 (arquiteto sênior). Data: 2026-11-01. Commit auditado: `d65c0e5` (main).
Revisão independente: não li nenhum outro `BANCA_*`.

> **Nota sobre IDs.** Os IDs `R3-NNN` deste parecer são novos. Quando cito a rodada
> anterior (`docs/revisao/REGISTRO.md`), escrevo **"antigo R3-00X"** para não confundir.

Estados usados:
- **CONFIRMADO**: o caminho do código está provado pela leitura, por uma consulta ao banco ou por uma chamada HTTP local.
- **FORTE INDÍCIO**: o defeito é estrutural (corrida, por exemplo), mas não executei a reprodução.
- **HIPÓTESE**: depende do ambiente de produção, que não pude ver.
- **NÃO REPRODUZIDO**: procurei o problema e não o encontrei.

Scripts e saídas brutas ficam em
`C:\Users\fusea\AppData\Local\Temp\claude\c--FuseDev-rapidinho-entrega\f9c02d86-2f36-47ac-a919-6a836a7d0812\scratchpad\r3\`
(`guards.mjs`, `guards_admin.txt`, `guards_web.txt`, `enums.mjs`, `enums.txt`, `diff_db_schema.sql`).

---

## Sumário dos achados

| ID | Sev. | Estado | Onde | Resumo |
|---|---|---|---|---|
| R3-001 | Crítica | CONFIRMADO | `apps/web/src/app/checkout/actions.ts:450-452`, `apps/admin/src/lib/store-context.ts:33` | O pedido pago por Pix na chave da loja fica invisível para a loja, sem confirmação manual e sem expiração |
| R3-002 | Alta | CONFIRMADO | `apps/admin/src/app/loja/pedidos/actions.ts:311-332`, `packages/database/src/cancelamento.ts:19-62` | O cancelamento de pedido pago online não estorna nem registra o valor devido |
| R3-003 | Alta | CONFIRMADO | `apps/web/src/app/api/webhooks/pagamento/route.ts:63-103` | O webhook grava a deduplicação antes de processar: uma falha depois disso perde a confirmação de pagamento para sempre |
| R3-004 | Alta | FORTE INDÍCIO | `apps/worker/src/jobs/order-timeout.ts:30-42`, `route.ts:93` | Corrida entre a expiração do Pix e o webhook, sem nenhuma reconciliação com o gateway |
| R3-005 | Alta | FORTE INDÍCIO | `loja/pedidos/actions.ts:145-168`, `entregador/actions.ts:94-146` | Mudanças de status sem concorrência otimista: um pedido cancelado pode virar entregue |
| R3-006 | Alta | CONFIRMADO | `apps/worker/src/jobs/plan-billing.ts:22,57-67`, `loja/impulsionar/actions.ts:44-60` | A comissão do plano grátis (12%) nunca é faturada; a janela de faturamento e a troca de plano também perdem receita |
| R3-007 | Alta | CONFIRMADO | `loja/impulsionar/actions.ts:108-118`, `admin/financeiro/page.tsx:63-66` | O impulsionamento é ativado sem cobrança, o financeiro mostra receita fictícia e as faturas nunca são quitadas |
| R3-008 | Alta | CONFIRMADO | `checkout/actions.ts:73-85,183-192`, `packages/shared/src/schemas/order.ts:88` | O cartão online pode ser ligado pela loja e escolhido pelo cliente, mas sempre falha |
| R3-009 | Alta | CONFIRMADO | `apps/web/src/app/cadastro-loja/actions.ts:107-139,201-207` | Um cliente que cadastra loja vira lojista sem e-mail nem senha e não consegue entrar no painel (regressão de 6cb5ecb) |
| R3-010 | Alta | CONFIRMADO | `admin/financeiro/page.tsx:57`, `loja/financeiro/page.tsx:66` | Repasses (`Payout`) nunca são gerados, embora a plataforma receba pelo gateway (antigo R3-004) |
| R3-011 | Média | FORTE INDÍCIO | `checkout/actions.ts:388-400`, `apps/web/src/lib/checkout.ts:148-153`, `schema.prisma:1671` | Os limites de cupom são checados fora da transação; a unicidade do código não vale para cupom global |
| R3-012 | Média | CONFIRMADO | `apps/admin/src/app/entregador/actions.ts:51-63` | A ação de aceitar corrida não filtra cidade nem loja (a lista filtra) |
| R3-013 | Média | CONFIRMADO / HIPÓTESE | `checkout/actions.ts:556-558`, `pedidos/[id]/acompanhamento.tsx:228` | Uma falha ao gerar o Pix é engolida e não existe o "tentar de novo" prometido; em produção com `PAYMENT_PROVIDER=fake`, nenhuma loja sem chave Pix gera QR |
| R3-014 | Média | CONFIRMADO / HIPÓTESE | `packages/shared/src/env.ts:35,41`, `packages/services/src/providers.ts:55-70,99-117` | O contrato de env aceita provedores sem implementação e permite WhatsApp falso em produção |
| R3-015 | Média | CONFIRMADO | `packages/services/src/notifications/index.ts:37-52,123-134` | Notificações síncronas dentro das actions, retentativas inúteis e falhas de rede sem registro |
| R3-016 | Média | CONFIRMADO | `docker-compose.yml:238`, `checkout/actions.ts:484-493` | Redis com `allkeys-lru` e nenhuma varredura de jobs órfãos (reconfirma o antigo R3-013) |
| R3-017 | Média | CONFIRMADO | `apps/web/src/app/conta/dados/actions.ts:128` | A exclusão de conta não apaga o `addressSnapshot` dos pedidos (`undefined` não faz nada no Prisma) |
| R3-018 | Média | CONFIRMADO | `apps/web/src/app/entrar/actions.ts:68-118`, `api/auth/otp/*` | Os fluxos de login estão duplicados e já divergem: falta limite por IP e há API morta com superfície ativa |
| R3-019 | Média | CONFIRMADO | (ausência) `storeStaff.create`; dados locais | Não existe fluxo para criar funcionário da loja; contas antigas sem senha ficam trancadas fora do painel |
| R3-020 | Média | FORTE INDÍCIO | `apps/admin/src/app/loja/pedidos/separacao.ts:212-214,268-325`, `mercadopago.ts:163-167` | A separação permite estorno parcial duplicado, e o estorno vai sem chave de idempotência |
| R3-021 | Média | CONFIRMADO | `packages/services/src/payments/mercadopago.ts:57-65`, `messaging/push.ts:25` | Chamadas ao Mercado Pago e ao web-push sem timeout: o checkout pode travar |
| R3-022 | Média | CONFIRMADO | `admin/entregadores/actions.ts:50`, `admin/entregadores/page.tsx:60` | Documentos de entregador e de loja são aprovados, mas ninguém consegue enviá-los (antigo R3-006) |
| R3-023 | Baixa | CONFIRMADO | `entregador/actions.ts:205-224` | A localização do entregador está pela metade: ninguém chama a ação nem escuta o evento (antigo R3-003) |
| R3-024 | Baixa | CONFIRMADO | `apps/admin/src/app/entregador/painel.tsx:133`, `loja/pedidos/actions.ts:474-494` | "Novas corridas aparecem sozinhas" não é verdade: nenhum evento é publicado, e o que salva é um polling acidental |
| R3-025 | Baixa | CONFIRMADO | `packages/shared/src/constants/index.ts:102,117-119`, `queues.ts:82`, `otp.ts:313` | Código morto: fila `reports`, worker de imagem sem produtor, limpeza de OTP nunca agendada, limites de taxa declarados e não usados |
| R3-026 | Baixa | CONFIRMADO | `schema.prisma` (enums) | Enums e colunas nunca usados (reconfirma o antigo R3-010, com acréscimos) |
| R3-027 | Baixa | FORTE INDÍCIO | `packages/auth/src/otp.ts:86-124` | `verifyOtp` checa e depois age: tentativas em paralelo passam de `OTP_MAX_ATTEMPTS` |
| R3-028 | Baixa | CONFIRMADO | `apps/web/next.config.mjs:22`, `apps/web/src/middleware.ts:26-40`, `packages/auth/src/session.ts:21-22` | Fragilidades da sessão: env embutido no build e lido em runtime, renovação de qualquer cookie, painel sem renovação |
| R3-029 | Baixa | CONFIRMADO | `checkout/actions.ts:45-64` | O número do pedido (DDMM + 4 dígitos) é único para sempre e o espaço é dividido entre os anos |

Contagem: 1 Crítica, 9 Altas, 12 Médias, 7 Baixas.

---

## Achados

### R3-001 — O pedido pago por Pix na chave da loja fica invisível e preso para sempre
- **Categoria:** funcionalidade fantasma / fluxo de pagamento.
- **Severidade:** Crítica. O cliente paga e a loja nunca recebe o pedido. Basta o lojista preencher a chave Pix em Configurações para isso acontecer.
- **Estado:** CONFIRMADO (leitura de código, sem execução em runtime).
- **Onde:**
  - `apps/web/src/app/checkout/actions.ts:260-261`: Pix entra como `PENDING_PAYMENT`.
  - `checkout/actions.ts:519-535`: com `STORE_COLLECTS` e chave, o BR Code sai como `provider: 'OFFLINE'`.
  - `checkout/actions.ts:450-452`: nesse caso `expiraSozinho = false`.
  - `apps/admin/src/lib/store-context.ts:33`: `STATUS_EM_ABERTO = ['RECEIVED','ACCEPTED','PREPARING','READY']`, sem `PENDING_PAYMENT`.
  - `apps/admin/src/app/loja/pedidos/page.tsx:29`.
- **Reprodução segura:**
  1. Em local, o lojista e2e informa uma chave Pix em `/loja/configuracoes`.
  2. Um cliente (UA ` RapidinhoApp/teste`) faz um pedido com Pix.
  3. O pedido não aparece em `/loja/pedidos`.
  4. `grep -rn "PENDING_PAYMENT" apps/admin/src/app/loja` → nenhuma ocorrência.
  5. `grep -rn "status: 'PAID'" apps/admin/src` → nenhuma ação marca o pagamento como pago.
- **Esperado × observado:** o comentário diz "Pix direto na chave da loja é confirmado à mão pelo lojista" (`checkout/actions.ts:447-449`). Na prática não existe tela nem ação de confirmação manual, o pedido não aparece para a loja e nenhum job o expira. O cupom e o estoque ficam presos junto.
- **Evidência:**
  - `grep` acima vazio.
  - `canTransition` permite `PENDING_PAYMENT → RECEIVED` (`packages/shared/src/domain/order-status.ts:19`), mas só o webhook do gateway (`route.ts:93-103`) faz essa transição.
  - Banco local: `settlementMode` = `STORE_COLLECTS` nas 12 lojas (valor padrão do schema, linha 594).
- **Impacto:** perda de venda com o dinheiro do cliente já na conta da loja; reclamação e estorno manual; estoque e cupom presos.
- **Correção proposta:**
  - Opção 1: mostrar `PENDING_PAYMENT` com Pix `OFFLINE` no painel da loja, numa coluna "Aguardando Pix", com a ação "Recebi o Pix". Ela marca `Payment.status=PAID` e leva o pedido a `RECEIVED`/`ACCEPTED` numa transação condicional.
  - Opção 2: agendar a expiração também nesse caso, com prazo maior.
- **Teste de aceite:** um pedido Pix com `pixKey` aparece na loja; "Recebi o Pix" muda pagamento e status em uma única transação; sem confirmação, o pedido expira e devolve estoque e cupom.

### R3-002 — O cancelamento de pedido pago online não estorna
- **Categoria:** pagamentos / consistência financeira.
- **Severidade:** Alta. O dinheiro do cliente fica com a plataforma e nada registra o valor a devolver.
- **Estado:** CONFIRMADO.
- **Onde:**
  - `apps/admin/src/app/loja/pedidos/actions.ts:311-332` (cancelamento pela loja);
  - `apps/admin/src/app/admin/pedidos/actions.ts:62-77` (pela plataforma);
  - `packages/database/src/cancelamento.ts:19-62`: devolve estoque, corrida e cupom, mas não o pagamento.
- **Reprodução segura:** `grep -rn "refund" apps --include=*.ts` → o único chamador é `separacao.ts:312` (pesagem). Nenhum caminho de cancelamento chama `getPaymentGateway().refund` nem muda `Payment.status`.
- **Esperado × observado:** um pedido `PAID` por Pix ou cartão que é cancelado deveria gerar um estorno, ou ao menos ficar `Payment.status=REFUNDED` / "estorno pendente". Observado: `Payment` continua `PAID` e o pedido fica `CANCELLED`.
- **Evidência:** as três funções citadas; `desfazerReservasDoPedido` não toca em `payment`.
- **Impacto:** cliente cobrado sem receber; passivo financeiro invisível; chargeback.
- **Correção proposta:** dentro de `desfazerReservasDoPedido`, ou num serviço `cancelarPedido` único, marcar o pagamento online pago como `REFUND_PENDING` (via `failReason` ou status novo) e chamar `refund` fora da transação com idempotência `refund_<orderId>`. O resultado vai para `PaymentEvent`. Uma falha cai numa fila de reconciliação.
- **Teste de aceite:** cancelar um pedido `PAID` com o gateway fake → `refund` chamado uma vez, `Payment.status=REFUNDED`. Com o gateway falhando → estado "estorno pendente", visível no admin.

### R3-003 — O webhook deduplica antes de processar e engole qualquer erro como "duplicado"
- **Categoria:** idempotência / integração de pagamentos.
- **Severidade:** Alta. Uma confirmação de pagamento pode se perder de forma definitiva.
- **Estado:** CONFIRMADO.
- **Onde:** `apps/web/src/app/api/webhooks/pagamento/route.ts:63-76` (cria o `PaymentEvent` com `dedupeKey` único e trata `catch {}` como duplicado) e `:82-103` (só depois atualiza o pagamento e o pedido, em operações separadas).
- **Reprodução segura:** em teste unitário, simular falha em `prisma.payment.update` (linha 82) após o insert do evento → 500. O reenvio do gateway cai na linha 75 (`duplicate: true`) e o pedido fica `PENDING_PAYMENT` para sempre. Qualquer erro do insert (enum inválido, banco fora) também vira "duplicado".
- **Esperado × observado:** a deduplicação deve fazer parte da mesma transação do efeito (evento, pagamento, pedido, histórico), e só `P2002` conta como duplicado. Observado: evento gravado, efeito não aplicado, reenvio ignorado.
- **Evidência:** as linhas citadas. `payment.update` (82) e o `$transaction` do pedido (94) são independentes.
- **Impacto:** pedido pago que nunca chega à loja e depois é cancelado pelo job de expiração (R3-004).
- **Correção proposta:** um único `prisma.$transaction(async tx => …)` com insert do evento, update condicional do pagamento e update condicional do pedido (`where: {id, status:'PENDING_PAYMENT'}`). Tratar `P2002` explicitamente e repassar o resto (500 → o provedor reenvia).
- **Teste de aceite:** com falha injetada no update, o reenvio do mesmo evento processa normalmente; um evento duplicado de verdade devolve `duplicate: true` sem efeito.

### R3-004 — Corrida entre a expiração do Pix e o webhook, sem reconciliação
- **Categoria:** concorrência / reconciliação.
- **Severidade:** Alta. Um pedido pago pode ser cancelado, e nada percebe.
- **Estado:**
  - FORTE INDÍCIO: a corrida em si.
  - CONFIRMADO: a falta de reconciliação.
- **Onde:**
  - `apps/worker/src/jobs/order-timeout.ts:30-42`: lê o status e depois faz `order.update` incondicional.
  - `route.ts:93`: só promove se o pedido ainda está `PENDING_PAYMENT`; se já está `CANCELLED`, apenas grava `Payment=PAID` e publica `paymentStatus` (linhas 118-124).
  - `getPaymentStatus` existe (`mercadopago.ts:158`), mas `grep -rn getPaymentStatus apps` volta vazio.
- **Reprodução segura:**
  1. Teste com dois processos: o job lê `PENDING_PAYMENT` (linha 30).
  2. O webhook PAID promove o pedido para `RECEIVED`.
  3. O job grava `CANCELLED` (linha 35).
  4. Resultado: pedido cancelado, pagamento `PAID`. Pela ordem inversa (PAID chega depois dos 35 min), dá o mesmo.
- **Esperado × observado:** a expiração deveria usar `updateMany where {id, status:'PENDING_PAYMENT'}` e consultar o gateway antes de cancelar; um PAID sobre pedido cancelado deveria disparar estorno ou alerta. Observado: nenhum dos dois.
- **Impacto:** cliente paga e o pedido some; nada no painel indica o valor a devolver.
- **Correção proposta:**
  - transição condicional em todos os caminhos (R3-005);
  - no job, `getPaymentStatus(externalId)` antes de cancelar;
  - no webhook, PAID sobre pedido cancelado → estorno automático ou registro "pago após cancelamento" visível no admin;
  - rotina periódica de reconciliação dos `PENDING_PAYMENT` com mais de 40 min.
- **Teste de aceite:** um teste de integração com as duas ordens de chegada termina em "pedido RECEIVED" ou em "CANCELLED + estorno", nunca em "CANCELLED + PAID".

### R3-005 — Trocas de status sem concorrência otimista em cinco caminhos
- **Categoria:** transações / arquitetura.
- **Severidade:** Alta. Pode ressuscitar um pedido cancelado (já com estoque e cupom devolvidos) e duplicar a contagem do entregador.
- **Estado:** FORTE INDÍCIO (o código prova a janela; não rodei carga concorrente).
- **Onde:** todos leem o status e depois fazem `order.update({ where: { id } })` sem condicionar ao status lido:
  - `apps/admin/src/app/loja/pedidos/actions.ts:75-168`;
  - `loja/pedidos/actions.ts:281-320` (cancelamento);
  - `admin/pedidos/actions.ts:36-70`;
  - `apps/admin/src/app/entregador/actions.ts:94-146`;
  - `route.ts:94-103`;
  - `order-timeout.ts:34-42`.
- **Reprodução segura:**
  - **Caso A:** o entregador toca "Entregue" (lê a entrega `PICKED_UP`, linha 94) enquanto a loja cancela (`desfazerReservasDoPedido` põe a entrega em `CANCELLED`). A transação do entregador (linhas 120-146) grava a entrega e o pedido como `DELIVERED`.
  - **Caso B:** dois toques em "Entregue" → dois `deliveryCount: increment` e dois históricos.
- **Esperado × observado:** a transição deveria ser atômica (`updateMany where {id, status: atual}` e checar `count`). Observado: last-write-wins. O comentário de `loja/pedidos/actions.ts:21-28` ("Toda mudança de status passa por aqui") é falso: há cinco implementações.
- **Impacto:** pedidos com status incoerente, estoque e cupom devolvidos para um pedido "entregue", comissão faturada sobre um pedido que foi cancelado (R3-006 conta `DELIVERED`).
- **Correção proposta:** um serviço único `transicionarPedido(tx, {orderId, de, para, ator, nota})` em `packages/database`, com `updateMany` condicionado, histórico e sincronização da corrida. Todos os caminhos passam a usá-lo, e a entrega também usa `updateMany where {id, courierId, status: de}`, como já faz `avancarCorridaAvulsa` (linha 279).
- **Teste de aceite:** um teste concorrente com `Promise.all` de cancelar e entregar termina num único estado final válido, com `deliveryCount` igual a 1.

### R3-006 — A comissão do plano grátis nunca é faturada e a janela perde pedidos
- **Categoria:** consistência financeira / job.
- **Severidade:** Alta. A principal receita do plano de entrada (12% de comissão) é zero.
- **Estado:** CONFIRMADO (código e dados do seed local).
- **Onde:**
  - `apps/worker/src/jobs/plan-billing.ts:22`: `plan: { monthlyPriceCents: { gt: 0 } }`.
  - `plan-billing.ts:57-67`: janela por `createdAt < inicio` e `status DELIVERED` no momento da execução.
  - `apps/admin/src/app/loja/impulsionar/actions.ts:44-60`: trocar de plano reinicia o período e o trial.
- **Reprodução segura:** `docker exec rapidinho-postgres psql -U rapidinho -d rapidinho -c "select slug,\"monthlyPriceCents\",\"commissionRate\" from plans"` → `gratis | 0 | 12.00`. Uma loja nesse plano nunca entra na consulta da linha 18.
- **Esperado × observado:** a comissão dos pedidos entregues é cobrada de toda loja com `commissionRate > 0`. Observado:
  - lojas no plano grátis nunca recebem fatura;
  - um pedido criado antes do fechamento e entregue depois das 9h não entra em nenhum período;
  - trocar de plano a cada 29 dias zera o período e reaplica o trial, então a fatura nunca chega.
- **Evidência:** saída acima (`gratis|0|12.00`, `essencial|4990|8.00`, …) e as linhas citadas.
- **Impacto:** perda direta de receita da plataforma.
- **Correção proposta:**
  - faturar por `deliveredAt` em vez de `createdAt`;
  - incluir planos com mensalidade zero quando houver comissão;
  - aplicar o trial uma única vez por loja (`trialUsedAt`);
  - na troca de plano, fechar o período anterior com uma fatura proporcional.
- **Teste de aceite:** uma loja no plano grátis com R$ 100 entregues no período recebe fatura de R$ 12; um pedido entregue após o fechamento entra no período seguinte; trocar de plano não reabre o trial.

### R3-007 — Impulsionamento sem cobrança, receita fictícia e faturas sem quitação
- **Categoria:** funcionalidade fantasma / financeiro.
- **Severidade:** Alta. Um produto pago é entregue de graça e o painel financeiro mostra receita que não existe.
- **Estado:** CONFIRMADO.
- **Onde:**
  - `apps/admin/src/app/loja/impulsionar/actions.ts:108-118`: cria `StoreBoost` já `ACTIVE`, com `paidCents: pacote.priceCents`, sem cobrança nem fatura.
  - `apps/admin/src/app/admin/financeiro/page.tsx:63-66`: soma `paidCents` como receita.
  - `grep -rn "planInvoice\.\(update\|create\)" apps` → só o `create` do worker; não há como marcar uma fatura como paga, nem `OVERDUE`/`PAST_DUE`.
- **Reprodução segura:** o lojista e2e contrata um pacote em `/loja/impulsionar` → o destaque entra no ar na hora; nenhuma `PlanInvoice` ou `Payment` é criada.
- **Esperado × observado:** o boost deveria virar fatura ou cobrança e só ativar com o pagamento, ou entrar na fatura do mês. Observado: grátis, contabilizado como pago.
- **Impacto:** receita não realizada apresentada como realizada; nenhuma inadimplência detectável.
- **Correção proposta:** um item de cobrança (`PlanInvoice` com linhas, ou `Payment` do boost); ativar após o pagamento ou faturar no fechamento; ação de admin "marcar fatura paga" e job que marca `OVERDUE`/`PAST_DUE`.
- **Teste de aceite:** contratar um boost gera uma cobrança pendente; o financeiro só soma o que foi quitado; uma fatura vencida passa a `OVERDUE`.

### R3-008 — O cartão online é oferecido, mas sempre falha
- **Categoria:** funcionalidade fantasma.
- **Severidade:** Alta. Uma forma de pagamento visível ao cliente não funciona em nenhum caso.
- **Estado:** CONFIRMADO.
- **Onde:**
  - `apps/admin/src/app/loja/configuracoes/actions.ts:90,116`: a loja liga `acceptsCardOnline`.
  - `apps/web/src/app/checkout/[storeId]/page.tsx:98` e `formulario.tsx:78`: o cliente vê a opção.
  - `packages/shared/src/schemas/order.ts:88-91`: exige `cardToken`.
  - `checkout/actions.ts:73-85`: nunca lê `cardToken`.
  - `createCardCharge` não tem chamador (`grep -rn createCardCharge apps` → vazio).
- **Reprodução segura:** ligar o cartão online na loja e2e e escolher "Cartão de crédito (online)" no checkout → `ZodError` → "Não foi possível concluir".
- **Esperado × observado:** tokenizar o cartão e chamar `createCardCharge`, ou esconder a opção. Observado: a opção existe e falha sempre.
- **Evidência:** banco local, `acceptsCardOnline` = 0 de 12 lojas (o defeito só aparece quando a loja liga a opção).
- **Impacto:** perda de venda e confiança; lojista acha que oferece cartão.
- **Correção proposta:** retirar `acceptsCardOnline` da UI até existir tokenização (SDK MP + `createCardCharge` + webhook), ou implementar o fluxo completo.
- **Teste de aceite:** com a opção desativada no produto, o checkout não a mostra; implementada, o e2e com o gateway fake fecha o pedido como `PAID`.

### R3-009 — Um cliente que cadastra loja não consegue entrar no painel (regressão do login por senha)
- **Categoria:** regressão / login.
- **Severidade:** Alta. Bloqueia a entrada de novos lojistas que já usavam o app, um caso comum em cidade pequena.
- **Estado:** CONFIRMADO.
- **Onde:**
  - `apps/web/src/app/cadastro-loja/actions.ts:107-139`: `upsert` por telefone; no `update` só muda `name`, então e-mail e senha digitados são descartados.
  - `cadastro-loja/actions.ts:201-207`: promove para `STORE_OWNER`.
  - `packages/auth/src/senha.ts:21-36`: o painel exige `passwordHash`.
  - Não há SMS para lojista no painel (`apps/admin/src/app/entrar/actions.ts:109-111`).
- **Reprodução segura:** com um telefone de cliente já existente (seed), preencher `/cadastro-loja` com e-mail e senha novos → a loja é criada e o usuário fica `STORE_OWNER` com `email`/`passwordHash` nulos. Em `/entrar` do painel, "E-mail ou senha incorretos".
- **Esperado × observado:** definir e-mail e senha quando a conta não tem senha (de preferência após provar o telefone), ou avisar e oferecer caminho. Observado: aceita, promete "Entre no painel com seu e-mail e senha" (linha 103) e tranca o usuário fora.
- **Evidência:** as linhas citadas. Além disso, `user.upsert` (linha 127) roda fora do `$transaction` da loja (linha 162): se a criação da loja falhar, sobra um usuário órfão `STORE_OWNER` (no caso de criação).
- **Impacto:** abandono do cadastro e carga no suporte (só o super admin destrava, via senha provisória).
- **Correção proposta:** se o usuário existe sem `passwordHash`, gravar a senha depois de confirmar a posse (código por SMS) ou mostrar a mensagem "fale conosco"; mover o `upsert` para dentro da transação.
- **Teste de aceite:** e2e "cliente existente cadastra loja e entra no painel com a senha escolhida".

### R3-010 — Repasses nunca gerados, embora a plataforma receba pelo gateway (antigo R3-004)
- **Categoria:** funcionalidade fantasma / financeiro.
- **Severidade:** Alta (era S2). Todas as 12 lojas locais aceitam Pix **sem** chave Pix, então todo Pix passa pelo gateway da plataforma (`checkout/actions.ts:519,538`) e nenhum registro diz quanto é devido à loja.
- **Estado:** CONFIRMADO.
- **Onde:**
  - `apps/admin/src/app/admin/financeiro/page.tsx:57` e `apps/admin/src/app/loja/financeiro/page.tsx:66` leem `payout`.
  - `grep -rn "payout\.\(create\|update\)" apps packages` → vazio.
  - `SettlementMode.PLATFORM_COLLECTS` nunca é usado e não há UI para trocar o modo.
- **Reprodução segura:**
  - `psql … -c "select count(*) from payouts"` → `0`.
  - `psql … -c "select count(*) filter (where \"acceptsPix\" and (\"pixKey\" is null or \"pixKey\"='')), count(*) filter (where \"acceptsPix\") from stores"` → `12|12`.
- **Esperado × observado:** um pedido pago pela plataforma gera um `Payout` pendente (valor menos comissão). Observado: a tabela vive vazia e a tela "Repasses a fazer" mostra R$ 0.
- **Impacto:** dinheiro da loja retido sem controle. A comissão desses pedidos ainda é faturada de novo na mensalidade (R3-006), o que é cobrança dupla em potencial.
- **Correção proposta:** decidir o modelo. Ou exigir `pixKey` para aceitar Pix (sem intermediação), ou gerar o `Payout` ao entregar um pedido `PAID` com provider ≠ `OFFLINE` e excluir esses pedidos da comissão faturada.
- **Teste de aceite:** um pedido Pix pelo gateway entregue gera um `Payout` de `total − comissão`; a fatura mensal não cobra a comissão de novo.

### R3-011 — Cupom: limites checados fora da transação e unicidade furada no cupom global
- **Categoria:** concorrência / restrição de dados.
- **Severidade:** Média. Uma campanha limitada pode estourar o orçamento; o mesmo cliente pode usar mais de uma vez.
- **Estado:**
  - FORTE INDÍCIO: a corrida.
  - CONFIRMADO: o índice.
- **Onde:**
  - `apps/web/src/lib/checkout.ts:148-153`: contagens fora da transação.
  - `checkout/actions.ts:388-400`: `couponRedemption.create` e `usageCount: { increment: 1 }` sem condição.
  - `packages/database/prisma/schema.prisma:1671` `@@unique([code, storeId])`: no Postgres, `NULL` é distinto. O cupom global tem `storeId NULL`, então a unicidade não vale para ele (a proteção é só um `findFirst` na action, `admin/cupons/actions.ts:50`, também sujeito a corrida).
  - `lib/checkout.ts:134-143`: `findFirst` sem `orderBy`, ambíguo se a loja tiver cupom com o mesmo código de um global.
- **Reprodução segura:**
  - `psql … -c "select indexdef from pg_indexes where tablename='coupons'"` → `UNIQUE … (code, "storeId")`, sem `NULLS NOT DISTINCT`.
  - Corrida: dois checkouts simultâneos com um cupom `usageLimit = 1`.
- **Esperado × observado:** `updateMany where {id, OR:[{usageLimit:null},{usageCount:{lt: usageLimit}}]}` e checar `count`; unicidade por usuário (`@@unique([couponId,userId])` quando `usagePerUser = 1`, ou contagem dentro da transação com lock). Observado: tudo baseado em leituras anteriores.
- **Impacto:** desconto concedido além do limite.
- **Correção proposta:** a condição acima; um índice parcial `CREATE UNIQUE INDEX … ON coupons(code) WHERE "storeId" IS NULL` via migration SQL; `orderBy` determinístico (loja antes de global).
- **Teste de aceite:** 10 checkouts concorrentes com `usageLimit = 3` → exatamente 3 resgates.

### R3-012 — Aceitar corrida não confere cidade nem loja do entregador
- **Categoria:** autorização inconsistente.
- **Severidade:** Média. Um entregador de outra cidade, ou de uma loja, pega a corrida da frota da plataforma conhecendo o id.
- **Estado:** CONFIRMADO.
- **Onde:** `apps/admin/src/app/entregador/actions.ts:51-63` (`where: {id, status:'PENDING', courierId:null}`). A listagem filtra por `order.cityId` e `storeId` (`apps/admin/src/app/entregador/page.tsx:55-66`), e a corrida avulsa também (`actions.ts:248-256`).
- **Reprodução segura:** chamar a server action `aceitarCorrida({deliveryId})` como entregador de outra cidade (id obtido de outro contexto) → aceita.
- **Esperado × observado:** mesma regra da lista, de preferência exigindo `isOnline`. Observado: nenhum filtro.
- **Impacto:** corrida "sequestrada", pedido atrasado; pouco provável sem o id (cuid), mas a regra está quebrada.
- **Correção proposta:** incluir `order: { cityId, ...(storeId ? {storeId} : {}) , status: {in:['READY','PREPARING']} }` no `updateMany`.
- **Teste de aceite:** um entregador de outra cidade recebe "corrida não encontrada".

### R3-013 — Falha do Pix engolida, sem "tentar de novo"; risco de gateway falso em produção
- **Categoria:** tratamento de erro / integração.
- **Severidade:** Média. O cliente fica com um pedido sem QR, que expira em 35 minutos.
- **Estado:**
  - CONFIRMADO: o código.
  - HIPÓTESE: o valor real em produção.
- **Onde:**
  - `apps/web/src/app/checkout/actions.ts:556-558`: `catch` só reporta ao Sentry.
  - `apps/web/src/app/pedidos/[id]/acompanhamento.tsx:228`: o bloco de pagamento só aparece se houver `pixQrCode`, sem botão de nova tentativa, apesar do comentário em `checkout/actions.ts:507-508`.
  - `.github/scripts/preparar-env.sh:134`: `garantir_env "PAYMENT_PROVIDER" "fake"`.
  - `packages/services/src/providers.ts:111-113`: fake em produção lança exceção.
- **Reprodução segura:** em teste, `getPaymentGateway` lançando → pedido criado `PENDING_PAYMENT` e tela sem QR.
- **Esperado × observado:** um botão "Gerar Pix de novo" (a idempotência `pix_<orderId>` já existe) ou falha visível. Observado: silêncio. Se a produção estiver com `PAYMENT_PROVIDER=fake` (o padrão do deploy), toda loja sem `pixKey` cai aqui e o webhook responde 500.
- **Impacto:** venda perdida em silêncio.
- **Correção proposta:** uma action `gerarPixDeNovo(orderId)` com a mesma chave idempotente e o bloco de erro na tela. No boot, falhar se uma loja aceitar Pix sem chave e o provedor for fake.
- **Teste de aceite:** com o gateway falhando, a tela mostra "Tentar de novo"; com ele de volta, o QR aparece.

### R3-014 — Contrato de env aceita provedores inexistentes e WhatsApp falso em produção
- **Categoria:** contrato de configuração.
- **Severidade:** Média.
- **Estado:**
  - CONFIRMADO: o código.
  - HIPÓTESE: o valor em produção (SSH negado).
- **Onde:**
  - `packages/shared/src/env.ts:35`: `PAYMENT_PROVIDER` aceita `asaas`.
  - `env.ts:41`: `WHATSAPP_PROVIDER` aceita `cloud`.
  - `packages/services/src/providers.ts:60-67`: `cloud` vira fake.
  - `providers.ts:104-115`: `asaas` vira fake, com a mensagem enganosa "fake não pode ser usado em produção".
  - Não há guarda para WhatsApp fake em produção.
  - `preparar-env.sh:135-136` define `WHATSAPP_PROVIDER=fake` e `OTP_PROVIDER=whatsapp` quando não há chave da SMSDev.
- **Reprodução segura:** `node -e` com `parseServerEnv({...,WHATSAPP_PROVIDER:'cloud'})` passa; `getWhatsApp().name` → `fake`.
- **Esperado × observado:** um valor sem implementação deveria ser recusado na validação; WhatsApp fake deveria ser proibido em produção, como já acontece com OTP console e pagamento fake. Observado:
  - em produção sem SMSDev, o código de login vai para o log (`messaging/whatsapp.ts:64`);
  - as notificações são registradas como `SENT` sem envio (`notifications/index.ts:133`).
- **Impacto:** login impossível ou código em log; métricas de notificação falsas.
- **Correção proposta:** tirar `asaas` e `cloud` dos enums até existirem e recusar `WHATSAPP_PROVIDER=fake` com `NODE_ENV=production`, ou fazer o fake devolver `isConfigured() = false` em produção.
- **Teste de aceite:** um teste unitário de `parseServerEnv` recusa as combinações.

### R3-015 — Notificações síncronas, retentativas inúteis e falhas sem registro
- **Categoria:** integração / desempenho / observabilidade.
- **Severidade:** Média.
- **Estado:** CONFIRMADO.
- **Onde:**
  - `packages/services/src/notifications/index.ts:37-52`: `notificarUsuario` é chamada com `await` dentro das actions (13 chamadores, por exemplo `loja/pedidos/actions.ts:192`).
  - `messaging/whatsapp.ts:41`: timeout de 10 s por envio.
  - `apps/admin/src/app/loja/corridas/actions.ts:145-157`: dispara até 50 envios na requisição do lojista.
  - `notifications/index.ts:45`: `Promise.allSettled`, então nunca lança. O worker (`apps/worker/src/main.ts:36`) com `attempts: 3` nunca tenta de novo.
  - `notifications/index.ts:128-133`: timeout ou erro de rede rejeita antes de `registrar`, então não fica `FAILED` no log.
  - A fila `notifications` só é usada por campanha (`campaign.ts:108`).
- **Reprodução segura:** com `EVOLUTION_API_URL` apontando para um host que não responde, mudar o status de um pedido → a action demora cerca de 10 s e nenhuma linha `FAILED` aparece em `notification_logs`.
- **Esperado × observado:** enfileirar as notificações transacionais (jobId `notif-<pedido>-<status>`, idempotente), lançar no worker para haver retentativa e registrar `FAILED` em qualquer exceção. Observado: tudo no caminho da requisição.
- **Impacto:** painel lento quando o provedor degrada; avisos perdidos sem rastro; risco de bloqueio do número por rajada.
- **Correção proposta:** `enfileirarNotificacao` em todos os chamadores; `try/catch` em `enviarWhatsApp`/`enviarPush`/`enviarEmail` com `registrar('FAILED', erro)`; no worker, falha de canal → `throw` para retentar só aquele canal.
- **Teste de aceite:** com o provedor fora, a action responde em menos de 500 ms, o log mostra `FAILED` e o job tenta 3 vezes.

### R3-016 — Redis com `allkeys-lru` e nenhuma varredura de jobs órfãos (reconfirma o antigo R3-013)
- **Categoria:** jobs / infraestrutura de dados.
- **Severidade:** Média.
- **Estado:** CONFIRMADO (configuração local e compose).
- **Onde:**
  - `docker-compose.yml:238`: `--maxmemory-policy allkeys-lru`; `docker-compose.prod.yml` não sobrescreve.
  - `checkout/actions.ts:484-493`: falha ao agendar expiração ou lembrete é só reportada.
  - Não há rotina que procure `PENDING_PAYMENT` ou `RECEIVED` antigos.
- **Reprodução segura:** `docker exec rapidinho-redis redis-cli config get maxmemory-policy` → `allkeys-lru`.
- **Esperado × observado:** BullMQ exige `noeviction`; jobs atrasados (expiração em 35 min, lembrete em 3 min) não podem ser descartados. Observado: com pressão de memória, jobs somem e pedidos ficam presos.
- **Impacto:** pedidos não pagos presos para sempre (com cupom e estoque); loja sem lembrete.
- **Correção proposta:** `noeviction` (ou um Redis separado para filas) e uma rotina `varrer-pedidos-pendentes` a cada 10 min via `upsertJobScheduler`.
- **Teste de aceite:** `config get` → `noeviction`; um pedido `PENDING_PAYMENT` sem job é cancelado pela varredura.

### R3-017 — A exclusão de conta não apaga o snapshot do endereço
- **Categoria:** dados / LGPD.
- **Severidade:** Média. Dado pessoal (endereço completo) continua nos pedidos depois da "exclusão".
- **Estado:** CONFIRMADO (semântica documentada do Prisma: `undefined` significa "não alterar").
- **Onde:** `apps/web/src/app/conta/dados/actions.ts:128`: `addressSnapshot: undefined`.
- **Reprodução segura:** em local, um cliente com pedido entregue exclui a conta e depois `select "addressSnapshot" from orders where "userId"=…` → o JSON continua lá.
- **Esperado × observado:** `addressSnapshot: Prisma.DbNull` (ou um objeto anonimizado). Observado: nada muda.
- **Impacto:** descumprimento do pedido de eliminação (LGPD, art. 18, VI).
- **Correção proposta:** `Prisma.DbNull`, ou manter só bairro/cidade para estatística.
- **Teste de aceite:** um teste de integração exclui a conta e confere `addressSnapshot IS NULL`.

### R3-018 — Fluxos de login duplicados e já divergentes
- **Categoria:** duplicação / regressão arquitetural (commits 7cada39 e 6cb5ecb).
- **Severidade:** Média. A divergência abre bombeamento de SMS pago (a marca de user-agent é trivial de forjar).
- **Estado:** CONFIRMADO.
- **Onde:**
  - `apps/web/src/app/entrar/actions.ts:68-118` limita **só por telefone**; a API `apps/web/src/app/api/auth/otp/request/route.ts:43-54` limita também por IP.
  - `apps/web/src/app/api/auth/otp/{request,verify}` não têm consumidor (`grep -rn "api/auth/otp" apps` fora da própria pasta → vazio; o app Android usa o site).
  - `verify/route.ts` não confere `estaNoAppNativo` e devolve `next: '/completar-cadastro'` (linha 49), rota que não existe.
  - A lógica de solicitar e verificar código está copiada em `apps/admin/src/app/entrar/actions.ts:82-193`.
  - O redirecionamento seguro está repetido 5 vezes.
- **Reprodução segura:** com UA ` RapidinhoApp/teste`, chamar `autenticar` do site com 50 telefones diferentes a partir do mesmo IP → 50 envios (em local, `OTP_PROVIDER=console`, nenhum SMS real). Pela API, o limite por IP pararia em 9.
- **Esperado × observado:** um caso de uso único (`solicitarCodigoDeLogin({phone, ip, ua, papelExigido})`) em `packages/auth`, usado pelas duas actions. Observado: três cópias com regras diferentes.
- **Impacto:** custo de SMS sem teto por IP; manutenção divergente.
- **Correção proposta:** extrair o caso de uso com limite por telefone e por IP; remover as rotas `/api/auth/otp/*` ou fazê-las delegar a ele; extrair `destinoSeguro()`.
- **Teste de aceite:** um teste unitário do caso de uso aplica os dois limites; `grep` não encontra lógica de OTP fora de `packages/auth`.

### R3-019 — Funcionário da loja sem fluxo de criação; contas antigas trancadas
- **Categoria:** funcionalidade fantasma / regressão de login.
- **Severidade:** Média.
- **Estado:** CONFIRMADO.
- **Onde:**
  - `grep -rn "storeStaff\.\(create\|upsert\)\|staff: {\s*create" apps` → só `cadastro-loja/actions.ts:182` (OWNER). `StoreStaffRole.MANAGER`/`OPERATOR` só no seed.
  - Com 6cb5ecb, o painel só aceita senha (`apps/admin/src/app/entrar/actions.ts:109`).
- **Reprodução segura:** `psql … -c "select role,count(*),count(email),count(\"passwordHash\") from users group by role"` → `STORE_OWNER|13|2|1`, `STORE_STAFF|2|0|0`, `ADMIN|1|0|0`.
- **Esperado × observado:** um fluxo "convidar funcionário" com e-mail e senha provisória, e uma migração das contas antigas. Observado:
  - o escopo promete "lojistas e funcionários operam pelo painel", mas não há como criar funcionário;
  - quem entrava por SMS (12 de 13 lojistas no seed) agora depende do super admin, um por um.
- **Impacto:** a operação para no dia do deploy se a base de produção estiver como o seed (HIPÓTESE para produção).
- **Correção proposta:** a tela de equipe em `/loja/entregadores` → "Equipe" com convite; um script que lista as contas sem senha antes do deploy.
- **Teste de aceite:** o dono convida um funcionário, que entra com a senha provisória e é obrigado a trocá-la.

### R3-020 — Separação: estorno parcial duplicável e refund sem idempotência
- **Categoria:** concorrência / pagamentos.
- **Severidade:** Média.
- **Estado:** FORTE INDÍCIO.
- **Onde:**
  - `apps/admin/src/app/loja/pedidos/separacao.ts:212-214`: checa `pickedAt` e depois grava sem condição (linhas 268-299).
  - `separacao.ts:310-321`: refund fora da transação.
  - `packages/services/src/payments/mercadopago.ts:163-167`: refund sem `X-Idempotency-Key` (o Pix e o cartão têm).
- **Reprodução segura:** dois "Concluir separação" simultâneos num pedido pago com item em falta → dois `refund` com o mesmo valor.
- **Esperado × observado:** `updateMany where {id, pickedAt:null}` e checar `count` antes de estornar; chave `refund_<orderId>_<n>`. Observado: os dois passam.
- **Impacto:** devolução em dobro ao cliente.
- **Correção proposta:** as duas acima e um registro `PaymentEvent` do estorno.
- **Teste de aceite:** um teste concorrente faz um único refund.

### R3-021 — Integrações sem timeout
- **Categoria:** integração / resiliência.
- **Severidade:** Média. O checkout espera o gateway sem limite.
- **Estado:** CONFIRMADO.
- **Onde:**
  - `packages/services/src/payments/mercadopago.ts:57-65`: `fetch` sem `signal`; chamado de dentro de `finalizarPedido` (`checkout/actions.ts:420`) e do webhook (`mercadopago.ts:225`).
  - `packages/services/src/messaging/push.ts:25`: `webpush.sendNotification` sem `timeout`.
  - SMSDev e Evolution têm 10 s (`otp.ts:72`, `whatsapp.ts:41`).
- **Reprodução segura:** apontar o `BASE` para um servidor que não responde (teste unitário com `fetch` mockado pendurado) → a promise nunca resolve.
- **Esperado × observado:** `AbortSignal.timeout(10_000)` e o mesmo padrão dos outros provedores. Observado: espera indefinida, limitada só pelo timeout do Node/Next.
- **Impacto:** checkout travado com o MP lento; o cliente clica de novo (o carrinho protege contra pedido duplo, mas não contra a espera).
- **Correção proposta:** um timeout em `chamar()` e `{ timeout: 10_000 }` no web-push.
- **Teste de aceite:** um teste unitário com `fetch` pendurado rejeita em até 10 s.

### R3-022 — Documentos aprovados que ninguém envia (antigo R3-006)
- **Categoria:** funcionalidade fantasma.
- **Severidade:** Média.
- **Estado:** CONFIRMADO.
- **Onde:**
  - `apps/admin/src/app/admin/entregadores/actions.ts:50` (`courierDocument.updateMany`);
  - `admin/entregadores/page.tsx:60,154`;
  - `grep -rn "courierDocument\|storeDocument" apps` → nenhuma criação;
  - `MediaContext.COURIER_DOCUMENT`/`STORE_DOCUMENT` sem uso.
- **Reprodução segura:** `psql … -c "select count(*) from courier_documents"` → `0`; `… store_documents` → `0`.
- **Esperado × observado:** um upload de documento no cadastro (web `/entregador`, `/cadastro-loja`). Observado: o admin aprova sem documento algum.
- **Impacto:** aprovação de cadastro sem verificação; risco legal (entregador sem CNH conferida).
- **Correção proposta:** decisão do dono. Ou implementar o upload (o contexto de mídia já existe), ou remover a coluna e a tela.
- **Teste de aceite:** um cadastro de entregador com foto da CNH aparece na aprovação.

### R3-023 — Localização do entregador pela metade (antigo R3-003)
- **Categoria:** funcionalidade fantasma / código morto.
- **Severidade:** Baixa. Nada promete o recurso na tela.
- **Estado:** CONFIRMADO.
- **Onde:** `apps/admin/src/app/entregador/actions.ts:205-224`.
- **Reprodução segura:**
  - `grep -rn "atualizarLocalizacao\|watchPosition\|geolocation" apps` → só a definição;
  - `grep -rn "courierLocation" apps` → só a publicação;
  - `psql … -c "select count(*), count(latitude) from couriers"` → `2|0`.
- **Esperado × observado:** completar ou remover. Observado: escrita sem leitor nem chamador.
- **Correção proposta:** remover até haver produto (mapa ou ETA).
- **Teste de aceite:** `grep` sem ocorrências, ou e2e com mapa.

### R3-024 — "Novas corridas aparecem sozinhas" sem evento publicado
- **Categoria:** consistência entre realtime e banco.
- **Severidade:** Baixa.
- **Estado:** CONFIRMADO.
- **Onde:**
  - `apps/admin/src/app/entregador/painel.tsx:104-113,133`: escuta só `courier:<id>`.
  - `apps/admin/src/app/loja/pedidos/actions.ts:474-494`: `abrirCorrida` não publica nada.
  - `REALTIME_CHANNELS.city` nunca é usado.
  - Só funciona porque `corridas-avulsas.tsx:44-49` faz `router.refresh()` a cada 15 s.
  - `abrirCorrida` também trata **qualquer** erro como "corrida já existia" (linha 490).
- **Reprodução segura:** `grep -rn "CHANNELS.city" apps packages` → só a definição.
- **Esperado × observado:** publicar `delivery:available` no canal da cidade (ou da loja) ao abrir a corrida. Observado: o atraso depende de um polling colateral; se o componente de avulsas sair da página, as corridas param de aparecer.
- **Correção proposta:** publicar no canal da cidade; no `catch`, só engolir `P2002`.
- **Teste de aceite:** um entregador conectado recebe o evento em menos de 2 s ao pedido ficar pronto.

### R3-025 — Código morto e contratos declarados sem uso
- **Categoria:** código morto.
- **Severidade:** Baixa.
- **Estado:** CONFIRMADO.
- **Onde:**
  - `packages/shared/src/constants/index.ts:102` `QUEUES.reports`, sem produtor nem worker (reconfirma o antigo R3-009).
  - `packages/services/src/queues.ts:82` `enfileirarProcessamentoDeImagem` nunca chamado; o worker `image-processing` (`apps/worker/src/main.ts:42-47`) nunca recebe job.
  - `packages/auth/src/otp.ts:313` `purgeExpiredOtpCodes` ("roda por job") nunca agendado, e não existe limpeza de `sessions` vencidas. Local: `otp_codes` 44, sendo 21 vencidos.
  - `constants/index.ts:117-119` `RATE_LIMITS.search/checkout/upload` declarados e nunca consumidos (`grep RATE_LIMITS.` mostra só `otpRequest`, `otpVerify`, `senhaLogin`, `smsGateway`).
- **Reprodução segura:** os `grep` citados; `redis-cli --scan --pattern 'bull:*'` não mostra `bull:reports`.
- **Correção proposta:**
  - remover `reports` e o worker de imagem, ou agendar reprocessamento de `isProcessed=false`;
  - agendar `purgeExpiredOtpCodes` e a limpeza de sessões vencidas no worker;
  - aplicar os limites de checkout, busca e upload, ou removê-los.
- **Teste de aceite:** `upsertJobScheduler('limpeza-auth')` registrado; `grep` sem símbolos órfãos.

### R3-026 — Enums e colunas nunca usados (reconfirma o antigo R3-010)
- **Categoria:** modelo de dados.
- **Severidade:** Baixa.
- **Estado:** CONFIRMADO (script `enums.mjs` e `grep` direcionado).
- **Valores sem uso no código** (fora do schema, do generated e do seed):
  - `PaymentStatus.ON_DELIVERY`: pagamento na entrega fica `PENDING` para sempre, mesmo depois de entregue, porque nenhum caminho marca o pagamento em dinheiro como pago.
  - `SettlementMode.PLATFORM_COLLECTS` (R3-010).
  - `SubscriptionStatus.PAST_DUE` (R3-007).
  - `NotificationChannel.SMS`.
  - `NotificationStatus.QUEUED`/`READ`.
  - `MediaContext.CATEGORY_ICON`/`PIZZA_FLAVOR`/`STORE_DOCUMENT`/`COURIER_DOCUMENT`.
  - `DataRequestType.EXPORT`.
  - Acréscimo: `StoreStaffRole.MANAGER`/`OPERATOR` (R3-019).
- **Soft delete incoerente:**
  - `Store.deletedAt` é filtrado em 33 arquivos e nunca gravado (não há exclusão de loja);
  - `Address.deletedAt` existe e é filtrado no checkout (`checkout/actions.ts:224`), mas a exclusão é física (`apps/web/src/app/enderecos/actions.ts:126`).
  - `Product.deletedAt` é coerente (todas as consultas por loja filtram; as buscas por id já vêm de listas filtradas).
- **Reprodução segura:** `node scratchpad/r3/enums.mjs <repo>` e `grep -rn "'SMS'" apps packages` (só aparece no rótulo da tela de login).
- **Correção proposta:** para cada valor, implementar ou remover na próxima migration. Escolher um modelo para `Address` (soft ou hard) e remover a coluna morta.
- **Teste de aceite:** o script não lista valores sem decisão registrada.

### R3-027 — `verifyOtp` checa e depois age
- **Categoria:** concorrência / autenticação.
- **Severidade:** Baixa. O código de 6 dígitos e o limite por IP reduzem muito o risco.
- **Estado:** FORTE INDÍCIO.
- **Onde:** `packages/auth/src/otp.ts:103-121`: lê `attempts`, compara e incrementa ou consome com `update({where:{id}})`. Já `completeReverseOtp` (`otp.ts:298-302`) usa `updateMany where consumedAt:null`.
- **Reprodução segura:** N verificações erradas em paralelo, de N IPs, leem `attempts = 0` e passam do teto de `OTP_MAX_ATTEMPTS = 5`.
- **Esperado × observado:** um incremento atômico condicionado (`updateMany where {id, attempts:{lt:max}, consumedAt:null}`) antes de comparar. Observado: janela de corrida.
- **Correção proposta:** a condição acima, no mesmo padrão do fluxo reverso.
- **Teste de aceite:** 20 tentativas paralelas → no máximo 5 comparações.

### R3-028 — Fragilidades da sessão introduzidas no login novo
- **Categoria:** configuração / login (6cb5ecb).
- **Severidade:** Baixa.
- **Estado:** CONFIRMADO.
- **Onde e problemas:**
  1. `apps/web/next.config.mjs:22` embute `RAPIDINHO_SESSAO_DIAS='400'` no build do site. O mesmo nome é lido **em runtime** pelo painel (`packages/auth/src/session.ts:21-22`), e o `next.config` do admin carrega o `.env` da raiz. Basta alguém pôr a variável no `.env` para o painel passar a 400 dias sem aviso. Um valor não numérico vira `NaN`, o que quebra `createDatabaseSession`.
  2. `apps/web/src/middleware.ts:26-40` renova **qualquer** valor de cookie, inclusive token inexistente.
  3. O painel não renova o cookie (`apps/admin/src/middleware.ts` só verifica a presença): o entregador perde a sessão 30 dias após o login, mesmo usando todo dia, e paga um SMS por mês.
  4. `PAPEIS_COM_SENHA` está copiado à mão em `apps/admin/src/app/admin/usuarios/acoes-do-usuario.tsx:23-24`.
  5. A senha provisória (`admin/usuarios/actions.ts:220-224`) não obriga troca.
  6. `sairDoModoLojista` (`apps/admin/src/app/admin/lojas/actions.ts:204`) encerra o `ImpersonationLog` pelo id vindo do cookie, sem guard (impacto desprezível, registrado por coerência).
- **Reprodução segura:**
  `curl -s -o /dev/null -D - -H "Cookie: authjs.session-token=teste123" http://localhost:3200/privacidade` →
  `set-cookie: authjs.session-token=teste123; … Max-Age=34560000` (token inexistente renovado por 400 dias).
  A mesma chamada ao painel (3201) não regrava o cookie.
- **Correção proposta:**
  - passar o prazo explicitamente (`createDatabaseSession(userId, {dias})` e `authConfig({maxAge})`) por app, sem env compartilhado, ou usar nomes distintos e validar no `env.ts` com `z.coerce.number().int().min(1).max(400)`;
  - renovar só quando a sessão for válida (ou aceitar o custo e documentar);
  - definir a política de renovação do painel para o entregador;
  - exportar a lista de papéis de `@rapidinho/shared`;
  - criar a flag `mustChangePassword`.
- **Teste de aceite:** um teste de `env.ts` recusa `RAPIDINHO_SESSAO_DIAS=abc`; o painel continua com 30 dias mesmo com a variável no `.env`.

### R3-029 — Espaço do número de pedido dividido entre os anos
- **Categoria:** modelo de dados.
- **Severidade:** Baixa.
- **Estado:** CONFIRMADO.
- **Onde:** `apps/web/src/app/checkout/actions.ts:45-64` (prefixo DDMM + 4 dígitos, `number @unique` em `schema.prisma:1120`). A checagem fica fora da transação, e uma colisão no `create` vira o erro genérico "Não foi possível concluir".
- **Esperado × observado:** um espaço por dia que não acumula entre anos. Observado: o 01/11 de cada ano disputa os mesmos 10 mil números, então as colisões crescem com o tempo.
- **Correção proposta:** incluir o ano (AADDMM + sufixo) ou usar uma sequência por dia; tentar de novo em `P2002`.
- **Teste de aceite:** um teste unitário com 10 mil números já usados no mesmo DDMM de outro ano não colide.

---

## O que foi inspecionado e está correto (NÃO REPRODUZIDO)

- **Drift entre schema e migrations: nenhum.**
  - `prisma migrate status` → "11 migrations found… Database schema is up to date!".
  - `prisma migrate diff --from-url $DATABASE_URL --to-schema-datamodel prisma/schema.prisma --script` → "This is an empty migration." (salvo em `diff_db_schema.sql`).
  - `_prisma_migrations`: 11 migrations, todas `finished_at` preenchido e nenhuma revertida.
  - Os índices GIN de busca (`products_fulltext_idx`, `*_trgm_idx`) existem no banco.
- **Dinheiro:** todo valor monetário é `Int` em centavos; percentuais são `Decimal(5,2)`.
  - `information_schema`: as únicas colunas `double precision` são latitude e longitude.
  - Nenhuma coluna `*cents*` fora de `integer`.
- **FKs críticas:** `orders.storeId`/`cityId`, `stores.cityId` e `couriers.cityId` estão como `RESTRICT` (`pg_constraint confdeltype='r'`), então loja ou cidade com pedidos não pode ser apagada fisicamente. Os itens e históricos do pedido estão em `CASCADE`, e os vínculos opcionais em `SET NULL`.
- **Índices das consultas quentes:**
  - `orders(storeId,status,createdAt)`, `orders(userId,createdAt)`;
  - `deliveries(status)`, `deliveries(courierId,status)`;
  - `otp_codes(phone,expiresAt)`, `sessions(sessionToken)` único;
  - busca por trigrama e full-text.
  - Lacuna menor: `sessions.expires` sem índice, irrelevante enquanto não houver limpeza (R3-025).
- **Baixa de estoque no checkout:** é atômica (`updateMany … stockQuantity >= qtd` dentro da transação, `checkout/actions.ts:286-290`). O pedido duplo por clique duplo é barrado pelo `cart.delete` dentro da mesma transação.
- **Aceite de corrida simultâneo:** é atômico (`updateMany where courierId:null`, `entregador/actions.ts:60-67`). O que falta é o filtro de escopo (R3-012).
- **Jobs:** a campanha tem `jobId` fixo; a expiração e o lembrete também têm, e checam o estado antes de agir. `upsertJobScheduler` garante agendamento idempotente; o worker fecha os jobs de forma limpa e tem batimento no Redis.
- **Webhook:** HMAC do Mercado Pago com `timingSafeEqual`, e o status real é buscado na API (`mercadopago.ts:209-225`). A idempotência da criação do Pix usa `X-Idempotency-Key`.
- **Guards das server actions:** o script `guards.mjs` varreu 82 funções exportadas de arquivos `'use server'` do admin.
  - Todas as de `/loja` usam `runStoreAction` ou `runStoreOwnerAction`; as de `/admin` usam `runAdminAction` ou `requireSuperAdmin`; as de `/entregador` usam `comEntregador`.
  - Os "SEM-GUARD" do script são falsos positivos: `runStoreOwnerAction` não estava no padrão do script, `aceitarPedido` delega a `mudarStatusDoPedido`, e `autenticar`, `conferirSms` e `sair` são fluxos de login. Única exceção real: `sairDoModoLojista` (R3-028).
- **Acoplamento entre apps:** nenhum import do admin a partir do web, nem o contrário. Tudo passa por `packages/*`.
- **Testes unitários:** `packages/services` (4 arquivos, 24 testes) e `packages/shared` (13 arquivos, 166 testes) passam (`pnpm exec vitest run`). Nenhum teste cobre checkout, webhook, troca de status ou concorrência.

## O que foi testado (comandos)

| Teste | Comando | Resultado |
|---|---|---|
| Drift | `npx prisma migrate status` e `npx prisma migrate diff --from-url … --to-schema-datamodel …` (em `packages/database`) | sem drift |
| Migrations aplicadas | `docker exec rapidinho-postgres psql -U rapidinho -d rapidinho -At -c "select migration_name, finished_at is not null … from _prisma_migrations"` | 11 OK |
| Índices de busca e de tabelas | consultas a `pg_indexes` | presentes |
| Unicidade de cupom | `select indexdef from pg_indexes where tablename='coupons'` | `UNIQUE (code,"storeId")` sem `NULLS NOT DISTINCT` |
| Tipos de coluna | `information_schema.columns` | só lat/lon em ponto flutuante |
| FKs | `pg_constraint` | RESTRICT para loja e cidade |
| Planos | `select slug,"monthlyPriceCents","commissionRate" from plans` | `gratis|0|12.00` (R3-006) |
| Lojas com Pix sem chave | `select count(*) filter (…) from stores` | `12|12` (R3-010) |
| Tabelas de funcionalidades fantasma | contagem de `payouts`, `courier_documents`, `store_documents`, `couriers.latitude` | 0 / 0 / 0 / `2|0` |
| Usuários sem senha | `select role,count(*),count(email),count("passwordHash") from users group by role` | ver R3-019 |
| OTP vencidos | contagem de `otp_codes` | 44 / 21 |
| Política do Redis | `docker exec rapidinho-redis redis-cli config get maxmemory-policy` | `allkeys-lru` |
| Filas BullMQ | `redis-cli --scan --pattern 'bull:*'` | sem `reports` |
| Cookie de sessão no site | `curl … -H "Cookie: authjs.session-token=teste123" http://localhost:3200/privacidade` | renovado por 400 dias |
| Cookie de sessão no painel | mesma chamada em `http://localhost:3201/entrar` | não renovado |
| Guards | `node scratchpad/r3/guards.mjs apps/admin/src` e `apps/web/src` | ver acima |
| Enums | `node scratchpad/r3/enums.mjs <repo>` | ver R3-026 |
| Testes unitários | `pnpm exec vitest run` em `packages/services` e `packages/shared` | 24 + 166 passaram |

## O que não foi testado e limitações

- **Corridas não executadas:** não rodei carga concorrente real (R3-004, R3-005, R3-011, R3-020, R3-027). Por isso estão como FORTE INDÍCIO. Criar pedidos locais exigiria escrever no banco pelo app, e mantive o banco só para leitura.
- **Fluxos de ponta a ponta não executados em runtime:** checkout com Pix na chave da loja (R3-001), cartão online (R3-008) e cadastro de loja por cliente existente (R3-009) não foram rodados no navegador. A prova é o caminho de código, determinístico e citado linha a linha. Recomendo que o Auditor-Chefe os inclua no e2e de aceite.
- **Produção:** não verifiquei o `.env` real (SSH negado). Os itens que dependem dele (R3-013, R3-014, R3-016 em produção, R3-019 em produção) estão como HIPÓTESE ou condicionados.
- **Fora do escopo do R3:** não analisei `apps/cliente-android` (Java) além de confirmar que não chama `/api/auth/otp/*`, nem `apps/sms-gateway` além do contrato de servidor (`packages/services/src/sms-gateway.ts`, comparação de token em tempo constante, correta).
- **Outras limitações:** não rodei `typecheck` completo nem e2e. Não fiz `EXPLAIN` sob volume: o banco local tem 0 pedidos e o planejador não seria representativo.

## Parecer final

**Reprovado para operação com pagamento online e para faturamento, até correção das Críticas e Altas.**

A base é boa:
- schema e migrations sem drift;
- dinheiro em centavos e integridade referencial correta;
- guards coerentes em todas as actions;
- baixa de estoque e aceite de corrida atômicos;
- integrações isoladas atrás de interfaces.

O problema está no **dinheiro em trânsito e no ciclo de vida do pedido**. Não há uma máquina de estados única com transição condicional (R3-005); o webhook não é transacional (R3-003); não há reconciliação nem estorno (R3-002, R3-004). Por isso pedidos pagos podem sumir, ser cancelados sem devolução ou ressuscitar.

Três fluxos financeiros prometidos não funcionam:
- Pix na chave da loja (R3-001);
- cartão online (R3-008);
- repasse (R3-010).

E a receita da plataforma escapa:
- a comissão do plano grátis nunca é faturada (R3-006);
- o impulsionamento é ativado sem cobrança (R3-007).

O login novo cumpre a regra do dono, mas deixou duas regressões operacionais: um cliente que vira lojista não consegue entrar (R3-009), e não há como criar funcionário (R3-019). Os fluxos de OTP também ficaram triplicados, e as cópias já divergem (R3-018).

Ordem sugerida de correção:
1. R3-001, R3-003, R3-005 (serviço único de transição) e R3-002/R3-004.
2. R3-006, R3-007, R3-008 (esconder a opção) e R3-009.
3. R3-010 (decisão de modelo), R3-016 e R3-015.
4. O restante.
