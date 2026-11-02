# Banca R4: qualidade, funcionalidades e regressões

Revisor: R4 (engenheiro de qualidade). Protocolo PIE V2. Commit auditado: `d65c0e5` (main).
Execução: 2026-11-01 às 23h até 2026-11-02 de madrugada, na máquina local (Windows 11), sem alterar código, testes, configuração ou git.
Matriz completa: [`MATRIZ_VERIFICACAO.md`](MATRIZ_VERIFICACAO.md).

Todos os testes novos estão no scratchpad e **não** no repositório. Cada um é um teste proposto, executado fora do repositório:
`C:\Users\fusea\AppData\Local\Temp\claude\c--FuseDev-rapidinho-entrega\f9c02d86-2f36-47ac-a919-6a836a7d0812\scratchpad\r4\`
(`regressao.mjs`, `smoke.mjs`, `playwright.r4.config.ts`, `global-setup-lento.ts`, `dados.sql` e os logs `*.log`).

---

## 1. Parecer final

**A mudança de login (7cada39 e 6cb5ecb) funciona nos caminhos felizes, mas não pode ser liberada como está.**

1. **Regressão de segurança herdada pelo login com senha (R4-001, Alta, FORTE INDÍCIO).** `autenticarPorSenha` passou a aceitar lojista e funcionário. A rota `/api/sms/app/entrar`, do app gateway de SMS, devolve o `SMS_GATEWAY_TOKEN` a **qualquer** usuário que essa função aceite. Hoje qualquer pessoa cria um lojista com senha pelo `/cadastro-loja` anônimo.
2. **A regra "só entregador ativo recebe SMS" não vale para entregador pendente ou suspenso (R4-002, Alta, CONFIRMADO).** O código grava o OTP (que seria um SMS pago) para um entregador `PENDING_APPROVAL`.
3. **A action do site limita só por telefone, sem limite por IP (R4-003, Alta, CONFIRMADO: 10 números do mesmo IP geraram 10 códigos).** A marca `RapidinhoApp/` é forjável, e o próprio código diz que a proteção é "por telefone e por IP".
4. **Não existe nenhum teste automatizado das regras novas de login (R4-004, Alta, CONFIRMADO).** Os quatro casos pedidos não têm teste: recusa fora do app, entregador inativo, papel sem senha e provisória que revoga sessões. O pacote `@rapidinho/auth` não tem nenhum teste.
5. **No ambiente dev, o log quebra o OTP de forma intermitente (R4-005, Média, CONFIRMADO).** O transporte `pino-pretty` cai ("the worker has exited"), e com ele o envio do código pelo provedor `console`. É a causa provável das falhas do global setup do E2E. A suíte E2E não fechou verde em nenhuma das cinco execuções.

O que foi **verificado em runtime** e funciona:

- convite fora do app e 403 na API;
- login por código dentro do app;
- login com senha do lojista e do super admin, com destino conforme o papel;
- senha errada recusada, e cliente com hash de senha recusado;
- painel fora do app sem a etapa de telefone;
- entregador inexistente e entregador com usuário bloqueado recusados;
- APK servido.

**Também verificado:**

- a senha provisória (o super admin gera, a pessoa entra com ela, uma nova provisória derruba as sessões e a antiga deixa de valer);
- o `/loja/senha` (troca, senha atual errada recusada, a nova vale e a antiga não);
- o botão de provisória escondido para cliente.

**Falharam em runtime:**

- a troca de senha não encerra as outras sessões (R4-009);
- a busca de usuários não filtra (R4-006);
- funcionário sem loja cai em 404 (R4-007).

---

## 2. Verificações existentes (executadas)

| Comando                                   | Duração | Resultado                                                                                                                                                                                                                                                                                                                                                      |
| ----------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm typecheck`                          | 177 s   | **OK.** 9/9 tarefas turbo (1 em cache)                                                                                                                                                                                                                                                                                                                         |
| `pnpm lint`                               | 42 s    | **OK.** 9/9 tarefas, nenhum aviso no log                                                                                                                                                                                                                                                                                                                       |
| `pnpm test`                               | 25 s    | **OK.** `@rapidinho/shared`: 13 arquivos, **166 passaram**, 0 falharam. `@rapidinho/services`: 4 arquivos, **24 passaram**, 0 falharam. `@rapidinho/auth`, `@rapidinho/admin` e `@rapidinho/web`: **nenhum arquivo de teste** (o vitest passa vazio). Total: **190/190**                                                                                       |
| `pnpm format:check`                       | 160 s   | **FALHOU.** "Code style issues found in 388 files". Causa: fim de linha. `git config core.autocrlf` = `true`, e o Prettier usa `lf` por padrão. `npx prettier --check --end-of-line auto "apps/**/*.{ts,tsx}" "packages/**/*.{ts,tsx}"` → "All matched files use Prettier code style!". É artefato do checkout no Windows, não problema do código (ver R4-012) |
| `pnpm --filter @rapidinho/worker build`   | 5 s     | **OK.** `dist/main.js` 2186 kB e `dist/saude.js`                                                                                                                                                                                                                                                                                                               |
| `pnpm --filter @rapidinho/realtime build` | 4 s     | **OK.** `dist/server.js` 900 kB                                                                                                                                                                                                                                                                                                                                |
| `next build` (web e admin)                | —       | **NÃO EXECUTADO** de propósito: escreve em `.next`, o mesmo diretório dos servidores dev das portas 3200/3201                                                                                                                                                                                                                                                  |

