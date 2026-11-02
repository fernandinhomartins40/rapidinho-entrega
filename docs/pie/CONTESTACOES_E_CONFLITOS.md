# Contestações e conflitos entre os pareceres

Auditor-Chefe, 2026-11-02. Pareceres confrontados:

- `BANCA_R1_SEGURANCA.md`;
- `BANCA_R2_USUARIO.md`;
- `BANCA_R3_ARQUITETURA.md`;
- `BANCA_R4_QUALIDADE.md`;
- `BANCA_R5_SRE.md`.

Os cinco foram feitos por subagentes com contexto separado, a partir do mesmo `00_ESCOPO_E_INVENTARIO_BASE.md`, sem acesso aos pareceres uns dos outros. Todos rodaram no mesmo modelo, então a independência é de contexto, não de modelo.

Cada conflito abaixo foi resolvido por nova verificação dirigida (leitura do código, comando ou teste em runtime), e não por votação.

## C1 — Webhook de pagamento: "sem achado" (R1) × "perde confirmação" (R3-003)

- **R1:** testou assinatura, replay e idempotência. Sem assinatura, 401; evento repetido, deduplicado. Concluiu que não há achado.
- **R3:** leu a ordem das operações. O `paymentEvent` (chave de deduplicação) era gravado **antes** de atualizar o pagamento e o pedido, e qualquer erro no `create` era tratado como "duplicado".
- **Verificação do Auditor-Chefe:** leitura de `apps/web/src/app/api/webhooks/pagamento/route.ts:62-103` (commit d65c0e5). Se o `payment.update` ou a transação do pedido falhasse depois do `create`, o reenvio do gateway cairia no `catch` como duplicado e a confirmação do pagamento se perderia.
- **Decisão:** os dois estão certos, sobre aspectos diferentes. O que R1 testou (autenticidade e replay) está correto. O defeito de R3 está **CONFIRMADO** pela leitura do código, mas não foi forçado em runtime, porque exigiria injetar uma falha no banco.
- **Correção:** 4395f01. Tudo passa a acontecer numa transação, só o P2002 conta como duplicado e a liberação do pedido é condicional.

## C2 — Limite por IP: R1-002 (XFF forjável) × R5-009 (limite global do nginx)

- **R1:** provou em runtime que o app usa o primeiro valor do `X-Forwarded-For`, que o cliente controla. Com um XFF diferente por requisição, todo limite por IP cai.
- **R5:** mostrou, pela configuração, que o nginx interno conta o IP do gateway do Docker. O `limit_req` do OTP vira um limite **global** de cerca de 6 por minuto para a plataforma inteira.
- **Verificação:** leitura de `docker/nginx/host/rapidinho-https.conf.template:59-60` (o nginx do host grava `X-Real-IP $remote_addr`) e de `docker/nginx/nginx.conf.template:75-76` (o nginx interno sobrescreve `X-Real-IP` com o gateway).
- **Decisão:** é a mesma causa raiz, vista dos dois lados. Os dois achados ficam **CONFIRMADOS** e unidos.
- **Correção:** 4395f01. O módulo realip confia só em redes privadas, e o app lê o `X-Real-IP`. Em runtime local, a parte do app foi validada pela prova de força bruta. A parte do nginx só se confirma em produção, depois do deploy.

## C3 — Isolamento por loja: "sólido" (R1) × aceite de corrida sem filtro (R3-012)

- **R1:** testou as server actions da loja: o `storeId` nunca vem do formulário.
- **R3:** apontou que `aceitarCorrida` (entregador) não filtrava por cidade nem por loja, embora a lista filtrasse.
- **Verificação:** leitura de `apps/admin/src/app/entregador/actions.ts:51-63`.
- **Decisão:** não há contradição, porque R1 não cobriu as actions do entregador. R3-012 fica **CONFIRMADO**.
- **Correção:** 4395f01.

## C4 — Cupom: "sem negativo, limites ok" (R1) × corrida no limite de uso (R3-011)

- **R1:** testou a regra (escopo, valor e limite) de forma sequencial.
- **R3:** apontou que o limite é checado fora da transação, com incremento incondicional.
- **Decisão:** as duas conclusões são compatíveis. A regra está certa; a concorrência fica como **FORTE INDÍCIO**, porque não foi executada com carga paralela.
- **Situação:** pendente (ver o plano mestre).

