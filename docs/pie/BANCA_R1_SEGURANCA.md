# BANCA R1 — Segurança, LGPD e proteção de receita

Revisor: R1 (Red Team). Commit auditado: `d65c0e5` (main). Data: 2026-11-01.
Ambiente: local autorizado — web `http://localhost:3200`, painel `http://localhost:3201`,
Postgres `rapidinho-postgres`, Redis `rapidinho-redis`, storage `rapidinho-s3-revisao`.
`NODE_ENV=development`, `OTP_PROVIDER=sms`, `PAYMENT_PROVIDER=fake`, `WHATSAPP_PROVIDER=fake`.

Nenhum SMS/WhatsApp real foi enviado (provedores `fake`/sem chave). Nenhuma prova
foi executada contra produção. Scripts e saídas em
`...\scratchpad\r1`. Nenhum segredo do `.env` é reproduzido aqui.

---

## Resumo dos achados

| ID | Sev. | Estado | Área | Título |
| --- | --- | --- | --- | --- |
| R1-001 | Crítica (S1) | CONFIRMADO | Auth | OTP de login é força-bruta-vel: cap de tentativas por código não é atômico e o limite por IP é burlável |
| R1-002 | Alta (S1) | CONFIRMADO | Auth/Infra | `X-Forwarded-For` é confiável no servidor: todo limite por IP (OTP e senha) é burlável, com abuso de custo de SMS |
| R1-003 | Alta (S2) | CONFIRMADO | Permissão | Funcionário da loja (STORE_STAFF/OPERATOR) acessa `/loja/financeiro` (reconfirma R3-005) |
| R1-004 | Média (S2) | FORTE INDÍCIO | LGPD | Exclusão de conta não apaga `order.addressSnapshot`: endereço do titular persiste |
| R1-005 | Média (S2) | CONFIRMADO | LGPD | Aceite de termos do cliente nunca é gravado; `ConsentRecord` vazio (reconfirma R3-001) |
| R1-006 | Baixa (S3) | CONFIRMADO | LGPD | Exportação de dados não registra `DataRequest`; nenhuma tela lê `DataRequest` (reconfirma R3-001b) |
| R1-007 | Média (S2) | FORTE INDÍCIO | LGPD | Loja grava aceite de termos em nome do entregador convidado (reconfirma R3-007) |
| R1-008 | Baixa (S3) | CONFIRMADO | Admin/UX | Super admin entra no "modo lojista" sem caminho de saída na UI (reconfirma R3-002) |

Controles que passaram nos testes (detalhe na seção "Verificado e sem achado").

---

## R1-001 — OTP de login é força-bruta-vel

- **Categoria:** Autenticação / força bruta (ASVS 2.2.1, OWASP A07).
- **Severidade:** Crítica (S1). O login primário de cliente e entregador é por
  telefone + código de 6 dígitos; quebrar o código é tomar a conta — com
  endereços, telefone, histórico de pedidos e capacidade de pedir.
- **Estado:** CONFIRMADO em runtime.
- **Onde:** `packages/auth/src/otp.ts:93-135` (`verifyOtp`),
  `apps/web/src/app/api/auth/otp/verify/route.ts:23-34`,
  `packages/services/src/rate-limit.ts:18-42`.

### Raiz

São duas falhas que se somam:

1. **Cap de tentativas por código não é atômico.** `verifyOtp` lê o registro
   (`findFirst`), compara `record.attempts >= maxAttempts` e só então
   incrementa. Sob requisições concorrentes, todas leem o mesmo `attempts`
   antigo e passam pela checagem — o teto de 5 nunca dispara.
2. **O limite por IP é a única barreira de volume, e é burlável** (ver R1-002):
   a chave é `otp:verify:${phone}:${ip}` e `ip` vem de `X-Forwarded-For`,
   controlado pelo cliente.

### Reprodução segura (local)