Logs: `scratchpad/r4/{typecheck,lint,test,format:check,build-worker,build-realtime}.log`.

### 2.1 E2E Playwright

**O global setup (`e2e/global-setup.ts`) não re-semeia o banco.** Ele só faz login de três papéis (cliente por OTP com o user agent do app, lojista e super admin por senha) e grava `e2e/.auth/*.json`. Os dados vêm do `pnpm db:seed:e2e`, que rodei uma vez (4,6 s: "12 lojas abertas 24h", "5 perfis extras", "Lojista e super admin com e-mail e senha"). Antes disso o super admin do e2e **não tinha e-mail nem senha** no banco local: com o seed antigo, o setup quebraria.

**Edge:** `chromium.launch` aceita `E2E_CHROMIUM_PATH`, tanto no global setup quanto no projeto `celular`. Usei `E2E_CHROMIUM_PATH="C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"`.

| #   | Comando                                                                                                                                                                  | Duração  | Resultado                                                                                                                                                                                                                      |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | `E2E_BASE_URL=http://localhost:3200 E2E_ADMIN_URL=http://localhost:3201 E2E_CHROMIUM_PATH=…msedge.exe pnpm exec playwright test --output scratchpad/r4/e2e-results`      | 61 s     | **0 testes.** Global setup: `page.goto: Timeout 30000ms exceeded … /entrar` (primeira compilação dev)                                                                                                                          |
| 2   | o mesmo, depois de aquecer as rotas com curl                                                                                                                             | 79 s     | **0 testes.** Global setup: `page.waitForURL: Timeout 20000ms exceeded` em `apoio.ts:76` (login do cliente por OTP)                                                                                                            |
| 3   | o mesmo                                                                                                                                                                  | 119 s    | **0 testes.** Global setup: `waitForURL` 20 s em `apoio.ts:49` (login do painel com senha; o log do painel mostra `POST /entrar 303 in 31561ms`)                                                                               |
| 4   | `pnpm exec playwright test --config scratchpad/r4/playwright.r4.config.ts` (proposta: estende a do repo, global setup com esperas de 120 s e timeout de 180 s por teste) | 24,6 min | **12 passaram, 4 falharam.** Falharam `pedido.spec.ts:43`, `pedido.spec.ts:137`, `produto.spec.ts:16` e `produto.spec.ts:31`, todos com `page.goto: Timeout 120000ms exceeded` (`/palmital-pr`, `/carrinho`, `/loja/produtos`) |
| 5   | config proposta, só `pedido produto`                                                                                                                                     | 329 s    | **0 testes.** Global setup: `waitForURL` 120 s no login do cliente                                                                                                                                                             |

Passaram na execução 4:

- aprovação: cadastro de loja com e-mail e senha (cobre 228bc06 e d65c0e5) e aprovação pelo super admin;
- 5 de busca;
- 2 de campanha;
- 3 de loja, incluindo a fronteira lojista → `/admin`.

As quatro falhas são de **tempo de resposta do servidor dev**, não de asserção. No mesmo período, o log do web registra `Cannot find module …\.next\server\vendor-chunks\lib\worker.js` e `uncaughtException: the worker thread exited` (R4-005). **Pedido do cliente e produto do lojista ficam sem prova E2E nesta rodada.**

---

## 3. Regressões das mudanças recentes: o que foi comprovado em runtime

Roteiro: `node scratchpad/r4/regressao.mjs <passo>` (Edge, `channel: 'msedge'`, contextos separados por papel).

