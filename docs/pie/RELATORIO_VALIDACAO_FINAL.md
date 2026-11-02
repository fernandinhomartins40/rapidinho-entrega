# Relatório de validação final

Auditor-Chefe, 2026-11-02.

| Item           | Valor                                                                                                  |
| -------------- | ------------------------------------------------------------------------------------------------------ |
| Base           | `d65c0e5`                                                                                              |
| Correções      | `4395f01`, `30a21ee`, `6f3ebdf`, `c5a6c06`, `d2d425e`, `aef53aa` (todas na `main` local, **sem push**) |
| Site           | `next dev` em `http://localhost:3200`, com `OTP_PROVIDER=console` (nenhum SMS real)                    |
| Painel         | `next dev` em `http://localhost:3201`, nas mesmas condições                                            |
| Infraestrutura | Postgres, Redis e S3 local em Docker                                                                   |

## 1. Verificações executadas depois de todas as correções

| Verificação                                        | Comando                                                                        | Resultado                                                                                                                                                                                            |
| -------------------------------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tipos                                              | `pnpm typecheck`                                                               | 9/9 tarefas ok (1 min 05 s)                                                                                                                                                                          |
| Lint                                               | `pnpm lint`                                                                    | 9/9 tarefas ok                                                                                                                                                                                       |
| Unitários                                          | `pnpm test`                                                                    | **195 passaram**, 0 falharam (shared 171, services 24). Antes: 190                                                                                                                                   |
| Build                                              | `pnpm --filter @rapidinho/worker build` e `--filter @rapidinho/realtime build` | ok                                                                                                                                                                                                   |
| Build do site e do painel                          | —                                                                              | **Não executado** localmente: escreveria no `.next` dos servidores em uso. O CI do deploy compila os dois                                                                                            |
| E2E (Playwright, Edge, config com esperas maiores) | `playwright test --config scratchpad/r4/playwright.r4.config.ts`               | Execução completa: **15/16**. A falha foi um estouro de tempo ao abrir o checkout recém-recompilado. Reexecução de `pedido.spec.ts` com o servidor aquecido: **2/2**. Total: as 16 jornadas passaram |
| Nginx                                              | `docker run nginx:1.27-alpine` + `nginx -t` com o template novo                | sintaxe ok; `proxy_pass http://minio_upstream/rapidinho/` gerado                                                                                                                                     |
| Deploy (segredos pelo stdin)                       | Simulação local do passo do workflow, com `sh` no papel de shell remoto        | os 4 segredos chegaram intactos, com aspas e `$`, ao script                                                                                                                                          |
| APK 1.1                                            | `./gradlew assembleRelease`                                                    | ok (102 543 bytes), assinado com a mesma chave do 1.0                                                                                                                                                |

## 2. Provas em runtime das correções

| Achado                   | Prova                                                                                                                                                                                                          |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1, força bruta no OTP   | Script com 30 e depois 51 palpites paralelos mais o código certo (Auditor e verificador): **0 logins**, `attempts=5`, código consumido. O login legítimo: erra uma vez, acerta, entra; reuso recusado          |
| A2, IP                   | Verificador: 8 POSTs com `X-Forwarded-For` diferentes compartilham o mesmo limite (429)                                                                                                                        |
| A3, Pix na chave da loja | Playwright no painel: "Pix para conferir" → "Recebi o Pix" → banco `RECEIVED / PAID / "Pix conferido pela loja"`. Verificador: outra loja, Pix de gateway, pedido cancelado e clique duplo paralelo não passam |
| A4/A5, webhook e status  | Verificador: reenvio é duplicado; exceção desfaz a transação; cancelado não ressuscita; 2 PAID concorrentes liberam 1 vez                                                                                      |
| A8, financeiro           | Sessão de funcionário: `/loja/financeiro` bloqueado; `/loja` sem vendas, ticket nem comissão                                                                                                                   |
| A9, token do gateway     | Verificador: lojista com senha correta recebe 401                                                                                                                                                              |
| A14, app fora da landing | `GET /` com o user-agent do app → `307 /app`                                                                                                                                                                   |
| A15, opção pelo nome     | Playwright: tocar em "Ao ponto" → "Adicionar · R$ 22,00" habilitado                                                                                                                                            |
| A17, saídas              | GET: iPhone vê "O app para iPhone ainda não saiu"; links do painel corretos                                                                                                                                    |
| M2/M3, LGPD              | Login grava 2 `consent_records`; exportação registra 1 `data_request` EXPORT e baixa como anexo; sem sessão, 401                                                                                               |
| M9, redirecionamento     | 5 variações com `\`, `//` e tabulação → `307 /`; `/pedidos` preservado                                                                                                                                         |
| M17, reenviar código     | Playwright: o botão nasce travado ("Reenviar código em 60s"); telefone formatado                                                                                                                               |
| M19, cancelar            | Playwright: "Cancelar pedido" → "Sim, cancelar" → `CANCELLED / "Cancelado pelo cliente"`. Verificador: pedido de outro cliente, ACCEPTED e PAGO recusados                                                      |

