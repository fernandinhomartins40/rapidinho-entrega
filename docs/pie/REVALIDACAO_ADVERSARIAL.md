# Revalidação adversarial das correções PIE

Verificador independente, 2026-11-02. Objetivo: tentar REPROVAR as correções
marcadas CORRIGIDO em `ACHADOS_CONSOLIDADOS.md` (commits `4395f01`, `30a21ee`,
`6f3ebdf`, `c5a6c06`, `d2d425e`). Não foi alterado nenhum código de produção,
teste, configuração ou git.

Ambiente: web `http://localhost:3200`, painel `http://localhost:3201`
(ambos de pé, `/api/health` = 200), Postgres `rapidinho-postgres` (porta 5433),
Redis e MinIO em Docker. Scripts de verificação em
`C:\Users\fusea\AppData\Local\Temp\claude\c--FuseDev-rapidinho-entrega\f9c02d86-2f36-47ac-a919-6a836a7d0812\scratchpad\verif\`.
Nenhum SMS real enviado (senders de console, `OTP_PROVIDER=console`,
`SMSDEV_API_KEY=` vazio). User-agent de teste contém ` RapidinhoApp/teste`.

## Veredito geral

Duas correções NÃO se sustentam:

- **M9 (redirecionamento aberto em `/entrar`)** — FALHOU. A guarda nova
  (`!destino.startsWith('//')`) não cobre a barra invertida: `/\example.com`
  passa e o navegador (Edge) sai do domínio para `https://example.com/`.
- **A8 (funcionário vê o financeiro)** — FALHOU (parcial). A página
  `/loja/financeiro` passou a bloquear o funcionário, mas o painel inicial
  `/loja` continua exibindo "Vendas de hoje" e "Comissão da plataforma" para
  `STORE_STAFF`.

As demais correções testadas resistiram.

---

## 1. Força bruta no OTP (A1) — RESISTIU

Arquivo: `packages/auth/src/otp.ts` (verifyOtp, linhas 86-133).

Tentativa: `verif/bf-otp.mts` chama `requestOtp`/`verifyOtp` direto (mesmo código
da action). Variações: 50 palpites errados com o código certo NO MEIO, tudo em
paralelo; duas rodadas seguidas; varredura sequencial de 10 erros antes de tentar
o certo; e reutilização de código já consumido.

Comando:
`DATABASE_URL=... OTP_PROVIDER=console SMSDEV_API_KEY= tsx verif/bf-otp.mts`

Saída:

```
R1-meio {"logins":0,"attempts":5,"consumido":true}
reuso-consumido {"ok":false,"reason":"Código expirado. Peça um novo."}
R2-meio {"logins":0,"attempts":5,"consumido":true}
R3-seq {"errosOk":0,"acertoAposLimite":false,"motivo":"Código expirado. Peça um novo."}
```

A reserva atômica (`updateMany` com `attempts: { lt: maxAttempts }` antes do
compare) sustenta o limite de 5 sob 51 requisições concorrentes: o código é
consumido ao esgotar as tentativas, inclusive quando o palpite certo chega no
meio do lote (0 logins). Código consumido não é reutilizável. Veredito: RESISTIU.

## 2. IP do cliente / X-Forwarded-For (A2) — RESISTIU (app); nginx PENDENTE

Arquivo: `packages/services/src/rate-limit.ts:55` — `clientIpFromHeaders` lê
somente `x-real-ip`; `X-Forwarded-For` é ignorado.

Tentativa: 8 POST em `/api/sms/app/entrar`, cada um com `X-Forwarded-For`
forjado diferente (10.0.0.1..8), sem `x-real-ip` (chave = `desconhecido`).

Saída:

```
XFF=10.0.0.1 -> 401  XFF=10.0.0.2 -> 401  XFF=10.0.0.3 -> 429 ... XFF=10.0.0.8 -> 429
```