| ID   | O que prova                                                       | Resultado           | Evidência (sanitizada)                                                                                                                                                            |
| ---- | ----------------------------------------------------------------- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RT01 | Fora do app, `/entrar` mostra o convite                           | **PASSOU**          | `h1="Entre pelo app Rapidinho"`, 1 link para `/baixar/rapidinho.apk`, campo telefone = 0                                                                                          |
| RT02 | `POST /api/auth/otp/request` sem a marca do app                   | **PASSOU**          | `403 {"error":"Para entrar, use o app Rapidinho no celular."}`                                                                                                                    |
| RT03 | APK servido                                                       | **PASSOU**          | `200 application/vnd.android.package-archive`, 101135 bytes                                                                                                                       |
| RT04 | No app, login do cliente por código (console)                     | **PASSOU**          | Telefone de teste `(44) 97000-0002`, código lido de `data-testid=codigo-dev`, redirecionou para `/`, 1 sessão no banco                                                            |
| RT05 | Painel: lojista entra com senha                                   | **PASSOU**          | Destino final `/loja`. Na primeira tentativa a navegação do cliente parou em `/` por 90 s; recarregar levou a `/loja`                                                             |
| RT06 | Painel: super admin entra com senha                               | **PASSOU**          | Destino `/admin`                                                                                                                                                                  |
| RT07 | Senha errada                                                      | **PASSOU**          | "E-mail ou senha incorretos."                                                                                                                                                     |
| RT08 | Papel sem senha (CUSTOMER com hash scrypt válido e e-mail)        | **PASSOU**          | Recusado com a mesma mensagem genérica                                                                                                                                            |
| RT09 | Painel fora do app não oferece telefone                           | **PASSOU**          | campo telefone = 0, campo e-mail = 1                                                                                                                                              |
| RT10 | Entregador inexistente, no app                                    | **PASSOU**          | "Este número não é de entregador cadastrado…"                                                                                                                                     |
| RT11 | Entregador com usuário `BLOCKED`, no app                          | **PASSOU**          | Mesma mensagem                                                                                                                                                                    |
| RT12 | Entregador `PENDING_APPROVAL` (usuário ACTIVE), no app            | **FALHOU** (R4-002) | `otp_codes` criados = **1**: o SMS seria pago. A tela não avançou porque o `logger.warn` do provedor console estourou (R4-005)                                                    |
| RT24 | Funcionário com senha e sem loja                                  | **FALHOU** (R4-007) | `{"ok":true,"url":"/cadastro"}`, página "404 This page could not be found." `GET /cadastro` → 404                                                                                 |
| RT13 | Super admin gera senha provisória para `r4test_lojista`           | **PASSOU**          | "Senha provisória de Lojista R4: ********** — anote e envie agora…" Audit `user.password_changed` gravado. Captura: `scratchpad/r4/provisoria.png` (só um usuário fictício local) |
| RT14 | Login com a provisória                                            | **PASSOU**          | Destino `/loja`, 1 sessão                                                                                                                                                         |
| RT15 | Nova provisória revoga sessões                                    | **PASSOU**          | Sessões depois de gerar = 0. O contexto antigo foi mandado para `/entrar`                                                                                                         |
| RT16 | Provisória antiga deixa de valer                                  | **PASSOU**          | "E-mail ou senha incorretos."                                                                                                                                                     |
| RT17 | `/loja/senha` troca a senha                                       | **PASSOU**          | Alerta "Senha trocada"                                                                                                                                                            |
| RT18 | A troca de senha encerra as outras sessões                        | **FALHOU** (R4-009) | Sessões antes = 2, depois = 2. O outro aparelho continuou em `/loja`                                                                                                              |
| RT19 | A nova senha vale e a antiga não                                  | **PASSOU**          | nova → `/loja`; antiga → recusada                                                                                                                                                 |
| RT20 | `/loja/senha` com a senha atual errada                            | **PASSOU**          | "Senha atual incorreta" exibida                                                                                                                                                   |
| RT21 | Provisória para cliente                                           | **PASSOU**          | O botão "Gerar senha provisória" não aparece para CUSTOMER. A action chamada direto não foi testada (a guarda `PAPEIS_COM_SENHA` existe no servidor)                              |
| RT22 | Busca de usuários sem filtro efetivo                              | **FALHOU** (R4-006) | `/admin/usuarios?busca=lojista%40r4.teste` mostrou **32 linhas**, para 1 usuário com esse e-mail (`provisoria-diag.mjs`)                                                          |
| RT23 | `/entrar?destino=https://example.com/golpe` com sessão de cliente | **FALHOU** (R4-008) | `status=307 location=https://example.com/golpe`                                                                                                                                   |
| RT25 | Action do site: 10 números distintos no mesmo contexto/IP         | **FALHOU** (R4-003) | 10/10 aceitos, nenhum "Muitas tentativas", **10 `otp_codes` gravados** (com o provedor sms seriam 10 SMS pagos)                                                                   |

Nota: as primeiras tentativas dos passos 5 a 9 estouraram o tempo, porque os dois servidores ficaram sem responder por alguns minutos (`curl /api/health` no 3201 → `000` em 100 s). Repeti depois que eles voltaram. Uma tentativa do RT13 falhou só porque o roteiro procurava `[role=alert]` dentro do diálogo; a captura mostrou a mensagem na tela, e o seletor foi corrigido para o texto.

### 3.1 Dados criados no banco local

Script: `scratchpad/r4/dados.sql`, mais dois `UPDATE` e um `INSERT` registrados no fim do arquivo. Prefixo `r4test_` nos ids, e-mails `@r4.teste.local`, telefones fictícios `+55449700000xx`.

| id                                                                              | papel / status                                                           | Uso                                          |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | -------------------------------------------- |
| `r4test_lojista` (+ `store_staff` `r4test_staff`, OWNER na loja do lojista e2e) | STORE_OWNER / ACTIVE, `lojista@r4.teste.local`, sem senha                | Senha provisória e `/loja/senha` (bloqueado) |
| `r4test_cliente`                                                                | CUSTOMER / ACTIVE, `cliente@r4.teste.local`, hash de `R4@senhaCliente1`  | RT04 e RT08. Ganhou 1 sessão no site         |
| `r4test_ent_pend` (+ `couriers` `r4test_cour_pend`, PENDING_APPROVAL)           | COURIER / ACTIVE                                                         | RT12. Ganhou 1 `otp_codes`                   |
| `r4test_ent_bloq` (+ `couriers` `r4test_cour_bloq`, ACTIVE)                     | COURIER / BLOCKED                                                        | RT11                                         |
| `r4test_staff_sem_loja`                                                         | STORE_STAFF / ACTIVE, `semloja@r4.teste.local`, hash de `R4@semLoja2026` | RT24                                         |