```
# solicita um código (dev expõe o código na resposta)
POST /entrar  (server action autenticar, UA "RapidinhoApp/")  -> devCode=396688
# rajada: 30 palpites errados, cada um com um XFF forjado distinto, + o código certo
for i in 1..30: POST /api/auth/otp/verify  XFF 88.1.0.$i  code=111111
POST /api/auth/otp/verify  XFF 88.1.0.200  code=396688
```

### Esperado × Observado

- Esperado: após 5 tentativas o código é invalidado; o atacante não consegue
  mais que 5 palpites por código.
- Observado: as 30 tentativas erradas foram aceitas como "Código incorreto"
  (nenhum 429, nenhum consumo). O palpite certo retornou
  `{"ok":true,"isNewUser":true}` e **criou sessão** (`authjs.session-token` no
  cookie). No banco: `attempts = 30`, código consumido só no sucesso.
- Prova complementar (sequencial, IP fixo): o teto de 5 funciona — 6ª tentativa
  dá 429 e `attempts` para em 5. Ou seja, a proteção existe e só cai sob
  concorrência + rotação de IP.

### Impacto

O teto de 5/1.000.000 que torna a força bruta inviável é anulado. Com
concorrência e XFF rotativo, o número de palpites por código fica limitado só
pela banda; somado ao reenvio de códigos (3/telefone/15 min, cada um válido
300 s), a tomada de conta direcionada de um telefone-alvo passa a ser viável.

### Correção proposta

- Tornar o incremento/consumo atômico: `updateMany` condicionado
  (`where: { id, attempts: { lt: maxAttempts }, consumedAt: null }`,
  `data: { attempts: { increment: 1 } }`) e tratar `count === 0` como
  "esgotado/consumir". Ou `SELECT ... FOR UPDATE` dentro de transação.
- Rate limit de verificação também por telefone isolado (`otp:verify:phone:*`),
  independente do IP, além de corrigir a origem do IP (R1-002).

### Teste de aceite

`e2e/tests/seguranca-otp-bruteforce.spec.ts`: disparar N palpites concorrentes
contra um código; esperar no máximo `OTP_MAX_ATTEMPTS` aceitos e o código
consumido; o palpite certo após o esgotamento deve falhar.

---

## R1-002 — `X-Forwarded-For` é confiável: limites por IP são burláveis

