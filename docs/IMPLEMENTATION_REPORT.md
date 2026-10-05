# Relatório Final — rodada 2 (2026-10-05)

> O relatório da rodada 1 (2026-09-27) está no histórico do git, no commit
> `4ab4135`.

## Resumo

Esta rodada analisou as passagens entre as três pessoas de cada pedido
(cliente, loja e entregador) e o que entrou no produto depois da rodada 1
(pizza, mercado com pesagem, entregadores de vários comércios). Foram
encontrados três bugs e cinco oportunidades. Todos foram implementados e
validados no navegador, com os servidores locais e o banco de demonstração
(43 lojas, 6.026 pedidos, 3.080 avaliações).

## Melhorias realizadas

- **Avaliações para a loja (nova tela `/loja/avaliacoes`).** O cliente já
  avaliava e comentava, mas nenhuma tela da loja mostrava isso. Agora a loja
  tem uma lista de trabalho "Para responder" (avaliações com comentário ou nota
  até 3 que ainda não foram respondidas), além dos filtros "Notas baixas" e
  "Todas". Cada avaliação mostra o que o cliente pediu e traz respostas prontas
  conforme a nota, que podem ser editadas antes de enviar. O cliente recebe a
  resposta por push. A visão geral avisa quantas avaliações esperam resposta.
- **O cliente vê que foi ouvido.** O acompanhamento do pedido mostra a
  avaliação feita pelo cliente e a resposta da loja.
- **A loja sabe onde está o motoboy.** O cartão do pedido mostra "Procurando
  entregador…", "João aceitou e vem buscar", "João está levando o pedido" ou
  "Entregue por João", com o telefone do entregador. A tela se atualiza
  sozinha.
- **Produto esgotado sai do cardápio no mesmo toque.** Ao recusar com o motivo
  "Produto esgotado", a loja marca quais itens acabaram. Na separação, o item
  em falta ganha o botão "Tirar do cardápio até amanhã". Nos dois casos o
  produto volta sozinho à meia-noite de Brasília.
- **O aviso de entregue abre a avaliação.** "Pedido entregue. Bom apetite!
  Conta pra gente como foi?" leva direto para a tela "Como foi seu pedido?".

## Arquivos e áreas alterados

- `packages/shared/src/domain/order-status.ts`: nova função
  `avisoDeStatusAoCliente`. É a mesma mensagem e o mesmo link, quer quem avance
  o pedido seja a loja ou o entregador.
- `apps/admin/src/app/entregador/actions.ts`: o cliente passa a ser avisado
  quando o entregador avança o pedido.
- `apps/admin/src/app/loja/pedidos/*`: o painel escuta os eventos do
  entregador e mostra a situação da entrega. Também inclui a ação
  `pausarProdutosDoPedido`, os itens para pausar na recusa, o botão na
  separação e a consulta que agora inclui "Saiu para entrega".
- `apps/admin/src/app/loja/avaliacoes/*` e `apps/admin/src/lib/avaliacoes.ts`:
  a tela de avaliações, a ação `responderAvaliacao` e a regra de "para
  responder", que é a mesma na tela e na visão geral.
- `apps/admin/src/components/loja-shell.tsx` e `apps/admin/src/app/loja/page.tsx`:
  item "Avaliações" no menu e aviso na visão geral.
- `apps/web/src/app/pedidos/[id]/*`: avaliação e resposta no acompanhamento.

## Problemas corrigidos

- **P1: a tela da loja não acompanhava o entregador.** O entregador publicava
  `delivery:assigned` e `delivery:status-changed`, mas o painel só escutava os
  eventos `order:*`. Assim, o pedido ficava "Pronto" na tela até chegar outro
  pedido.
- **P1: o cliente ficava sem aviso quando quem avançava era o entregador.** No
  fluxo normal, "saiu para entrega" e "entregue" não geravam push nem
  WhatsApp.
- **P1: as avaliações não tinham dono.** O campo `replyText` existia sem
  nenhuma tela para preenchê-lo (OP-01 e OP-02).
- **P2: o pedido da madrugada sumia da tela da loja** (achado durante a
  validação). Um pedido feito antes da meia-noite que saía para entrega depois
  dela sumia de "Em andamento".

## UX/UI