Também foram criados:

- linhas em `otp_codes` para `+5544970000002`, `+5544970000003` e `+5544970000100` a `+5544970000109` (RT25, 10 linhas);
- chaves Redis `ratelimit:otp:request:phone:*` e `ratelimit:senha:email:cliente@r4.teste.local`;
- pelo E2E da execução 4: uma loja "Mercado Teste NNNNNN" aprovada, com o lojista `lojista-NNNNNN@e2e.rapidinho.test`.

O `pnpm db:seed:e2e` regravou os horários das lojas, os 5 perfis extras e a senha do lojista e do super admin do e2e.

Limpeza sugerida: `DELETE FROM users WHERE id LIKE 'r4test_%';` (as tabelas filhas caem em cascata) e `DELETE FROM otp_codes WHERE phone LIKE '+554497000%';`.

---

## 4. Achados

### R4-001: o token do app gateway de SMS sai para qualquer lojista ou funcionário

- **Categoria:** regressão / autorização.
- **Severidade:** Alta. Vira Crítica com `OTP_PROVIDER=sms-reverso`. Quem tem o token forja "SMS recebido" em `/api/sms/recebido` e confirma o login reverso de qualquer telefone. Com `OTP_PROVIDER=sms` (SMSDev, o atual), o token vaza e serve aos endpoints do gateway (`/api/sms/recebido`, `/api/sms/sinal`).
- **Estado:** FORTE INDÍCIO. O código está comprovado. RT05 mostra que `autenticarPorSenha` aceita lojista. O runtime da rota ficou bloqueado porque `SMS_GATEWAY_TOKEN` não está configurado localmente: a rota devolve 401 para todos.
- **Arquivo:linha:**
  - `apps/web/src/app/api/sms/app/entrar/route.ts:37-41`: `token = userId ? SMS_GATEWAY_TOKEN : null`, sem checar o papel;
  - `packages/auth/src/senha.ts:7-12,27-31`: `PAPEIS_COM_SENHA` com STORE_OWNER e STORE_STAFF desde 6cb5ecb. Antes era só `SUPER_ADMIN || ADMIN`;
  - `apps/web/src/app/cadastro-loja/actions.ts:127-137`: o cadastro anônimo cria STORE_OWNER ACTIVE com senha.
- **Reprodução segura** (local, com `SMS_GATEWAY_TOKEN=x` no ambiente do servidor):
  1. Cadastrar uma loja em `/cadastro-loja` com e-mail e senha.
  2. `curl -X POST :3200/api/sms/app/entrar -d '{"email":…,"senha":…}'`.
- **Esperado × observado:** esperado 401 para quem não é super admin. Pelo código, o observado seria 200 `{token}`. Hoje, sem token configurado, sai 401 para lojista e cliente (comando executado; saída `{"error":"E-mail ou senha incorretos."}`).
- **Impacto:** tomada de conta (no modo reverso) ou abuso do gateway, por qualquer pessoa da internet, sem aprovação.
- **Correção proposta:** em `sms/app/entrar`, exigir `role === 'SUPER_ADMIN'` (ou um papel dedicado) depois de `autenticarPorSenha`. Melhor ainda: uma função `autenticarEquipeDaPlataforma`.
- **Teste de aceite:** teste de rota com usuários STORE_OWNER, STORE_STAFF, ADMIN e SUPER_ADMIN. Só o permitido recebe 200.

### R4-002: SMS de login sai para entregador pendente, recusado ou suspenso

- **Categoria:** regra de negócio / custo.
- **Severidade:** Alta. Quebra a regra do dono ("só se for COURIER ativo"), e cada pedido é um SMS pago. O candidato vira `role=COURIER` no ato do cadastro público em `/entregador`.
- **Estado:** CONFIRMADO (RT12).
- **Arquivo:linha:**
  - `apps/admin/src/app/entrar/actions.ts:60-66`: `ehEntregadorAtivo` confere só `user.role`, `user.status` e `deletedAt`. Não olha `courier.status`;
  - `apps/web/src/app/entregador/actions.ts:56,85,96`: o cadastro cria o courier `PENDING_APPROVAL` com o usuário já COURIER;
  - `packages/auth/src/guards.ts:209`: o painel só barra depois, no `requireCourier`.
- **Reprodução segura:** RT12 (`node regressao.mjs 4`), com o usuário `r4test_ent_pend`. No app, painel `/entrar`, telefone `(44) 97000-0003`.
- **Esperado × observado:** esperado "não é de entregador" e nenhum OTP. Observado: `otp_codes criados=1` e nenhum alerta. Com `OTP_PROVIDER=sms` haveria SMS pago e, depois, uma sessão inútil.
- **Correção proposta:** em `ehEntregadorAtivo`, incluir `courier: { status: 'ACTIVE' }` (relação 1:1 `couriers.userId`). Repetir a checagem em `verificarCodigo`.
- **Teste de aceite:** teste de unidade/integração com a matriz `user.status` × `courier.status`. Só ACTIVE/ACTIVE gera OTP.

