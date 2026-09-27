# Relatório Final

## Resumo

A análise cobriu os fluxos do cliente, do lojista e da plataforma, com foco no
caminho do pedido: vitrine → carrinho → checkout → loja aceitar → entregar →
repetir. O critério foi o do protocolo: o que o usuário faz para o sistema que
o sistema poderia fazer por ele. O plano está em `docs/IMPLEMENTATION_PLAN.md`.

O resultado foram 4 bugs corrigidos (3 deles P1) e 8 melhorias de produto,
todos testados. Três dos bugs apareceram durante a implementação e a
validação, não na leitura do código.

## Melhorias realizadas

**Cliente**

- **Peça de novo** (OP-04): a vitrine mostra os últimos pedidos entregues, um
  por loja, e um toque devolve os itens ao carrinho.
- **Pagamento já marcado** (OP-02): o checkout vem com a forma de pagamento do
  último pedido, se a loja aceitar. Loja com uma forma só também vem marcada.
- **Troco em um toque** (OP-03): atalhos com valores redondos acima do total
  (R$ 23,89 → "Não preciso", R$ 30, R$ 50, R$ 100).
- **Loja fechada avisada na hora** (OP-08): o aviso aparece no checkout, com o
  botão desabilitado. Antes o cliente só descobria no último toque.
- **Carrinho sem linhas repetidas**: repetir um pedido ou mandar a mesma lista
  soma na mesma linha quando o item é simples.

**Lojista**

- **Lembrete automático de pedido sem aceite** (OP-01): 3 minutos depois do
  pedido, se ele continuar em "Recebido", a equipe ativa da loja recebe
  WhatsApp e push. O lembrete não cancela nada.
- **Cartão do pedido informa o tempo** (OP-06): "há X min", o selo "Esperando
  há X min" depois de 3 min sem aceite e "Atrasado X min" quando passa do
  tempo de preparo prometido.
- **Selo "1º pedido"**: marca o cliente que ainda não recebeu nada da loja.
- **Motivos prontos para recusar ou cancelar** (OP-05), que continuam
  editáveis.
- **Telefone formatado** (OP-07).

## Arquivos e áreas alteradas

- `apps/web`: `lib/checkout.ts`, `app/checkout/*`, `app/[cidade]/page.tsx`,
  `app/carrinho/actions.ts`, `app/pedidos/actions.ts`,
  `app/api/webhooks/pagamento/route.ts`, `components/app/peca-de-novo.tsx`.
- `apps/admin`: `app/loja/pedidos/*` e as telas com "hoje" ou "mês"
  (`loja/page.tsx`, `loja/financeiro`, `entregador`, `admin/page.tsx`,
  `admin/financeiro`, `admin/pedidos`).
- `apps/worker`: `jobs/order-reminder.ts` e o despacho por nome em `main.ts`.
- `packages/services`: `queues.ts` (`idDeJob`, `agendarLembreteDaLoja`) e um
  teste.
- `packages/shared`: `utils/calendario.ts` e os testes.
- `packages/database`: log do seed de e2e (aviso de lint).

## Problemas corrigidos

- **P1 — Endereço de outra cidade aceito no checkout** (PB-01). Agora é
  filtrado na lista, bloqueado no cálculo com mensagem e barrado na ação. A
  ação também passou a recusar endereço excluído.
- **P1 — Pix abandonado nunca expirava** (PB-02). A expiração passa a ser
  agendada em 35 min quando quem confirma o pagamento é o gateway. Pix direto
  na chave da loja fica de fora de propósito: quem confirma é o lojista, e
  cancelar sozinho derrubaria um pedido já pago.
- **P1 — Campanhas do admin nunca entravam na fila** (PB-04). O BullMQ 6
  recusa `:` no id do job. A produção ainda não tinha campanhas, conferido no
  banco.
- **P2 — "Hoje" e "mês" calculados em UTC** (PB-03), em 6 telas dos painéis.

## UX/UI

- Os fluxos principais perderam passos: repetir pedido passou de navegar,
  achar e tocar para um toque na vitrine; o checkout virou revisar e
  confirmar.
- O painel da loja passou a dizer o que antes era conta de cabeça: tempo
  decorrido, atraso e primeiro pedido.
- Responsividade conferida:
  - 360px (celular pequeno) e 390px (iPhone) no app;
  - 768px (tablet) e 1280px (notebook) no painel da loja;
  - nenhuma rolagem horizontal.

## Backend e banco

- Nenhuma migração nova.
- O "1º pedido" usa um único `groupBy` por carga do painel, não uma consulta
  por pedido.

## Segurança

- A regra de cidade no checkout agora vale nas três camadas: tela, cálculo e
  ação.
- O lembrete só notifica equipe ativa da loja, com usuário ativo e não
  excluído.
- Nenhuma permissão foi alterada e nenhum segredo foi exposto.

## Performance e infraestrutura

- Nenhum serviço, container ou dependência novo.
- O lembrete usa a fila `order-timeout` que já existia, separando os jobs pelo
  nome, sem worker novo.

## Testes executados

- `pnpm typecheck`: 9 de 9 pacotes ok.
- `pnpm lint`: 9 de 9 pacotes ok, com zero avisos.
- `pnpm test`:
  - `shared`: 104 testes, 5 deles novos de virada de dia e mês;
  - `services`: 19 testes, 1 novo de id de job.
- Prettier (`format:check`): ok nos arquivos do projeto.
- Fluxo real no navegador, com Postgres, Redis, web, painel e worker locais:
  - login do cliente;
  - "Peça de novo" com 4 cartões;
  - checkout com dinheiro pré-selecionado e troco de R$ 30 em um toque;
  - pedido criado;
  - lembrete agendado no Redis (`lembrar-loja-<id>`) e disparado pelo worker
    3 min depois, com WhatsApp registrado como `SENT` para o dono da loja;
  - painel da loja com "há X min", "Esperando há X min", telefone formatado e
    "Produto esgotado" em um toque;
  - endereço de outra cidade fora da lista e bloqueado quando forçado pela
    URL.
- Loja fechada no checkout: com a loja pausada no banco local, o checkout
  abriu já mostrando "Pausa de teste. Seu carrinho fica guardado para quando
  ela abrir." e o botão desabilitado.

## Itens bloqueados

Nenhum.

## Riscos restantes

- **WhatsApp em produção**: continua com `WHATSAPP_PROVIDER=fake`. O lembrete
  por WhatsApp só chega de verdade quando a Evolution API for configurada.
  Até lá, o que funciona é o push, e só para quem aceitou notificações no
  aparelho.
- **Worker em modo dev** (`pnpm dev` com `tsx watch`): não sobe por um
  problema de interop de módulo anterior a este trabalho. O build de produção
  do worker funciona e foi usado nos testes.

## Próximas melhorias recomendadas

- **Cancelamento automático de pedido não aceito**: depende de decisão de
  negócio (prazo, reembolso, penalidade), por isso ficou só o lembrete.
- **Motivo "Produto esgotado" pausando o produto**: juntaria as duas ações
  numa só, mas precisa escolher qual item pausar.
- **Nomes de loja cortados em 360px** quando há o selo "Patrocinado": é
  anterior a este trabalho e só estético.