- A tela nova segue os padrões do painel: `Indicador`, botões de escolha
  rápida (como os motivos de recusa), cartões e a mesma grade da tela de
  pedidos.
- Responsividade: medida em 360, 390, 1024, 1280 e 1440 px, sem rolagem
  horizontal. Em 360 px havia um estouro de 40 px na tela nova, causado pelo
  texto truncado dentro da grade; foi corrigido com `grid-cols-1` e `min-w-0`.
  No celular, os indicadores ficam lado a lado.

## Backend e banco

- A primeira entrega não teve migração: usou campos que já existiam
  (`Review.replyText`, `repliedAt`, `Product.pausedUntil`, `Delivery`). A
  continuação adicionou duas colunas nulas (`pizza_flavors.pausedUntil` e
  `reviews.hiddenAt`), descritas abaixo.
- `responderAvaliacao` usa um `updateMany` com `replyText: null` no filtro.
  Assim, duas pessoas da equipe respondendo ao mesmo tempo não sobrescrevem
  uma à outra.

## Segurança

- As duas ações novas passam por `runStoreAction`. A avaliação e os itens do
  pedido são buscados já filtrados pela loja do vínculo.
- `pausarProdutosDoPedido` recebe ids de **itens do pedido**, nunca de
  produtos. Por isso não dá para pausar o produto de outra loja trocando ids
  no navegador.
- Quando um admin da plataforma opera a loja, as duas ações ficam na
  auditoria, como as demais.
- Na tela, o cliente aparece só pelo primeiro nome.

## Performance e infraestrutura

- A visão geral ganhou um `count` em `reviews`, que usa o índice existente
  `[storeId, createdAt]`. A lista de avaliações é paginada (30 por vez, com
  limite de 300).
- Não há serviço, dependência nem container novo.

## Testes executados

- `pnpm typecheck`: 9 de 9 tarefas ok.
- `pnpm lint`: 9 de 9 tarefas ok.
- `pnpm test`: 174 testes ok (155 em `shared`, 3 deles novos, e 19 em
  `services`). Os testes novos cobrem o aviso de entregue com link para a
  avaliação, os demais status e a meia-noite de "amanhã" no fuso de Brasília.
- No navegador (Edge via Playwright, servidores de dev locais e banco de
  demonstração):
  - Lojista da pizzaria: respondeu uma avaliação com uma resposta pronta, e o
    contador "Para responder" passou de 50 para 49.
  - Cliente desse pedido: viu a avaliação e a resposta no acompanhamento.
  - Mercado: recusou um pedido como "Produto esgotado" marcando a Banana
    prata. O pedido ficou `REJECTED` e só esse produto ficou com
    `pausedUntil = 2026-10-06 03:00 UTC`.
  - Separação: os ovos foram marcados como "Faltou → Tirar do pedido" e depois
    "Tirar do cardápio até amanhã". O item ficou `MISSING` e o produto, pausado.
  - Pizzaria e entregador em telas lado a lado: a loja marcou o pedido como
    pronto e viu "Procurando entregador…". O motoboy aceitou, e a tela da loja
    mostrou "João Entregador aceitou e vem buscar" sem recarregar (o socket
    recebeu `delivery:status-changed`). Depois vieram "Peguei o pedido" e
    "Confirmar entrega". O `notification_logs` do cliente registrou "saiu para
    entrega" e "Pedido entregue. Bom apetite! Conta pra gente como foi?",
    ambos disparados pela ação do entregador.
- **`next build` não foi executado.** Os servidores de dev do projeto já
  estavam rodando na máquina e usam a mesma pasta `.next`. Um build ali
  derrubaria esses servidores. O typecheck e o lint cobrem a compilação, e o
  build roda no CI.

## Itens bloqueados

Nenhum.

## Continuação: o que tinha ficado de fora

Depois da primeira entrega desta rodada, os três itens que tinham ficado de
fora foram implementados e validados no navegador.

### Sabor de pizza esgotado (OP-06)

- Duas migrações aditivas, aplicadas no banco local e rodadas pelo deploy com
  `prisma migrate deploy`:
  - `20261005120000_pausa_de_sabor` cria `pizza_flavors.pausedUntil`;
  - `20261005130000_moderacao_de_avaliacao` cria `reviews.hiddenAt`.

  As duas colunas são nulas, então nenhum dado existente muda.