### R4-003: a action de login do site não limita por IP

- **Categoria:** custo / abuso (bombeamento de SMS).
- **Severidade:** Alta. A marca do app é forjável (o próprio `app-nativo.ts:5-8` admite), e o código afirma que "o que protege o crédito de SMS é o limite por telefone e por IP". A action só tem o limite por telefone: um IP percorre números à vontade, 3 SMS por número a cada 15 minutos.
- **Estado:** CONFIRMADO (RT25).
- **Arquivo:linha:** `apps/web/src/app/entrar/actions.ts:80-84` (só `otp:request:phone:`). Compare com `apps/web/src/app/api/auth/otp/request/route.ts` (`byPhone` e `byIp`). O painel (`apps/admin/src/app/entrar/actions.ts:96-100`) tem o mesmo desenho, atenuado porque só aceita números de entregador.
- **Reprodução segura:** `node regressao.mjs 9`. Com o provedor console, pede código para 10 números distintos no mesmo contexto e conta os `otp_codes` gravados.
- **Esperado × observado:** esperado "Muitas tentativas" antes do 10º número. Observado: 10/10 aceitos e 10 códigos gravados (provedor console, nenhum SMS saiu).
- **Correção proposta:** extrair um `limitarPedidoDeCodigo(phone, ip)` comum à rota e às duas actions, com o limite `otp:request:ip:` (e, de preferência, um teto global diário de SMS).
- **Teste de aceite:** teste de integração da action com Redis: o N-ésimo número do mesmo IP é recusado.

### R4-004: nenhuma regra nova de login tem teste automatizado

- **Categoria:** lacuna de teste.
- **Severidade:** Alta. É a mudança mais arriscada do período (custo de SMS, acesso ao painel e revogação de sessão), e só o `estaNoAppNativo` (string) tem teste.
- **Estado:** CONFIRMADO. O `pnpm test` mostra `@rapidinho/auth`, `@rapidinho/admin` e `@rapidinho/web` sem arquivos de teste; `e2e/tests` não tem nenhum spec de login (o login só aparece como preparação no global setup).
- **Cobertura dos quatro casos pedidos:**

| Caso                                      | Teste existente                                                       | Situação                                                                         |
| ----------------------------------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Recusa fora do app (página, action e API) | `packages/shared/src/utils/app-nativo.test.ts` só testa a função pura | **sem teste** da página, da action e da rota                                     |
| Entregador inativo                        | nenhum                                                                | **sem teste**, e com defeito (R4-002)                                            |
| Papel sem senha                           | nenhum (`senha.test.ts` só testa o hash)                              | **sem teste**                                                                    |
| Provisória que revoga sessões             | nenhum                                                                | **sem teste**. Também falta o caso inverso: a troca de senha não revoga (R4-009) |

- **Correção proposta:**
  - testes de integração de `autenticarPorSenha` (matriz papel × status × deletedAt), `ehEntregadorAtivo` e `gerarSenhaProvisoria` (não super admin, papel sem senha, e-mail em uso, `revokeAllSessions` chamado);
  - um `e2e/tests/login.spec.ts` com RT01, RT02, RT07, RT08, RT10, RT11 e RT12, além de provisória → login → nova provisória → sessão anterior cai. O roteiro `scratchpad/r4/regressao.mjs` serve de base.
- **Teste de aceite:** os testes acima no CI. Mutar `PAPEIS_COM_SENHA` ou remover o `revokeAllSessions` faz algum teste falhar.

### R4-005: no dev, o transporte do log cai e derruba o envio do OTP e o E2E

- **Categoria:** confiabilidade do ambiente de teste.
- **Severidade:** Média. Não afeta produção: lá o log é JSON, sem transporte. Mas torna o E2E e o login dev intermitentes, e esconde regressões reais.
- **Estado:** CONFIRMADO.
- **Arquivo:linha:** `packages/services/src/logger.ts:43-50` (`transport: { target: 'pino-pretty' }` em development) e `packages/services/src/messaging/otp.ts:26` (o `logger.warn` dentro do `send`).
- **Evidência** (logs dos servidores dev, tarefas `bynwg9r7j` e `byrc4uk83`):
  - 132 ocorrências de "worker has exited" no web;
  - `Error: the worker has exited at Object.send (packages/services/src/messaging/otp.ts:26:14) at requestOtp (packages/auth/src/otp.ts:68:24)`;
  - `Cannot find module 'C:\FuseDev\rapidinho-entrega\apps\web\.next\server\vendor-chunks\lib\worker.js'`, e o mesmo no admin. É o `thread-stream` do pino empacotado pelo webpack do Next.

  No RT12 o OTP foi gravado e a tela não avançou. Nas execuções 2, 3 e 5 do E2E, o global setup estourou o tempo.