O limite é compartilhado mesmo variando o XFF (o 429 chega cedo porque chamadas
anteriores de teste já consumiram parte do orçamento da mesma chave). Se o XFF
mudasse a chave, nunca haveria 429. Veredito: RESISTIU no app.

Ressalva: o endurecimento do nginx (`real_ip_header X-Real-IP`, realip só de
redes privadas, `NGINX_BIND`) só é verificável em produção/infra, fora deste
ambiente. Continua, como já consta, dependente de confirmação em produção.

## 3. "Pix para conferir" (A3) — RESISTIU

Arquivo: `apps/admin/src/app/loja/pedidos/actions.ts:530` (confirmarPixDaLoja).

Tentativa: `verif/pix-a3.mts` cria pedidos sintéticos e reproduz o `findFirst`
exato da action com `access.storeId` = loja A, além da confirmação dupla em
paralelo.

Saída:

```
offlineA(legit)    achavel = true   (esperado true)
gatewayA           achavel = false  (esperado false)  <- provider MERCADOPAGO
canceladoA         achavel = false  (esperado false)  <- status CANCELLED
offlineB(outraloja) achavel = false (esperado false)  <- outra loja
dupla confirmacao vencedores = 1    (esperado 1)
```

Confirmar Pix de outra loja, de gateway (provider != OFFLINE) ou de pedido
cancelado não encontra o pedido; dois cliques simultâneos confirmam uma só vez
(`updateMany` condicionado a `status: 'PENDING_PAYMENT'`). Veredito: RESISTIU.

## 4. Webhook de pagamento (A4/A5) — RESISTIU

Arquivo: `apps/web/src/app/api/webhooks/pagamento/route.ts`.

Tentativa: `verif/webhook-a4.mts` reproduz fielmente o bloco `try` +
`$transaction` (evento gravado primeiro; só `P2002` vira "duplicate"; pedido
liberado só se `PENDING_PAYMENT`).

Saída:

```
caso1 primeiro = liberado | orderStatus = RECEIVED | reenvio = duplicate
caso2 resultado = nao-liberado | orderStatus = CANCELLED | paymentStatus = PAID
caso3 concorrente = [liberado, nao-liberado] | liberados = 1 (esperado 1)
```

- Reenvio do mesmo evento (mesmo `dedupeKey`) cai em `P2002` → "duplicate", sem
  reprocessar; qualquer outra exceção derruba a transação inteira (o evento não
  fica gravado, então a confirmação não se perde).
- Pedido já cancelado pela expiração do Pix NÃO ressuscita (fica `CANCELLED`).
- Dois eventos PAID concorrentes liberam o pedido uma única vez.

Veredito: RESISTIU. Observação lateral: no caso 2 o `payment` fica `PAID` sobre
um pedido `CANCELLED` — é exatamente a lacuna de estorno já registrada em A21/M24
(PENDENTE), não um defeito do webhook.

## 5. Status condicional (mudarStatus/cancelar/avancarCorrida/aceitarCorrida) — RESISTIU

Arquivos: `apps/admin/src/app/loja/pedidos/actions.ts`,
`apps/admin/src/app/entregador/actions.ts`,
`packages/shared/src/domain/order-status.ts`.

Tentativa: `verif/cancel-status.mts` e leitura da tabela de transições.

Saída:

```
canTransition CANCELLED->DELIVERED = false (esperado false)
canTransition REJECTED->DELIVERED  = false (esperado false)
```

Marcar "entregue" um pedido cancelado é barrado por `canTransition` (tabela
`DELIVERED: []`, `CANCELLED: []`) e, no entregador, por
`order.update where status notIn [CANCELLED, REJECTED, DELIVERED]` (P2025 →
rollback). `aceitarCorrida` filtra por `cityId`/`storeId` do entregador: corrida
de outra cidade/loja não é encontrada. Veredito: RESISTIU.

## 6. Financeiro bloqueado para funcionário (A8) — FALHOU (parcial)