- `isAvailable` do sabor continua sendo a exclusão. A pausa ("acabou hoje") é
  um campo separado e volta sozinha à meia-noite de Brasília.
- O filtro `saborDisponivelAgora` (`apps/web/src/lib/sabores.ts`) é usado em
  todos os lugares onde um sabor aparece ou é validado: montador, "Tô com
  fome", vitrine, carrinho, validação do item e "pedir de novo". Assim, um
  sabor pausado não aparece numa tela e passa em outra.
- Recusa por "Produto esgotado" num pedido de pizza: aparece "Sabor
  Mussarela". Quando o pedido tem uma opção só, ela já vem marcada.
- A tela Pizzas do painel mostra "Esgotado até amanhã" e tem um botão para
  pausar ou retomar cada sabor.

### Loja e motoboy sem informação conflitante (OP-07)

- **Motoboy da plataforma a caminho:** "Saiu para entrega" some do cartão da
  loja, e o servidor também recusa essa mudança. O cartão explica: "ele marca a
  saída ao retirar".
- **"Entregue" pela loja continua disponível** como saída de emergência e
  atualiza a corrida:
  - se o motoboy já tinha retirado, a corrida vira entregue e conta para ele;
  - se ele ainda não tinha retirado, ou ninguém aceitou, a corrida é cancelada.
- **Loja despacha com motoboy próprio:** a corrida sai da fila dos
  entregadores.

### Comentários públicos com moderação (OP-08)

- A página da loja mostra os últimos 5 comentários, bons e ruins, com a
  resposta da loja e só o primeiro nome do cliente. A nota no topo leva até
  eles.
- Os termos já diziam que a avaliação é pública e proibiam ofensas. A
  plataforma pode ocultar um comentário no detalhe do pedido em `/admin`
  ("Ocultar comentário (ofensa)" e "Mostrar de novo na loja"). A ação fica na
  auditoria (`review.hidden` e `review.shown`). A nota continua na média, e a
  loja vê na tela dela que o comentário foi ocultado.

### Testes da continuação

- `pnpm typecheck` e `pnpm lint`: 9 de 9 tarefas ok. `pnpm test`: 174 testes
  ok.
- No navegador:
  - **Pizza esgotada:**
    - pedido de pizza criado pelo cliente (montador → carrinho → checkout);
    - a loja recusou como esgotado, o pedido ficou `REJECTED` e a Mussarela
      ficou com `pausedUntil = 2026-10-06 03:00 UTC`;
    - a Mussarela sumiu do montador (26 → 25 sabores), apareceu como
      "Esgotado até amanhã" no painel e voltou ao montador depois de retomada
      pelo botão.
  - **Motoboy a caminho:** com o motoboy aceito, a loja só viu "Entregue",
    "Comanda" e "Cancelar". "Entregue" deixou a corrida `CANCELLED` e ela
    sumiu do app do motoboy.
  - **Motoboy retirou e a loja confirmou a entrega:** a corrida ficou
    `DELIVERED` e as entregas do João foram de 1 para 2.
  - **Despacho próprio:** a corrida ficou `CANCELLED` e saiu da fila.
  - **Página pública e moderação:** 5 comentários na página pública, sem
    rolagem horizontal em 360 px. O admin ocultou um comentário, que saiu da
    página, com `review.hidden` na auditoria. Era um elogio legítimo usado só
    no teste, e voltou a ficar visível.
- **Servidores de dev reiniciados.** Os servidores que já rodavam na máquina
  tinham o client do Prisma antigo em memória e quebravam com o campo novo
  ("Unknown argument `pausedUntil`"). Por isso foram reiniciados nas mesmas
  portas: web 3000, painel 3001 e realtime 3002.

## Riscos restantes

- **WhatsApp em produção** continua com `WHATSAPP_PROVIDER=fake` (registrado
  na rodada 1). Até a Evolution API ser configurada, os avisos ao cliente
  chegam por push.
- **Migrações na VPS:** as duas são aditivas e rodam no deploy. Os servidores
  que estiverem em execução precisam do client novo, o que o próprio deploy
  resolve ao recriar os containers.

## Próximas melhorias recomendadas

- **Cancelamento automático de pedido não aceito**: depende de decisão de
  negócio (prazo, reembolso e penalidade). Por enquanto existe só o lembrete.