- **Reprodução segura:** subir `next dev`, pedir código e observar o log.
- **Esperado × observado:** esperado: código mostrado e login concluído. Observado: falha intermitente e `uncaughtException`.
- **Correção proposta:** colocar `pino`/`pino-pretty`/`thread-stream` em `serverExternalPackages` no `next.config.mjs` dos dois apps, ou usar `pino-pretty` como stream síncrono, sem `transport`. No provedor console, não deixar exceção do log derrubar o envio.
- **Teste de aceite:** cinco execuções seguidas do global setup sem falha, e nenhum "worker has exited" no log.

### R4-006: a busca de usuários por nome ou e-mail devolve todo mundo

- **Categoria:** funcionalidade.
- **Severidade:** Média. É a tela onde o super admin gera a senha provisória: com uma busca por e-mail sem dígitos, a lista não filtra, e o risco de agir na pessoa errada aumenta.
- **Estado:** CONFIRMADO. Busca `lojista@r4.teste` (um único usuário com esse e-mail) → 32 linhas na tela (`scratchpad/r4/provisoria-diag.mjs`).
- **Arquivo:linha:** `apps/admin/src/app/admin/usuarios/page.tsx:50`, `{ phone: { contains: busca.replace(/\D/g, '') } }`. Sem dígitos, vira `contains: ''`, que casa com todo telefone não nulo. Com um dígito ("lojista@r4") casa com quase todos.
- **Reprodução segura:** `node regressao.mjs 6` (`/admin/usuarios?busca=NomeQueNaoExisteXYZ`).
- **Esperado × observado:** esperado: só quem casa no nome ou no e-mail. Observado: 32 linhas, porque o dígito "4" do termo casou com o telefone de quase todos.
- **Correção proposta:** só incluir o filtro de telefone quando `busca.replace(/\D/g,'').length >= 4`.
- **Teste de aceite:** o RT22 passa, e a busca por um número completo continua achando.

### R4-007: funcionário ou lojista sem loja ativa cai em 404 no painel

- **Categoria:** funcionalidade / regressão de jornada.
- **Severidade:** Média. Agora que funcionário entra com senha, um funcionário desligado (`store_staff.isActive=false`), ou um STORE_OWNER sem loja, entra e é mandado para uma rota inexistente.
- **Estado:** CONFIRMADO (RT24). `semloja@r4.teste.local` entra com senha e cai em `/cadastro`, que mostra "404 This page could not be found."
- **Arquivo:linha:** `apps/admin/src/app/page.tsx:26-27` (`redirect('/cadastro')`). Não existe `apps/admin/src/app/cadastro`, mas `/cadastro` está em `PUBLIC_PATHS` (`apps/admin/src/middleware.ts:14`).
- **Correção proposta:** recusar no login quando não houver loja acessível (mensagem "Sua conta não está vinculada a uma loja"), ou redirecionar para `${WEB}/cadastro-loja`.
- **Teste de aceite:** o RT24 mostra uma mensagem clara, sem 404.

### R4-008: redirecionamento aberto em `/entrar` do site para quem já tem sessão

- **Categoria:** segurança / funcionalidade.
- **Severidade:** Média. Um link de phishing com o domínio legítimo leva o cliente logado para um site externo.
- **Estado:** CONFIRMADO (RT23): `307 Location: https://example.com/golpe`.
- **Arquivo:linha:** `apps/web/src/app/entrar/page.tsx:26`, `if (user) redirect(destino ?? '/')`, sem a checagem `startsWith('/') && !startsWith('//')` que as actions fazem. O painel não tem o problema (`apps/admin/src/app/entrar/page.tsx:22` usa `redirect('/')`).
- **Reprodução segura:** `node regressao.mjs 7`: GET `/entrar?destino=https://example.com/golpe` com sessão, `maxRedirects: 0`, e ler o `Location`.
- **Correção proposta:** usar a mesma validação das actions (uma função comum `destinoInterno()`).
- **Teste de aceite:** o RT23 dá `Location` interno.

### R4-009: trocar a senha não encerra as outras sessões

- **Categoria:** segurança / regra.
- **Severidade:** Média. Quem troca a senha porque desconfia de vazamento continua com o invasor logado. O caso da provisória revoga; a troca pelo próprio usuário, não.
- **Estado:** CONFIRMADO (RT18): duas sessões antes da troca, duas depois, e o segundo aparelho continuou em `/loja`.
- **Arquivo:linha:** `apps/admin/src/lib/trocar-senha.ts:63-68` (só `prisma.user.update`). Compare com `apps/admin/src/app/admin/usuarios/actions.ts` (`revokeAllSessions` depois da provisória).
- **Correção proposta:** revogar as outras sessões (todas menos a atual) depois de trocar a senha.
- **Teste de aceite:** o RT18 passa (a sessão do segundo contexto cai).

### R4-010: o entregador não tem caminho para o login do painel dentro do app