Correção verificada: `apps/admin/src/app/loja/financeiro/page.tsx:101` bloqueia
quem não é `OWNER`/admin — em runtime, `STORE_STAFF`/MANAGER recebe a mensagem
"Só o dono da loja vê o financeiro". Isso RESISTIU.

Porém, o MESMO tipo de número vaza por outra página. O painel inicial
`apps/admin/src/app/loja/page.tsx` (função `LojaDashboardPage`, linha ~85) NÃO
tem gate de cargo e exibe os indicadores "Vendas de hoje" (`totalCents`) e
"Comissão da plataforma" (`commissionCents`), calculados em `carregarResumo`
(linhas ~40-82) e renderizados nas linhas ~144-168.

Reprodução (sessão sintética de `gerente.r2@e2e.rapidinho.test`, STORE_STAFF /
MANAGER, vinculado à loja `cmvvwqbqm001acbpwu3i29w5l`):

```
GET /loja           -> 200; HTML contém: "Vendas de hoje", "Comissão da plataforma", "Ticket médio"
GET /loja/financeiro -> HTML contém: "Só o dono da loja vê o financeiro"
```

O próprio comentário do código em `financeiro/page.tsx` declara a intenção: "O
funcionário opera pedidos e cardápio, mas não vê quanto a loja fatura." O
dashboard contradiz isso. A varredura `mapa-de-acoes.mjs` não pega essa brecha
porque mapeia server actions, não componentes de página — por isso passou.

Veredito: A8 volta a ABERTO (parcial). Arquivo:linha:
`apps/admin/src/app/loja/page.tsx:85` (sem gate) e `:144-168` (indicadores
financeiros), apoiados em `:40-82` (`carregarResumo` somando `totalCents` e
`commissionCents`).

## 7. Token do gateway de SMS só para SUPER_ADMIN (A9) — RESISTIU

Arquivo: `apps/web/src/app/api/sms/app/entrar/route.ts:44`.

Tentativa: POST com credenciais de lojista, de super admin e senha errada.

Saída:

```
lojista    => 401
superadmin => 401 {"error":"E-mail ou senha incorretos."}
senhaerr   => 401
```

Lojista (STORE_OWNER) com senha correta NÃO recebe token (401). O gating por
`role: 'SUPER_ADMIN'` está presente. No ambiente local o super admin também
recebe 401 porque `SMS_GATEWAY_TOKEN` não está configurado (token nulo), o que
não permite distinguir o caminho de sucesso aqui — mas a propriedade de
segurança (não-super-admin nunca recebe token) está garantida. Veredito:
RESISTIU.

## 8. Redirecionamento aberto em `/entrar` (M9) — FALHOU

Arquivos:

- `apps/web/src/app/entrar/page.tsx:29`
- `apps/web/src/app/entrar/actions.ts:173` e `:193`
- `apps/admin/src/app/entrar/actions.ts:203`, `:245`, `:263` (mesmo padrão)

A guarda aplicada é
`destino.startsWith('/') && !destino.startsWith('//') ? destino : '/'`.

Tentativa: com sessão sintética, variar `destino`. Resposta do servidor
(`http://localhost:3200/entrar?destino=...`, sem seguir redirect):

```
/painel              -> 307 location: /painel
/pedidos             -> 307 location: /pedidos
//example.com        -> 307 location: /          (bloqueado - foi o que o corretor testou)
https://example.com  -> 307 location: /          (bloqueado)
/\example.com        -> 307 location: /\example.com   (PASSOU)
```

