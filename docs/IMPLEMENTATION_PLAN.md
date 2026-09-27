# Plano de Implementação

## Resumo da aplicação

Marketplace de delivery multi-cidade (Palmital/PR em operação). Monorepo pnpm +
Turborepo: `apps/web` (PWA do cliente + landing), `apps/admin` (painel da loja
em `/loja` e da plataforma em `/admin`), `apps/realtime` (Socket.io sobre
Redis), `apps/worker` (BullMQ: notificações, imagens, expiração de Pix,
cobrança de planos, impulsionamento, campanhas). Prisma/PostgreSQL 16, Redis,
MinIO, login por OTP, deploy por GitHub Actions para VPS com Docker Compose.

Usuários e fluxos principais confirmados no código:

- **Cliente**: vitrine da cidade → loja → produto → carrinho (um por loja) →
  checkout → acompanhamento em tempo real → avaliação → pedir novamente.
  Também: busca, pedido por lista, favoritos, endereços, LGPD.
- **Lojista**: painel de pedidos em tempo real com alerta sonoro (aceitar com
  tempo de preparo, avançar status, recusar/cancelar, comanda), cardápio,
  horários, entrega, cupons, financeiro.
- **Plataforma**: lojas, pedidos, usuários, entregadores, planos, banners,
  cupons, campanhas, financeiro, auditoria.

## Principais problemas encontrados

1. **P1 — Checkout aceita endereço de outra cidade.** `lib/checkout.ts` e
   `checkout/actions.ts` buscam o endereço só por `userId`; a página lista os
   endereços de todas as cidades. Com taxa fixa, o pedido passa e a loja
   recebe uma entrega impossível. Contraria a regra de isolamento por cidade
   do `ARCHITECTURE.md`.
2. **P1 — Pedido novo parado sem ninguém ver.** A loja só é avisada pelo
   socket do painel (`publishRealtime` no checkout/webhook). Com o painel
   fechado — lojista no balcão, celular no bolso — o pedido fica em
   "Recebido" indefinidamente e o cliente espera sem saber. Não existe nenhuma
   rotina para pedido não aceito (o worker só expira Pix não pago).
3. **P1 — Expiração de Pix nunca agendada** (achado na implementação).
   `agendarExpiracaoDePedido` e o job `expirarPedido` existem, mas nada chama
   o agendamento: Pix abandonado ficaria em "aguardando pagamento" para
   sempre, segurando o cupom.
4. **P1 — Campanhas do admin falham ao entrar na fila** (achado na
   implementação). Os ids de job usavam `:` (`campanha:<id>`), que o BullMQ 6
   recusa lançando erro no `add`. A campanha era gravada e nunca enviada.
   Produção ainda não tinha campanhas nem Pix presos (conferido no banco).
5. **P2 — "Hoje" e "este mês" em UTC nos painéis** (achado na análise).
   `setHours(0,0,0,0)` no servidor em UTC: às 21h de Brasília o "Encerrados
   hoje" do lojista zerava e o faturamento do dia virava o do dia seguinte.
   Afetava 6 telas (loja, pedidos da loja, financeiro da loja, entregador,
   visão geral e financeiro da plataforma).

## Oportunidades de melhoria

| ID    | TIPO        | SITUAÇÃO ATUAL                                                                    | OPORTUNIDADE                                                                 | ESFORÇO ELIMINADO                                   | BENEFÍCIO                                                 | SOLUÇÃO                                                                                               | PRIORIDADE | RISCO                                       | TESTE                        | STATUS |
| ----- | ----------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------- | ---------------------------- | ------ |
| OP-01 | AUTOMATIZAR | Loja só descobre pedido com o painel aberto                                       | Lembrete automático à equipe da loja quando o pedido passa 3 min sem aceite  | Lojista vigiar a tela; cliente esperar sem resposta | Menos pedido esquecido, cliente atendido mais rápido      | Job atrasado na fila `orderTimeout` → se ainda `RECEIVED`, WhatsApp + push para dono/equipe ativa     | P1         | Aviso repetido (evitado por jobId e status) | Unidade do job + fluxo local | DONE   |
| OP-02 | ANTECIPAR   | Checkout abre sem forma de pagamento; cliente escolhe do zero em todo pedido      | Pré-selecionar a forma usada no último pedido (se a loja aceita)             | Um toque e uma decisão por pedido                   | Checkout em "revisar e confirmar"                         | Buscar `payment.method` do último pedido do cliente e iniciar o estado com ele                        | P1         | Baixo: segue editável e visível             | Navegador                    | DONE   |
| OP-03 | ELIMINAR    | Troco digitado à mão, com vírgula, e recusado se menor que o total                | Atalhos de troco calculados pelo total (Não preciso, próximas notas)         | Digitar valor, errar e corrigir                     | Menos erro de troco, que é o que o entregador esquece     | Chips com valores redondos acima do total                                                             | P2         | Baixo                                       | Navegador                    | DONE   |
| OP-04 | ANTECIPAR   | Para repetir pedido, o cliente vai em Pedidos e procura                           | "Peça de novo" no início com as últimas lojas, um toque recoloca no carrinho | Navegar até Pedidos, rolar, lembrar o que pediu     | Recompra em um toque — o caso mais comum no interior      | Faixa na vitrine com os últimos pedidos entregues, reaproveitando `pedirNovamente`                    | P2         | Baixo                                       | Navegador                    | DONE   |
| OP-05 | ELIMINAR    | Recusar/cancelar exige digitar o motivo no painel da loja, com pedido pingando    | Motivos prontos em um toque (ainda editáveis)                                | Digitar no meio da correria                         | Recusa mais rápida e mensagem mais clara para o cliente   | Chips com motivos comuns preenchendo o campo                                                          | P2         | Baixo                                       | Navegador (painel)           | DONE   |
| OP-06 | ANTECIPAR   | Cartão do pedido mostra só a hora; loja calcula de cabeça quanto tempo passou     | Tempo decorrido e alerta de atraso no cartão; cliente novo identificado      | Conta de cabeça; perguntar se o cliente já comprou  | Prioriza o pedido certo; atenção extra ao primeiro pedido | "há X min" + selo "Atrasado" (preparo + 30 min, mesma regra do admin) + selo "1º pedido" por contagem | P2         | Baixo                                       | Navegador (painel)           | DONE   |
| OP-08 | ANTECIPAR   | Loja fechada só era avisada ao tocar em "Fazer pedido", depois de tudo preenchido | Aviso de loja fechada no próprio checkout, com botão desabilitado            | Preencher o checkout inteiro à toa                  | Cliente sabe na hora e o carrinho fica guardado           | Checagem de horário no cálculo do checkout (mesma função da tela e do envio)                          | P2         | Baixo                                       | Navegador                    | DONE   |
| OP-07 | ELIMINAR    | Telefone do cliente no painel aparece cru (+5544…)                                | Telefone formatado                                                           | Decifrar número                                     | Leitura rápida                                            | `formatPhoneBR`                                                                                       | P3         | Nenhum                                      | Navegador                    | DONE   |