## C5 — Endereço na exclusão de conta: R1-004 e R3-017

São o mesmo defeito: `addressSnapshot: undefined` é ignorado pelo Prisma. Viram um único achado, **CONFIRMADO** pelo código.

Corrigido em 4395f01 (`Prisma.JsonNull`).

## C6 — Fotos em produção: só R5 viu (R5-001)

- **Por que os outros não viram:** o armazenamento local é SeaweedFS, acessado direto, sem o nginx. R5 observou, por GET público em produção, que `/uploads/*` responde 400 "invalid hostname".
- **Verificação:** leitura do template do nginx. O `proxy_set_header Connection ''` dentro do `location` descartava o `Host` herdado, e o MinIO recebia `minio_upstream`, que tem sublinhado. Além disso, o caminho omitia o bucket.
- **Decisão:** **CONFIRMADO** na configuração e no sintoma de produção.
- **Correção:** 4395f01, validada com `nginx -t` na imagem `nginx:1.27-alpine`. A prova com um MinIO real ficou **BLOQUEADA**: as imagens públicas do MinIO não existem mais (ver C7). Precisa ser confirmada em produção depois do deploy.

## C7 — Imagem do MinIO (R5-002 e o antigo R3-011)

- **Verificação:** `docker pull quay.io/minio/minio:latest` respondeu 401 e `docker pull minio/minio:latest` respondeu "repository does not exist". Nenhuma tag pública do MinIO pôde ser baixada.
- **Decisão:** **CONFIRMADO**. A produção roda de uma imagem que só existe em cache na VPS.
- **Situação:** pendente, porque é uma decisão de infraestrutura com dados de produção.

## C8 — Dono de loja sem senha: R3-009, R2-005, R4-011

É a mesma causa raiz, vista de três lugares:

- R3, no código do cadastro;
- R2, na tela de login;
- R4, nos dados do seed.

Fica um único achado, **CONFIRMADO**. Correção em 4395f01 (cartão "Acesso do dono ao painel" na tela da loja) e em 6f3ebdf (orientação na tela de login). Os perfis do seed continuam sem senha; ver o plano.

## C9 — Pix em produção: R3-013 × a configuração de deploy

- **R3:** marcou como HIPÓTESE: "com `PAYMENT_PROVIDER=fake`, nenhuma loja sem chave Pix gera QR".
- **Verificação do Auditor-Chefe:**
  - `.github/scripts/preparar-env.sh:134` grava `PAYMENT_PROVIDER=fake` quando a variável não existe;
  - `packages/services/src/providers.ts:111-113` lança erro com fake em produção;
  - `checkout/actions.ts` engole esse erro.
- **Decisão:** **FORTE INDÍCIO**. O código prova a cadeia; o `.env` real da VPS não pôde ser lido, porque o SSH foi negado.
- **Correção:** 30a21ee. O Pix só aparece quando pode ser pago: com chave da loja ou gateway real.

## C10 — Redirecionamento aberto: R2-025 e R4-008

É o mesmo achado, **CONFIRMADO** por R4 em runtime (`307 Location: https://example.com/golpe`).

Corrigido em 6f3ebdf e revalidado em runtime: `Location: /`.

## C11 — Força bruta no OTP: R1-001 (Crítica) e R3-027 (Baixa)

- **R3:** classificou como Baixa, por leitura do código.
- **R1:** provou em runtime. 30 palpites paralelos furaram o limite de 5 e entraram na conta.
- **Decisão:** prevalece a severidade com prova em execução. Fica **Crítica, CONFIRMADO**.
- **Correção:** 4395f01. Revalidado em 3 execuções: 0 logins, tentativas paradas em 5.

## Sem conflito, apenas lacuna

- R2 e R4 rodaram num ambiente local instável: servidor de desenvolvimento reiniciando por memória. Algumas jornadas ficaram como "não testado". Isso foi registrado e não foi preenchido por suposição.
- R5 não teve acesso à VPS, então as métricas do servidor estão **BLOQUEADAS**. Nenhum número da VPS foi estimado.