A barra invertida fura: `/\example.com` começa com `/` e não com `//`, então a
guarda deixa passar. O navegador normaliza `\` para `/` e trata `/\example.com`
como URL protocol-relative. Prova em runtime no Edge (`verif/redirect-edge.cjs`,
Playwright channel msedge, com a sessão no cookie e navegações externas
bloqueadas para registro):

```
{"urlFinal":"https://example.com/","navegacoesExternas":["https://example.com/s.js"]}
```

Ou seja: o usuário logado que abre
`https://(dominio-legitimo)/entrar?destino=/%5Cexample.com` é levado para
`https://example.com`. É open redirect clássico; a revalidação do corretor só
cobriu `//`, não `/\`. O mesmo padrão está no login por senha do painel
(`admin/entrar/actions.ts`) e no caminho de SMS (`web/entrar/actions.ts:193`,
`conferirSms`).

Veredito: M9 volta a ABERTO. Reprodução acima. (Correção adequada exigiria
rejeitar também `\` logo após a primeira `/`, ou validar com `URL` resolvido
contra a origem — não implementado aqui.)

## 9. `cancelarMeuPedido` (M19 / A21-parcial) — RESISTIU

Arquivo: `apps/web/src/app/pedidos/actions.ts:355`.

Tentativa: `verif/cancel-status.mts` reproduz o predicado (findFirst por
`userId`, bloqueio se `payment.status === 'PAID'`, `updateMany` só em
`['PENDING_PAYMENT','RECEIVED']`).

Saída:

```
outro cliente cancela RECEIVED = nao-encontrado   (esperado)
dono cancela ACCEPTED          = bloqueado-status  (esperado)
dono cancela PAGO              = bloqueado-pago     (esperado)
```

Cancelar pedido de outro cliente não encontra; pedido ACCEPTED não é cancelado
(fica com a loja); pedido pago é barrado com orientação para falar com a loja.
Veredito: RESISTIU.

## 10. `GET /api/conta/exportar` (M3) — RESISTIU

Arquivo: `apps/web/src/app/api/conta/exportar/route.ts`.

Tentativa: sem sessão e com sessão sintética.

```
sem sessao => 401
com sessao => 200  (devolve só os dados do titular da sessão)
```

O endpoint não aceita parâmetro de usuário: usa `getCurrentUser().id` e
`reunirDadosDoTitular(user.id)`. Não há caminho para pedir dados de outro
titular. Veredito: RESISTIU.

## 11. Regressões gerais

### Suítes (vs. baseline `docs/revisao/evidencias/fase0/`)

Comando: `pnpm typecheck && pnpm lint && pnpm test`
(log em `verif/suites.log`).

| Suíte     | Baseline fase0                      | Agora                                                    | Resultado            |
| --------- | ----------------------------------- | -------------------------------------------------------- | -------------------- |
| typecheck | 9/9 tasks OK                        | 9/9 tasks OK, exit 0                                     | igual (passa)        |
| lint      | 9/9 tasks OK                        | 9/9 tasks OK, exit 0                                     | igual (passa)        |
| test      | tasks OK (sem contagem no baseline) | 5/5 tasks, 192 testes (shared 168 + services 24), exit 0 | igual/melhor (verde) |
| test:e2e  | 14 passed, depois exit 1 (frágil)   | NÃO reexecutado                                          | —                    |

Nada regrediu nas suítes. `pnpm test:e2e` não foi reexecutado: o baseline já
termina em exit 1 (fragilidade conhecida M30, PENDENTE) e o item 11 do escopo
pedia typecheck/lint/test.

### Varreduras de auditoria

- `node scripts/auditoria/mapa-de-acoes.mjs --suspeitas`: 116 funções mapeadas,
  26 na fila (`!!`). As marcações `sem-escopo` em `avancarCorrida`,
  `pausarProdutosDoPedido`, `aceitarCorrida` etc. são heurísticas — a leitura
  confirma que as queries SÃO escopadas (join por loja/entregador ou filtro
  prévio). Nenhuma guarda removida pelos diffs. Importante: a ferramenta mapeia
  server actions, não páginas — por isso não aponta o vazamento financeiro do
  dashboard (item 6).
- `node scripts/auditoria/fantasmas.mjs`: 46 pontos (enums e actions sem
  referência), todos pré-existentes e já cobertos por achados BAIXOS
  (R3-025/R3-026). Nenhuma novidade introduzida pelas correções.

### Telas (inspeção)

Não foram percorridas todas as telas em navegador nesta rodada (o foco
adversarial priorizou os vetores de segurança 1-10). As verificadas em runtime:
`/entrar` com sessão (redirect — FALHOU), painel `/loja` e `/loja/financeiro`
(A8 — FALHOU parcial). As demais (produto com complemento, checkout, cadastro de
loja com erro, iPhone, `/cadastro` do painel) ficam NÃO TESTADAS nesta
revalidação — permanecem apoiadas nas provas do Auditor-Chefe.

---

## Resumo item → veredito

1. Força bruta OTP (A1) — RESISTIU
2. IP/X-Forwarded-For (A2) — RESISTIU (app); nginx PENDENTE (produção)
3. Pix para conferir (A3) — RESISTIU
4. Webhook de pagamento (A4/A5) — RESISTIU
5. Status condicional (A5/M6) — RESISTIU
6. Financeiro para funcionário (A8) — **FALHOU (parcial)**: dashboard `/loja`
   expõe "Vendas de hoje" e "Comissão da plataforma" a STORE_STAFF
7. Token do gateway de SMS (A9) — RESISTIU
8. Redirecionamento aberto `/entrar` (M9) — **FALHOU**: `/\example.com` leva a
   `https://example.com`