## 3. Revalidação adversarial independente

Feita por um subagente verificador, que não participou das correções: `REVALIDACAO_ADVERSARIAL.md`.

- **9 de 11 vetores resistiram.**
- **2 foram reabertos:** M9, o redirecionamento com barra invertida, e A8, os valores no painel inicial. Os dois foram corrigidos em `aef53aa` e revalidados em runtime (adendo no mesmo arquivo).
- As telas de UX não foram atacadas pelo verificador. Ficam apoiadas nas provas do Auditor-Chefe (seção 2).

## 4. Regressões

Nenhuma regressão encontrada nas suítes e nas jornadas e2e. Mudanças de comportamento **intencionais** que o dono deve conhecer:

1. **Pix:** só aparece no checkout se a loja tiver chave Pix própria ou se o gateway real estiver configurado. Hoje, provavelmente, só lojas com chave.
2. **Cartão pelo app:** não aparece mais, nem para a loja nem para o cliente, até existir a tokenização.
3. **Login por SMS:** só celular (11 dígitos com 9). Fixo é recusado.
4. **Limite por IP no pedido de código:** 30 a cada 15 minutos.
5. **Rotas `/api/auth/otp/*`:** removidas, porque não tinham consumidor.
6. **Landing:** sem os números "+10 mil / +500 / +50 mil" e sem o depoimento, que eram fictícios.
7. **Troca de senha:** desconecta os outros aparelhos.
8. **Funcionário:** não vê valores (vendas, ticket, comissão) no painel.

## 5. Riscos residuais e bloqueios

- **Precisa ser confirmado em produção depois do deploy:**
  - `/uploads` com 200 (A6);
  - IP real nos limites (A2);
  - `.env` real da VPS (`PAYMENT_PROVIDER`, `WHATSAPP_PROVIDER`).
- **Bloqueado nesta sessão:** métricas da VPS, backups reais e teste de restauração (SSH negado); prova com MinIO real (as imagens públicas não existem mais); APK num aparelho.
- **Pendências que dependem do dono:** A7 (MinIO), A19 e A20 (cobrança e repasse), A22 e A23 (deploy, backup e acesso), além de P1 a P3 de `OPORTUNIDADES_PRODUTO.md` (notificações, pagamento online, Play Store).
- **Pendências técnicas:** listadas em `PLANO_MESTRE_AUDITORIA.md`.

## 6. Dados de teste no banco local

Criados pelos revisores e pelo Auditor-Chefe, todos sintéticos:

- usuários `r4test_*` e o cliente `+5544997770299`;
- pedidos `PIE*` e `PIC*`;
- a loja "Mercado Teste" do e2e;
- o produto "Teste R2 pastel";
- registros de `otp_codes`, `consent_records` e `data_requests` desses usuários.

As sessões sintéticas foram apagadas. Nada foi criado em produção.