- **Categoria:** jornada / produto.
- **Severidade:** Média. A única tela que oferece telefone para o entregador é o `/entrar` do painel no app. Mas o "Já é entregador? Entre com seu telefone" do site leva ao `/entrar` do **site**, que loga como cliente no domínio do site e não leva ao `/entregador` do painel. O caminho que funciona é o link "Sou lojista" do rodapé, o que não é intuitivo.
- **Estado:** FORTE INDÍCIO (estático).
- **Arquivo:linha:** `apps/web/src/app/entregador/page.tsx:58` (`href="/entrar"`) e `apps/web/src/components/landing/rodape.tsx:60`. O WebView mantém o subdomínio do painel dentro do app (`MainActivity.java:102-103`).
- **Correção proposta:** apontar o link para `${NEXT_PUBLIC_ADMIN_URL}/entrar?destino=/entregador`, ou mandar ao painel quem tem papel COURIER depois do login no site.
- **Teste de aceite:** um E2E com o UA do app: site `/entregador` → login → chega a `/entregador` do painel.

### R4-011: perfis existentes sem senha ficam trancados fora do painel

- **Categoria:** migração / operação.
- **Severidade:** Média.
- **Estado:** CONFIRMADO no banco local: STORE_OWNER 11 de 13 sem senha e sem e-mail, STORE_STAFF 2 de 2, ADMIN 1 de 1. O `seed:e2e` cria gerente, operador e admin da matriz de permissões **sem senha** (`packages/database/prisma/seed/e2e.ts:40-45`; `semearSenhas`, nas linhas 81-84, só cobre lojista e super admin). Esses perfis não entram mais no painel, nem para os testes de permissão.
- **Impacto:** em produção, todo lojista, funcionário ou admin anterior a 6cb5ecb depende de o super admin gerar uma provisória um a um (não há fluxo em lote nem aviso). Os testes da matriz de permissões (`docs/revisao/MATRIZ-DE-PERMISSOES.md`) perdem o login desses papéis.
- **Correção proposta:** o seed:e2e grava e-mail e senha para todos os perfis do painel. Para produção: um script de migração ou uma listagem "sem senha" em `/admin/usuarios`.
- **Teste de aceite:** um teste E2E de login para gerente, operador e admin.

### R4-012: o `format:check` falha em 388 arquivos no Windows

- **Categoria:** ambiente / DX.
- **Severidade:** Baixa. O CI (Linux) não sofre, mas quem roda o check localmente vê vermelho falso.
- **Estado:** CONFIRMADO (seção 2).
- **Arquivo:linha:** `.prettierrc` sem `endOfLine`, e falta `.gitattributes` com `* text=auto eol=lf`.
- **Correção proposta:** adicionar `.gitattributes` com `eol=lf`.
- **Teste de aceite:** `pnpm format:check` verde num checkout novo no Windows.

### R4-013: testes E2E frágeis ou fracos

- **Categoria:** qualidade de teste.
- **Severidade:** Média.
- **Estado:** CONFIRMADO (análise dos specs e das cinco execuções).
- **Pontos:**
  - `e2e/global-setup.ts` + `e2e/tests/apoio.ts:49,76`: espera fixa de 20 s depois do login, que estourou três vezes no dev compartilhado. Também não há retry local (`retries: 0` fora do CI).
  - `e2e/tests/pedido.spec.ts:137`: "o histórico mostra o pedido recém-criado" só confere o título "Meus pedidos", não o pedido. Passa mesmo se o pedido não existir.
  - `pedido.spec.ts:43`: não confere total, frete nem status inicial do pedido. O dinheiro não é verificado.
  - `aprovacao.spec.ts`: os dois testes dependem um do outro (serial), e a loja aprovada fica na vitrine para sempre: suja a base para o `pedido.spec`, que precisou de um laço para contornar.
  - `campanha.spec.ts` e `loja.spec.ts` usam um único super admin. Não há teste de ADMIN (não super) nem de STORE_STAFF.
- **Correção proposta:** esperas guiadas por estado (`expect(page).toHaveURL` com timeout configurável), asserção do pedido no histórico e do total, e limpeza da loja criada.
- **Teste de aceite:** a suíte verde três vezes seguidas.

### R4-014: senha provisória sem troca obrigatória, e troca de senha do lojista sem auditoria

- **Categoria:** regra / rastreabilidade.
- **Severidade:** Baixa.
- **Estado:** FORTE INDÍCIO (estático).
- **Arquivo:linha:** `apps/admin/src/app/loja/senha/actions.ts:9-11` não grava auditoria, ao contrário de `admin/senha/actions.ts:17-27`. `gerarSenhaProvisoria` não marca a senha como "trocar no próximo acesso".
- **Correção proposta:** gravar a auditoria `userPasswordChanged` também no `/loja/senha`, e um campo `passwordMustChange`.
- **Teste de aceite:** a auditoria aparece em `/admin/auditoria` depois da troca pelo lojista.

---

## 5. Análise estática complementar