9. `cancelarMeuPedido` (M19) — RESISTIU
10. `GET /api/conta/exportar` (M3) — RESISTIU
11. Regressões/suítes — sem regressão (typecheck/lint/test verdes, 192 testes);
    e2e não reexecutado

Contagem: 2 reabertos (A8 parcial, M9), 9 confirmados como resistentes entre os
testados. As correções NÃO se sustentam integralmente: M9 e A8 precisam de nova
rodada.

## Dados sintéticos criados (e removidos ao fim)

Todos no banco local `rapidinho` (container `rapidinho-postgres`):

- Usuário `+5541990009999` + códigos OTP (bf-otp) — criado e apagado pelo script.
- Usuário `+5541990008888` ("Verif Redirect") + 1 sessão — criado para o teste
  de redirect; REMOVIDO ao fim.
- 1 sessão sintética para `gerente.r2@e2e.rapidinho.test` (usuário do seed, não
  alterado) — REMOVIDA ao fim.
- Pedidos/pagamentos com `customerName` VERIFA3/VERIFA4/VC e usuário
  `VERIF-outro-cli` — criados e apagados pelos scripts.

Limpeza final confirmada:
`{"sessaoGerente":1,"userVerifRedirect":1,"ordersResiduais":0}`.

---

## Adendo do Auditor-Chefe: correção dos dois reabertos (commit `aef53aa`)

| Reaberto                                         | Correção                                                                                                                                                                                                        | Revalidação em runtime (2026-11-02)                                                                                                                                                                                                |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M9: redirecionamento aberto com `\`              | `destinoInterno()` em `packages/shared/src/utils/destino.ts`, usada nos 6 pontos (site: página e actions; painel: actions). Recusa `\`, caracteres de controle e qualquer destino que resolva para outra origem | Com sessão: `%2F%5Cexample.com`, `%2F%5C%2Fexample.com`, `%5C%5Cexample.com`, `%2F%5C%5Cexample.com` e `%2F%09%2Fexample.com` → `307 /`. `%2Fpedidos` → `307 /pedidos`. Teste unitário com 13 formas de ataque (`destino.test.ts`) |
| A8: valores no painel inicial para o funcionário | `apps/admin/src/app/loja/page.tsx`: "Vendas de hoje", "Ticket médio", "Comissão da plataforma" e o valor por produto só para o dono ou o admin da plataforma                                                    | Sessão sintética de funcionário: `/loja` → "Vendas de hoje" 0 ocorrências, "Comissão" 0, "Pedidos hoje" 1; `/loja/financeiro` → "Só o dono da loja vê o financeiro"                                                                |