## Plano de execução

| ID    | PRIORIDADE | PROBLEMA                                    | SOLUÇÃO                                                                                                                                                 | ARQUIVOS/ÁREAS                                                                               | RISCO  | TESTE                               | STATUS |
| ----- | ---------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------ | ----------------------------------- | ------ |
| PB-01 | P1         | Endereço de outra cidade aceito no checkout | Filtrar por `cityId` da loja no cálculo, na ação e na lista; mensagem clara se não houver                                                               | `apps/web/src/lib/checkout.ts`, `app/checkout/actions.ts`, `app/checkout/[storeId]/page.tsx` | Baixo  | Navegador + tipos                   | DONE   |
| OP-01 | P1         | Pedido não aceito esquecido                 | Ver tabela de oportunidades                                                                                                                             | `packages/services/src/queues.ts`, `apps/worker`, checkout, webhook                          | Médio  | Unidade + fluxo local com worker    | DONE   |
| PB-02 | P1         | Pix abandonado nunca expira                 | Agendar a expiração no checkout (35 min) só quando o gateway confirma — Pix direto na chave da loja é confirmado à mão e não pode ser cancelado sozinho | `app/checkout/actions.ts`                                                                    | Baixo  | Fila no Redis local                 | DONE   |
| PB-03 | P2         | Dia e mês em UTC nos painéis                | `inicioDoDia`/`inicioDoMes` no fuso de Brasília em `@rapidinho/shared`, com testes, aplicados nas 6 telas                                               | `packages/shared/src/utils/calendario.ts` + painéis                                          | Baixo  | 5 testes de virada de dia/mês       | DONE   |
| PB-04 | P1         | Campanhas nunca entram na fila              | `idDeJob()` com hífen para todos os ids de job, com teste                                                                                               | `packages/services/src/queues.ts`                                                            | Baixo  | Teste + job agendado no Redis local | DONE   |
| OP-02 | P1         | Pagamento sempre em branco                  | Ver tabela                                                                                                                                              | checkout page/formulário                                                                     | Baixo  | Navegador                           | DONE   |
| OP-03 | P2         | Troco manual                                | Ver tabela                                                                                                                                              | checkout formulário                                                                          | Baixo  | Navegador                           | DONE   |
| OP-04 | P2         | Recompra escondida                          | Ver tabela                                                                                                                                              | `app/[cidade]/page.tsx`, `app/pedidos/pedir-novamente.tsx`                                   | Baixo  | Navegador                           | DONE   |
| OP-05 | P2         | Motivo digitado                             | Ver tabela                                                                                                                                              | `apps/admin/src/app/loja/pedidos/painel-de-pedidos.tsx`                                      | Baixo  | Navegador                           | DONE   |
| OP-06 | P2         | Sem noção de tempo/cliente novo             | Ver tabela                                                                                                                                              | painel de pedidos + `page.tsx`/`tipos.ts` do painel                                          | Baixo  | Navegador                           | DONE   |
| OP-07 | P3         | Telefone cru                                | Ver tabela                                                                                                                                              | painel de pedidos                                                                            | Nenhum | Navegador                           | DONE   |

## Ordem de implementação

1. PB-01 (correção de regra, isolada).
2. OP-02 e OP-03 (mesma tela do checkout).
3. OP-01 (fila + worker + pontos de disparo).
4. OP-05, OP-06, OP-07 (mesmo componente do painel da loja).
5. OP-04 (vitrine).
6. Validação completa: tipos, lint, testes, fluxo no navegador (celular e
   notebook), e2e local quando possível, deploy.

## Itens que não serão alterados

- **Cancelamento automático de pedido não aceito**: muda regra de negócio
  (quanto esperar, se reembolsa Pix, se penaliza a loja) — várias
  interpretações válidas. Fica o lembrete (OP-01), que não decide nada pela
  loja.
- **Estrutura de carrinho por loja**: é regra de operação (cada loja despacha
  o seu), documentada no código.
- **Painel da plataforma**: recebeu a gestão de pedidos nesta mesma semana;
  sem fricção nova observada.
- **Landing e identidade visual**: preservadas.

## Bloqueios reais

Nenhum para os itens acima. O envio real de WhatsApp em produção depende de
`WHATSAPP_PROVIDER` configurado com a Evolution API (hoje `fake`); o lembrete
funciona por push e fica pronto para o WhatsApp assim que o provedor for
ligado.
