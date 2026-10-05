# Plano de Implementação — rodada 2 (2026-10-05)

> A rodada 1 (2026-09-27: endereço de outra cidade, lembrete de pedido parado,
> expiração de Pix, fila de campanhas, fuso horário, checkout em "revisar e
> confirmar") está concluída e registrada no histórico do git
> (`4ab4135`). Esta rodada parte do que entrou depois dela — pizza, mercado
> com pesagem, entregadores de vários comércios — e das pendências que a
> rodada 1 deixou registradas.

## Resumo da aplicação

Marketplace de delivery multi-cidade (Palmital/PR). Monorepo pnpm + Turborepo:
`apps/web` (PWA do cliente), `apps/admin` (painel da loja em `/loja`, do
entregador em `/entregador` e da plataforma em `/admin`), `apps/realtime`
(Socket.io sobre Redis), `apps/worker` (BullMQ). Prisma/PostgreSQL 16, Redis,
MinIO, login por OTP, deploy por GitHub Actions em VPS com Docker Compose.

Três pessoas usam o sistema no mesmo pedido: **cliente** (pede e acompanha),
**loja** (aceita, prepara, separa) e **entregador** (pega a corrida, retira,
entrega). Esta rodada olhou principalmente as passagens entre elas.

## Principais problemas encontrados

1. **P1 — Tela da loja não acompanha o entregador.** `avancarCorrida` e
   `aceitarCorrida` (`apps/admin/src/app/entregador/actions.ts`) publicam
   `delivery:assigned` e `delivery:status-changed` no canal da loja, mas o
   painel de pedidos só escuta eventos `order:*`. Quando o motoboy retira ou
   entrega, o pedido continua "Pronto" na tela da loja até outro pedido
   chegar — e a loja não sabe se alguém pegou a corrida.
2. **P1 — Cliente não é avisado quando quem avança é o entregador.** A loja
   marcando "Saiu para entrega"/"Entregue" dispara push + WhatsApp; o
   entregador marcando a mesma coisa não dispara nada. Com entregador da
   plataforma (o fluxo normal desde `fdda585`), o cliente que fechou o app não
   sabe que o pedido saiu nem que chegou.
3. **P1 — Avaliações sem dono.** O cliente avalia a loja e escreve comentário
   (3.080 avaliações no banco de demonstração), o modelo tem `replyText` e
   `repliedAt` para a resposta da loja e o painel da plataforma já exibe a
   resposta — mas não existe nenhuma tela em `/loja` para ler ou responder.
   O comentário só é lido pelo admin da plataforma.

4. **P2 — Pedido da madrugada some da tela da loja** (achado na
   validação). A tela de pedidos carrega "em aberto" ou "criados hoje", e
   "em aberto" não incluía "Saiu para entrega". Pedido feito antes da
   meia-noite que sai depois dela sumia de "Em andamento" com o motoboy ainda
   na rua.

## Oportunidades de melhoria

| ID    | TIPO      | SITUAÇÃO ATUAL                                                              | OPORTUNIDADE                                                                                     | ESFORÇO ELIMINADO                                                     | BENEFÍCIO                                                    | SOLUÇÃO                                                                                                                                                                                       | PRIORIDADE | RISCO                                   | TESTE             | STATUS |
| ----- | --------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | --------------------------------------- | ----------------- | ------ |
| OP-01 | CRIAR     | Loja não vê avaliações nem comentários; `replyText` sem tela                | Tela "Avaliações" com nota, comentário, pedido e resposta; pendentes primeiro                    | Ligar para a plataforma para saber o que o cliente achou              | Loja corrige o que o cliente reclama e recupera o cliente    | `/loja/avaliacoes` + ação `responderAvaliacao` (filtrada pela loja do vínculo) + item no menu + contador na visão geral                                                                       | P1         | Baixo: só a loja dona responde, uma vez | Tipos + navegador | DONE   |
| OP-02 | JUNTAR    | Cliente avalia e nunca sabe se alguém leu                                   | Resposta da loja aparece no acompanhamento do pedido e chega por push                            | —                                                                     | Cliente sente que foi ouvido                                 | Exibir a própria avaliação + resposta em `/pedidos/[id]`; push ao responder                                                                                                                   | P2         | Baixo                                   | Navegador         | DONE   |
| OP-03 | ANTECIPAR | Loja não sabe se a corrida foi pega nem por quem                            | Situação do entregador no cartão: "Procurando entregador", "Fulano vai buscar", "Fulano levando" | Ligar para o motoboy / sair na porta para ver                         | Loja sabe quando embalar e quem vai chegar                   | Incluir `delivery` no carregamento do painel e escutar `delivery:*`                                                                                                                           | P1         | Baixo                                   | Navegador         | DONE   |
| OP-04 | JUNTAR    | "Produto esgotado" ou item "Em falta" não tira o produto do cardápio        | Pausar o produto até amanhã no mesmo toque em que a loja recusa ou marca a falta                 | Ir em Produtos, achar o item e pausar — ou receber outro pedido igual | Próximo cliente não pede o que acabou                        | Ação `pausarProdutosDoPedido` (itens do pedido, filtrada pela loja); ao escolher "Produto esgotado" a loja marca os itens (já marcado quando o pedido tem um item só); botão no item em falta | P2         | Baixo: pausa volta sozinha à meia-noite | Tipos + navegador | DONE   |
| OP-05 | ANTECIPAR | Aviso de "entregue" leva para o acompanhamento; avaliar exige achar o botão | Aviso de entregue abre direto "Como foi seu pedido?"                                             | Um toque e a procura pelo botão                                       | Mais avaliações, no momento em que a experiência está fresca | `url` da notificação de `DELIVERED` aponta para `/pedidos/[id]/avaliar` (que já redireciona se avaliado)                                                                                      | P2         | Nenhum                                  | Navegador         | DONE   |

## Plano de execução

| ID    | PRIORIDADE | PROBLEMA                                         | SOLUÇÃO                                                                                         | ARQUIVOS/ÁREAS                                                                    | RISCO  | TESTE              | STATUS |
| ----- | ---------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ------ | ------------------ | ------ |
| PB-01 | P1         | Painel da loja surdo aos eventos do motoboy      | Escutar `delivery:assigned` e `delivery:status-changed` no painel                               | `apps/admin/src/app/loja/pedidos/painel-de-pedidos.tsx`                           | Baixo  | Navegador (2 abas) | DONE   |
| PB-02 | P1         | Cliente sem aviso quando o motoboy avança        | `notificarUsuario` em `avancarCorrida`, igual ao da loja, com a mesma `tag`                     | `apps/admin/src/app/entregador/actions.ts`                                        | Baixo  | Navegador + banco  | DONE   |
| PB-03 | P2         | Pedido "Saiu para entrega" de ontem some da tela | Consulta da tela inclui `OUT_FOR_DELIVERY`; o contador do menu continua só com o que exige ação | `apps/admin/src/app/loja/pedidos/page.tsx`                                        | Baixo  | Navegador          | DONE   |
| OP-03 | P1         | Ver tabela                                       | Ver tabela                                                                                      | `loja/pedidos/page.tsx`, `tipos.ts`, `painel-de-pedidos.tsx`                      | Baixo  | Navegador          | DONE   |
| OP-01 | P1         | Ver tabela                                       | Ver tabela                                                                                      | `apps/admin/src/app/loja/avaliacoes/*`, `loja-shell.tsx`, `loja/page.tsx`, shared | Baixo  | Tipos + navegador  | DONE   |
| OP-02 | P2         | Ver tabela                                       | Ver tabela                                                                                      | `apps/web/src/app/pedidos/[id]/*`                                                 | Baixo  | Navegador          | DONE   |
| OP-04 | P2         | Ver tabela                                       | Ver tabela                                                                                      | `loja/pedidos/actions.ts`, `painel-de-pedidos.tsx`, `separacao-do-pedido.tsx`     | Baixo  | Navegador          | DONE   |
| OP-05 | P2         | Ver tabela                                       | Ver tabela                                                                                      | `loja/pedidos/actions.ts`, `entregador/actions.ts`                                | Nenhum | Revisão + banco    | DONE   |

## Ordem de implementação

1. PB-01, PB-02 e OP-03 (mesma passagem loja ↔ entregador ↔ cliente).
2. OP-05 (mesmos pontos de notificação).
3. OP-04 (painel de pedidos e separação).
4. OP-01 e OP-02 (avaliações, ponta a ponta).
5. Validação: tipos, lint, testes, build, fluxo no navegador em celular e
   notebook.

## Continuação — o que tinha ficado de fora (mesmo dia)

A pedido do usuário, os três itens deixados de fora foram implementados.

| ID    | TIPO     | SITUAÇÃO ATUAL                                                                                                   | SOLUÇÃO                                                                                                                                                                                      | ARQUIVOS/ÁREAS                                                                                      | RISCO                                        | TESTE                         | STATUS |
| ----- | -------- | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | -------------------------------------------- | ----------------------------- | ------ |
| OP-06 | JUNTAR   | Pizza não tem produto: "esgotado" não oferecia nada para pausar; `PizzaFlavor` só tinha `isAvailable` (exclusão) | `PizzaFlavor.pausedUntil` (migração aditiva), filtro único `saborDisponivelAgora` no app do cliente, sabores na recusa por esgotado e botão pausar/retomar na tela de Pizzas                 | `packages/database`, `apps/web/src/lib/sabores.ts` + 5 consultas, `loja/pizzas/*`, `loja/pedidos/*` | Baixo: coluna nula, volta sozinho            | Navegador + banco             | DONE   |
| OP-07 | ELIMINAR | Loja podia marcar "Saiu para entrega"/"Entregue" com motoboy da plataforma a caminho, sem mexer na corrida       | Com motoboy a caminho, a saída é dele (botão some e o servidor recusa); "Entregue" da loja continua e sincroniza a corrida; despacho próprio tira a corrida da fila                          | `loja/pedidos/actions.ts`, `painel-de-pedidos.tsx`                                                  | Baixo: a loja sempre tem uma saída           | Navegador (3 caminhos)        | DONE   |
| OP-08 | CRIAR    | Comentários só visíveis para loja e plataforma, embora os termos digam que a avaliação é pública                 | Últimos 5 comentários (bons e ruins) na página da loja, com primeiro nome e resposta; moderação da plataforma (`Review.hiddenAt`) com auditoria; a loja vê quando um comentário foi ocultado | `[cidade]/[loja]/page.tsx`, `admin/pedidos/*`, `loja/avaliacoes/*`, `packages/database`             | Baixo: ofensa ocultável, nota segue na média | Navegador + banco + auditoria | DONE   |

## Itens que não serão alterados

- **Cancelamento automático de pedido não aceito**: mesma razão da rodada 1.
- **Landing, identidade visual e redesign recente (`8fddff5`)**: preservados.
- **Seed de demonstração**: os pedidos "em andamento" com corrida já retirada
  não vêm do seed (o histórico deles termina em "Entregue"); o status foi
  alterado direto no banco local depois do seed. Não é defeito do código.

## Bloqueios reais

Nenhum. O WhatsApp em produção continua com `WHATSAPP_PROVIDER=fake`
(registrado na rodada 1); os avisos novos usam os mesmos canais e passam a
chegar por WhatsApp assim que o provedor for ligado.