- **Senha provisória** (`apps/admin/src/app/admin/usuarios/actions.ts`, `gerarSenhaProvisoria`):
  - exige SUPER_ADMIN;
  - valida o e-mail com zod e recusa papel fora de `PAPEIS_COM_SENHA`;
  - recusa e-mail de outra conta;
  - gera 10 caracteres com `randomInt` sobre um alfabeto sem caracteres ambíguos;
  - grava só o hash, chama `revokeAllSessions(usuario.id)` e audita sem a senha.

  A interface só mostra o formulário para os papéis com senha (`acoes-do-usuario.tsx:24,88`). Parece correta. Faltam testes (R4-004). Um detalhe: a ação também troca o e-mail do usuário, e um erro de digitação tranca a conta até a próxima provisória.

- **`/loja/senha`** (`apps/admin/src/lib/trocar-senha.ts`):
  - confere a senha atual com limite (`senha:troca:<id>`) e exige no mínimo 8 caracteres, diferente da atual e confirmada;
  - quem não tem senha pode criar uma sem a atual. Aceitável, porque é preciso estar logado, e só se entra no painel sem senha pelo SMS de entregador, que não tem `/loja`;
  - não revoga as outras sessões (R4-009) e não audita (R4-014).
- **Limite de senha:** 5 tentativas a cada 15 minutos, por IP **e** por e-mail (`apps/admin/src/app/entrar/actions.ts:209-223`). Cinco senhas erradas para o e-mail de um lojista bloqueiam o login dele por 15 minutos, e o bloqueio pode ser repetido (negação de serviço direcionada). HIPÓTESE de impacto, sem teste. Fica como observação para R1/R2.

---

## 6. O que foi inspecionado, testado e não testado

**Inspecionado (leitura):**

- os diffs de 7cada39, 6cb5ecb, 228bc06 e d65c0e5;
- as actions de `/entrar` (web e painel), `api/auth/otp/request`, `api/sms/app/entrar`, `packages/auth/src/{senha,guards,otp,session}.ts`, `trocar-senha.ts`, `usuarios/{actions,page,acoes-do-usuario}`, `cadastro-loja/actions.ts`, `entregador/actions.ts` (web e painel), os middlewares, `MainActivity.java`, o logger, o provedor OTP e os seeds;
- os 6 specs E2E com o `apoio.ts`, o `ci.yml` e o `deploy.yml`;
- o inventário de todas as `page.tsx`, `actions.ts` e `route.ts`, com guardas e escritas no Prisma (base da matriz).

**Testado (executado):** a seção 2 (typecheck, lint, unitários, format, build de worker e realtime, E2E ×5) e a seção 3 (RT01–RT22, RT24).

**Não testado / bloqueado:**

- ver na seção 3 o estado final do RT23 e do RT25;
- fumaça de todas as rotas (`smoke.mjs` pronto, não executado pelo mesmo motivo);
- `next build` de web e admin (proibido nesta configuração);
- o app Android (só leitura do código; não instalei o APK);
- produção (fora do escopo do R4);
- o envio real pela SMSDev (proibido; o `otp.test.ts` cobre a montagem da chamada com fetch simulado).

**Limitações:**

- Os servidores dev eram compartilhados com os outros revisores. Os tempos de resposta chegaram a 161 s (`GET / 200 in 161375ms` no painel), e no fim os dois não respondiam. Por isso parte do runtime ficou BLOQUEADA, e não FALHA.
- O `.env` local tem `OTP_PROVIDER=sms` e uma chave da SMSDev preenchida. Os servidores 3200/3201 sobrescrevem isso pelo ambiente (o log confirma o provedor console). Quem subir um servidor novo sem essa sobrescrita **enviará SMS reais**. Fica como alerta ao Auditor-Chefe.
- Nenhum segredo ou dado pessoal real foi copiado para este texto. Os telefones citados são fictícios do seed ou do R4.
- A fumaça de rotas (`smoke.mjs`) rodou uma vez. Anônimo no site: 21 rotas, todas responderam. Lojista e super admin no painel: todas 200, com as fronteiras de papel corretas. As rotas logadas do cliente depois de `/carrinho` ficaram BLOQUEADAS: o servidor web reiniciou por limite de memória ("Server is approaching the used memory threshold, restarting..."). Os resultados estão na `MATRIZ_VERIFICACAO.md`.

## 7. Commits posteriores à revisão

Tudo o que está acima é o estado observado em `d65c0e5`. Depois do início desta revisão, o Auditor-Chefe fez os commits `4395f01` e `30a21ee`, que mexem em áreas destes achados: OTP atômico, IP lido de `X-Real-IP`, remoção de `/api/auth/otp/*`, limite por IP na action de login, financeiro do funcionário, "Pix para conferir", transição de status condicional e aceite dos termos. O R4 **não** reavaliou esse código.

Achados a revalidar contra esses commits:

- **R4-003:** o limite por IP foi anunciado; reexecutar `node regressao.mjs 9`.
- **R4-005:** confirmar se o envio atômico do OTP ainda depende do `logger.warn`.
- **R4-013:** o global setup e o `pedido.spec` foram tocados pelo checkout e pelo aceite dos termos.

Os demais achados (R4-001, 002, 004, 006, 007, 008, 009, 010, 011, 012 e 014) não aparecem na lista de mudanças informada. Ficam abertos até que se prove o contrário, com os passos do roteiro (`regressao.mjs` 4, 5, 6, 7 e 8) como teste de aceite.