- **Categoria:** Controle de acesso / rate limiting (OWASP "Identification and
  Authentication Failures"; OWASP Next.js — confiar em cabeçalho de proxy).
- **Severidade:** Alta (S1) por ser o multiplicador do R1-001 e por abuso de
  custo de SMS.
- **Estado:** CONFIRMADO em runtime.
- **Onde:** `packages/services/src/rate-limit.ts:50-57` (`clientIpFromHeaders`
  usa `forwarded.split(',')[0]`), `docker/nginx/nginx.conf.template:76`
  (`X-Forwarded-For $proxy_add_x_forwarded_for` — **append**, não **set**).

### Raiz

O Nginx faz append do IP real ao XFF enviado pelo cliente; a aplicação lê o
**primeiro** elemento, que é exatamente o valor que o cliente mandou. Logo
qualquer um escolhe o "IP" que o rate limiter vê.

### Reprodução e evidência

- `/api/auth/otp/request`, 15 telefones distintos **sem** XFF (mesmo IP real):
  após ~4 começam os `429` (limite por IP = 3×3).
- Os mesmos 15 telefones **com XFF rotativo** (`10.9.8.30..44`): **todos 200**,
  nenhum 429. Confirmado no banco: `otp_codes.requestIp` grava o XFF forjado
  (`10.9.8.40`, etc.).

### Impacto

- Com `OTP_PROVIDER=sms` (SMSDev, pago — é o que `preparar-env.sh` ativa quando
  há `SMSDEV_API_KEY`), o limite por IP era a defesa contra varrer muitos
  telefones de uma mesma origem. Burlado, um host dispara SMS para toda uma
  lista de números (cada um só limitado a 3/15 min), gerando custo real.
- É o que viabiliza o volume do R1-001.
- O limite por **e-mail** e por **telefone** continua válido (chaves não usam
  IP), então a força bruta de senha do painel por e-mail segue contida.

### Correção proposta

Derivar o IP de forma confiável: Nginx deve **set** `X-Forwarded-For
$remote_addr` (ou usar `X-Real-IP`, que já é setado, como fonte única) e a app
deve ler o **último** hop confiável, não o primeiro. Documentar o número de
proxies à frente. Alternativamente, `X-Real-IP` em `clientIpFromHeaders`.

### Teste de aceite

Unitário em `packages/services`: `clientIpFromHeaders` com XFF
`"1.2.3.4, <real>"` deve devolver o hop confiável, não `1.2.3.4`.

---

## R1-003 — Funcionário da loja vê o financeiro (reconfirma R3-005)

- **Categoria:** Autorização / quebra de função (BOLA/BFLA, OWASP A01).
- **Severidade:** Alta (S2) — confidencialidade de faturamento/comissão dentro
  do tenant; `guards.ts` documenta financeiro como ação só do dono.
- **Estado:** CONFIRMADO em runtime.
- **Onde:** `apps/admin/src/app/loja/financeiro/page.tsx` usa `getStoreContext()`
  (qualquer membro ativo) sem `requireStoreOwner`/checagem de `staffRole`;
  `apps/admin/src/app/loja/layout.tsx` libera qualquer vínculo.

### Reprodução e evidência

Criei uma sessão sintética (ver "Dados de teste") para o **Operador do e2e**
(`STORE_STAFF`/`OPERATOR`, telefone +55 44 99800-0003, vínculo na loja do
lojista do e2e). `GET /loja/financeiro` com esse cookie: **HTTP 200**,
`109.749` bytes, a página renderiza "Financeiro", "Comissão", "Repasses" e os
indicadores em R$ — conteúdo de dono exibido ao operador.

### Esperado × Observado

- Esperado: operador recusado (redirect ou 403), como nas ações de dono
  (`salvarPagamentos`, `convidarEntregador` usam `runStoreOwnerAction`).
- Observado: página de financeiro entregue ao operador.

### Correção proposta

A página (server component) deve chamar `requireStoreOwner()` antes de carregar
os dados; o item de menu já segue o papel, mas a rota é o que vale.

### Teste de aceite

`e2e/tests/seguranca-financeiro-operador.spec.ts` (marcar `test.fail()` até a
correção): operador logado → `/loja/financeiro` deve redirecionar/403.

---

## R1-004 — Exclusão de conta não apaga o endereço no snapshot do pedido

- **Categoria:** LGPD (art. 18, VI — eliminação) / minimização.
- **Severidade:** Média (S2).
- **Estado:** FORTE INDÍCIO (leitura de código + semântica do Prisma).
- **Onde:** `apps/web/src/app/conta/dados/actions.ts:126-129`.

### Raiz

Na exclusão, `order.updateMany` anonimiza `customerName` e `customerPhone`, mas
passa `addressSnapshot: undefined`. No Prisma, `undefined` em `update` significa
"não altere este campo" — o JSON com rua, número, bairro, CEP e ponto de
referência do titular **permanece** no pedido. O comentário do código indica a
intenção de limpar ("também saem"), mas o efeito é no-op.

### Esperado × Observado

- Esperado: após a exclusão, nenhum endereço identificável do titular
  permanece.
- Observado (por código): `addressSnapshot` intacto. Não reproduzido com dado
  real em runtime porque o seed local não tinha pedido com `addressSnapshot`
  não nulo (0 linhas); não criei pedido-fantasma identificável para não sujar o
  banco. A semântica de `undefined` no Prisma é bem estabelecida.

### Correção proposta

Usar `addressSnapshot: Prisma.JsonNull` (ou `null`) no `updateMany`. Teste
unitário confirmando que o campo fica nulo após a ação.

---

## R1-005 — Aceite de termos do cliente nunca é gravado (reconfirma R3-001)

- **Categoria:** LGPD (art. 8º, §2º — prova do consentimento/ciência).
- **Severidade:** Média (S2). Não declaro conformidade jurídica; é uma lacuna
  de prova de aceite.
- **Estado:** CONFIRMADO em runtime.
- **Onde:** `apps/web/src/app/api/auth/otp/verify/route.ts` cria o usuário sem
  aceite; `apps/web/src/app/checkout/actions.ts` não grava `acceptedTermsAt`
  nem `ConsentRecord`.

### Evidência

Consulta ao banco local: `users` com `role=CUSTOMER` → 7 no total, **1** com
`acceptedTermsAt` preenchido (e esse 1 é a conta que também é lojista do e2e,
preenchida no cadastro de loja). `consent_records` → **0 linhas**.

### Correção proposta

Gravar aceite (data, versão dos termos, IP) no ponto em que o cliente vê o
aviso (checkout/cadastro), de preferência em `ConsentRecord`, e preencher
`User.accepted*`. Fixar a versão vigente dos termos em `packages/shared`.

---

## R1-006 — Exportação de dados sem `DataRequest` (reconfirma R3-001b)

- **Categoria:** LGPD (rastreabilidade do atendimento ao titular).
- **Severidade:** Baixa (S3).
- **Estado:** CONFIRMADO (código).
- **Onde:** `apps/web/src/app/conta/dados/actions.ts:25-74` (`exportarMeusDados`
  não cria `DataRequest`; `DataRequestType.EXPORT` nunca é usado). A exclusão
  cria `DataRequest(DELETION, COMPLETED)`, mas nenhuma tela lê a tabela.

### Correção proposta

Registrar também a exportação como `DataRequest`; expor uma tela em `/admin`
para listar/auditar pedidos do titular.

---

## R1-007 — Aceite de termos gravado por terceiro (reconfirma R3-007)

- **Categoria:** LGPD (art. 8º — aceite tem de ser do titular).
- **Severidade:** Média (S2).
- **Estado:** FORTE INDÍCIO (leitura de código).
- **Onde:** `apps/admin/src/app/loja/entregadores/actions.ts` (`convidarEntregador`)
  cria o usuário do entregador com `acceptedTermsAt`/`acceptedPrivacyAt = agora`.
- **Correção proposta:** deixar nulo e exigir o aceite no primeiro acesso do
  entregador.

---

## R1-008 — "Modo lojista" sem saída na UI (reconfirma R3-002)

- **Categoria:** Admin / impersonation (higiene de sessão privilegiada).
- **Severidade:** Baixa (S3) — a autorização em si é sólida (ver abaixo); o
  problema é não haver botão para encerrar.
- **Estado:** CONFIRMADO (código).
- **Onde:** `apps/admin/src/app/admin/lojas/actions.ts:204` `sairDoModoLojista`
  existe mas nenhuma tela a chama; nenhuma tela de `/loja` sinaliza
  impersonation. O `ImpersonationLog` nunca recebe `endedAt` pela UI.
- **Nota positiva:** `resolveImpersonation` (`guards.ts:62-92`) valida o cookie
  contra o `ImpersonationLog` no banco a cada request (cookie forjado não
  basta), expira em 1 h e recusa impersonar outro `SUPER_ADMIN`. A falha é só
  de UX/encerramento.

---

## Verificado e sem achado (controles que passaram)

Testado em runtime, resultado correto:

- **Webhook de pagamento** (`/api/webhooks/pagamento`): sem assinatura → `401`
  ("Assinatura inválida"). Com `PAYMENT_PROVIDER=fake`, `parseWebhook` sempre
  recusa. Código do Mercado Pago (`packages/services/src/payments/mercadopago.ts`):
  confere HMAC em tempo constante, exige `webhookSecret`, deduplica por
  `PaymentEvent.dedupeKey` (chave única → repetição vira `{duplicate:true}`),
  revalida o estado na API do provedor. Idempotência e replay tratados.
- **`/api/sms/recebido` e `/api/sms/sinal`**: sem token → `401`
  (`gatewayAutorizado` compara o Bearer em tempo constante).
- **`/api/uploads`**: sem sessão → `401` (`requireUser`). Contexto validado por
  enum; `MAX_UPLOAD_BYTES`; imagem decodificada por `sharp`
  (`processAndStoreImage`) — SVG/HTML disfarçado falha a decodificação
  (`InvalidImageError`). (SVG malicioso não testado em runtime por falta de
  sessão de upload no tempo da revisão — HIPÓTESE de que o pipeline sharp
  rejeita; o vetor de execução estaria na origem do MinIO servida pelo Nginx,
  que usa `Cache-Control` mas **não** força `Content-Disposition`/CSP próprio —
  ver "Pendências".)
- **Login "só no app"**: `/api/auth/otp/request` sem UA `RapidinhoApp/` → `403`;
  com UA forjado → `200`. Confirmado que a regra é só anti-custo (UA é
  falsificável), como o escopo previu — sem impacto de segurança além de custo
  de SMS, já coberto por R1-002.
- **Isolamento multi-tenant nas server actions da loja**: `store-action.ts`
  nunca lê `storeId` do formulário; `requireStoreAccess` confere o vínculo em
  `StoreStaff`. Ações como `reordenarCategorias`, `pausarProdutosDoPedido`,
  `mudarStatusDoPedido` refiltram os ids por `storeId` do vínculo. As linhas
  `!!` do `mapa-de-acoes.mjs` foram triadas: são falsos positivos (o id já vem
  de query escopada ou é refiltrado). Nenhum IDOR cross-tenant encontrado.
- **Pedidos do cliente**: `/pedidos/[id]`, avaliar, `pedirNovamente`,
  `responderTroca` filtram por `userId: user.id`. Sem IDOR entre clientes.
- **Corridas do entregador**: `aceitarCorrida` usa `updateMany` condicionado a
  `courierId: null` (corrida de concorrência tratada: dois entregadores, só o
  primeiro leva); `avancarCorrida` filtra por `courierId` do logado.
- **Cupom**: redenção criada dentro da transação do pedido com
  `coupon.usageCount++`; `CouponRedemption.orderId` é único; `applyCoupon`
  valida escopo (STORE só na própria loja), cidade, validade, limites global e
  por usuário, pedido mínimo e primeiro-pedido. Desconto limitado ao subtotal
  (sem valor negativo/estouro). Cupom de outra loja é recusado por escopo.
- **Checkout**: todo preço, frete e desconto são recalculados no servidor
  (`lib/checkout.ts`) a partir do catálogo; nenhum valor do cliente entra no
  banco. Loja fechada/inativa, forma de pagamento não aceita, estoque
  (updateMany condicionado — corrida de última unidade tratada) e maioridade
  são checados no servidor.
- **Escalada de privilégio no painel**: `alterarPapel`/`alternarBloqueio`
  impedem auto-alvo, exigem SUPER_ADMIN para elevar a ADMIN/SUPER_ADMIN e
  revogam sessões; `gerarSenhaProvisoria` é só SUPER_ADMIN, só para papéis com
  senha, e **revoga todas as sessões** do alvo (`revokeAllSessions`). Troca de
  senha confere a senha atual com rate limit.
- **Open redirect**: `destino` nos logins e no `conferirSms` só aceita caminho
  interno (`startsWith('/') && !startsWith('//')`).
- **Login por senha**: hash de enchimento em `autenticarPorSenha` evita
  enumeração por tempo; resposta genérica; só papéis com senha; limite por IP e
  por e-mail.
- **Sessão / senha provisória**: gerar provisória revoga sessões (atende a
  exigência de revogação).
- **Headers/CSP**: `next.config.mjs` com `poweredByHeader:false`, `nosniff`,
  `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`; CSP por
  nonce no middleware com `strict-dynamic`, `object-src 'none'`,
  `frame-ancestors 'none'`, `base-uri 'self'` (`'unsafe-inline'`/`https:` no
  script-src são a escada de compatibilidade do strict-dynamic, neutralizados
  em navegador moderno). Nginx: `server_tokens off`, HSTS no bloco HTTPS.
- **Realtime**: canal exige token assinado (`verifyChannelToken`) com o
  `AUTH_SECRET`; sem token válido para o canal específico não entra na sala.
- **Sentry**: `beforeSend` remove `email`, `phone`, `ip_address`;
  `sendDefaultPii:false`. Logs do gateway não gravam corpo do SMS.
- **Webhook sem pagamento conhecido**: responde `200 ignored` sem vazar.

---

## O que não foi testado / limitações / pendências

- **VPS / produção**: SSH negado nesta sessão; só leitura de config. Em
  produção, `preparar-env.sh` força `NODE_ENV=production` e recusa
  `OTP_PROVIDER=console`; `exposeCode` do OTP só vale em development — então o
  `devCode` não vaza em produção. Não verificável em runtime de produção aqui.
- **SVG/HTML disfarçado no upload**: não executado em runtime (sem sessão de
  upload montada no tempo). Pendência: o `location /uploads/` do Nginx serve o
  objeto do MinIO com `Cache-Control` mas **sem** `Content-Disposition:
  attachment` nem `X-Content-Type-Options` nesse bloco; se um asset com
  `Content-Type` perigoso chegar ao bucket, seria servido inline. Recomendo o
  corretor confirmar o pipeline `sharp` + headers do bloco `/uploads/`.
- **SSRF na importação de produtos**: `importarPlanilha` lê planilha enviada,
  não URL remota (sem fetch de URL do usuário encontrado). Sem vetor SSRF
  aparente; não aprofundado em runtime.
- **App Android (WebView, intents, deep link)**: fora do runtime local; o deep
  link `rapidinhosms://configurar?...&token=` carrega o token do gateway —
  revisar no app se o scheme é restrito ao app certo (não auditável aqui).
- **R1-004**: confirmado por código/semântica do Prisma, não por pedido real
  com snapshot (evitei criar dado pessoal identificável no banco).
- **Carga/concorrência**: a prova do R1-001 usou 30 requisições paralelas;
  não executei volume maior para não estressar o ambiente compartilhado.

---

## Dados de teste criados (ambiente local)

- `otp_codes`: vários registros para telefones sintéticos
  `+5541990000010..0044`, `+554199000301..0312`, `+5541990000401..0403`
  (solicitações de OTP de teste). **Removidos** ao final
  (`DELETE 39` + limpeza adicional; consulta pós-limpeza: 0 linhas).
- `users`: 1 usuário cliente sintético criado pela prova de força bruta,
  `+5541990000403`. **Removido** (com suas sessões).
- `sessions`: 1 sessão sintética para o Operador do e2e (prefixo `r1s`/token
  `r1test…`), usada no R1-003. **Removida**.
- Chaves `ratelimit:*` no Redis (expiram sozinhas por TTL; não removidas).

Verificação final: `users like '+5541990%'` = 0, `sessions like 'r1s%'` = 0,
`otp_codes like '+554199000%'` = 0.

---

## Parecer

**REPROVAR** na dimensão de segurança até a correção de **R1-001** e **R1-002**.

Justificativa: o login primário de clientes e entregadores (telefone + código
de 6 dígitos) tem o teto de tentativas anulável por concorrência (R1-001) e o
único limite de volume (por IP) é burlável porque o servidor confia no
`X-Forwarded-For` do cliente (R1-002). Juntas, as duas transformam a força
bruta do OTP — que o desenho pretendia tornar inviável — em um ataque de tomada
de conta direcionado viável, com PII e capacidade de compra atrás. R1-002 ainda
abre abuso de custo de SMS quando o provedor pago está ativo.

R1-003 (funcionário vê financeiro) deve ser corrigido antes de liberar o
painel a funcionários. Os itens de LGPD (R1-004 a R1-007) são relevantes mas
não bloqueiam sozinhos; recomendo tratá-los na mesma rodada.

O restante da superfície auditada (webhook, autorização multi-tenant das
actions, checkout/cupom recalculados no servidor, escalada de privilégio,
headers/CSP, realtime, open redirect, revogação de sessão) está sólido e passou
nos testes de runtime. Não declaro conformidade jurídica de LGPD — apenas
lacunas técnicas de prova e de minimização.
