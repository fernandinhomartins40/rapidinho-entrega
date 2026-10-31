# Jornadas por perfil e avaliação de produto

Cada jornada é uma tarefa real, executada em runtime do início ao fim, com o
usuário do seed daquele perfil e viewport de celular. Ela serve a duas frentes
ao mesmo tempo: **funciona?** (fio completo, PROTOCOLO.md §1.4) e **é simples?**
(passos, campos, dúvidas).

## Como contar passos

- **Passo** = um momento em que a pessoa precisa decidir ou agir para avançar:
  um toque que troca de tela, abre um painel que exige escolha ou envia um
  formulário. Rolar a tela e fechar aviso não contam.
- Conta-se do **ponto de entrada natural** (o app aberto, já logado, na tela
  inicial daquele perfil) até o **estado final verificável** da tarefa.
- Anote também: **campos digitados** (o que mais pesa, segundo o Baymard),
  **escolhas obrigatórias** e **pontos de dúvida** — onde alguém sem prática
  pararia sem saber o próximo passo (percurso cognitivo).
- Meta: tarefas principais em **até 3 passos** quando a natureza da tarefa
  permitir. Quando não couber (cadastro de loja, primeiro pedido com endereço
  novo), a meta é não ter passo nem campo que o sistema poderia preencher
  sozinho.

Para cada passo, responda as quatro perguntas do percurso cognitivo:

1. A pessoa sabe o que precisa fazer aqui?
2. Ela enxerga o controle certo?
3. Ela entende que aquele controle faz o que ela quer?
4. Depois de agir, ela percebe que deu certo?

E confira as 10 heurísticas de Nielsen, com atenção especial a: estado do
sistema visível (pedido mudou? salvou?), linguagem do usuário (sem "status",
"slug", "SKU"), prevenção de erro (confirmação antes de cancelar pedido),
reconhecimento em vez de memória (endereço e pagamento lembrados).

## Modelo de registro

```
### C1 — Primeiro pedido
Resultado: ok | falha (R3-xxx) | bloqueada (motivo)
Passos: medido N (meta 3) · Campos: N · Dúvidas: N
Fio verificado: tela ✔ banco ✔ evento ✔ fila ✔ aviso ✔ outra sessão ✔ recarga ✔
Evidência: docs/revisao/evidencias/fase2/C1/ (trace.zip, prints, consultas.sql)
Observações de produto: ...
Proposta (se houver): antes N passos / M campos → depois N' / M'
```

## Cliente (apps/web, porta 3000)

| Id  | Tarefa                                        | Estado final verificável                                         | Fio a conferir                                                                                                                                                              |
| --- | --------------------------------------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | Primeiro pedido, sem conta, com endereço novo | `Order` criado, loja vê o pedido na hora                         | OTP → `User`+`Session` · `Address` · `Cart`→`Order`/`OrderItem` com preço do banco · `Payment` · evento `orderCreated` no canal da loja · aviso à loja · carrinho esvaziado |
| C2  | Pedido de quem já tem conta e endereço        | idem                                                             | endereço e pagamento lembrados; meta **3 passos** (loja → item → confirmar)                                                                                                 |
| C3  | Acompanhar o pedido até entregue e avaliar    | `Review` gravada, loja vê em `/loja/avaliacoes`                  | tela muda sozinha a cada status; push/WhatsApp (log em dev); link do aviso abre a avaliação                                                                                 |
| C4  | Pedir novamente um pedido antigo              | carrinho com os mesmos itens, preços atuais                      | item esgotado/removido tratado com aviso, não some calado                                                                                                                   |
| C5  | Pagar com Pix e deixar expirar                | pedido cancelado/expirado, estoque e cupom liberados             | job do worker; webhook fake; tela do cliente e da loja                                                                                                                      |
| C6  | Pizza meio a meio com extra                   | `OrderItemPizzaFlavor`/`Extra` gravados, regra de preço aplicada | preço da tela = preço gravado = regra `PizzaPricingRule`                                                                                                                    |
| C7  | Mercado: item por peso e resposta de troca    | `OrderItem` com peso e substituição respondida                   | `responderTroca` grava e a loja vê; valor final recalculado                                                                                                                 |
| C8  | Farmácia com receita                          | `MediaAsset` `PRESCRIPTION` ligado ao pedido, só a loja vê       | upload privado; outro usuário não acessa a URL                                                                                                                              |
| C9  | Montar pedido por lista (`/[cidade]/pedir`)   | itens reconhecidos no carrinho                                   | lista → produtos certos; itens não achados avisados                                                                                                                         |
| C10 | Sessão em grupo "Fome"                        | placar com votos de 2 aparelhos                                  | link compartilhável; voto de visitante; expiração                                                                                                                           |
| C11 | Cupom no checkout                             | desconto gravado em `CouponRedemption`                           | limite por usuário; cupom expirado; cupom de outra loja                                                                                                                     |
| C12 | Gerenciar endereços                           | padrão trocado reflete no checkout                               | excluir endereço usado em pedido antigo não quebra o histórico                                                                                                              |
| C13 | Exportar meus dados e excluir a conta         | arquivo com todos os dados; conta anonimizada; login novo falha  | ver LGPD.md                                                                                                                                                                 |
| C14 | Cidade sem atendimento (`/minha-cidade`)      | `CityInterest` gravado                                           | quem vê isso depois? (admin?)                                                                                                                                               |

## Loja (apps/admin, porta 3001, `/loja`)

| Id  | Tarefa                                         | Estado final verificável                                    | Fio a conferir                                                                                             |
| --- | ---------------------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| L1  | Cadastro da loja até receber o primeiro pedido | loja `ACTIVE`, aberta, com produto, aparece na cidade       | `/cadastro-loja` (web) → aprovação no `/admin` → acesso ao painel → produto → horário → vitrine do cliente |
| L2  | Receber, aceitar, preparar e despachar pedido  | `Order` `OUT_FOR_DELIVERY`/`DELIVERED`, histórico gravado   | alerta sonoro; `OrderStatusHistory`; cliente notificado a cada etapa; corrida criada                       |
| L3  | Recusar por "produto esgotado" e pausar o item | pedido cancelado, produto indisponível até meia-noite       | cliente avisado; reembolso/estorno do pagamento; produto volta sozinho                                     |
| L4  | Separação de mercado com falta e troca         | itens separados, valor final, troca proposta ao cliente     | cliente responde (C7); pagamento ajustado                                                                  |
| L5  | Cadastrar produto rápido com foto              | produto visível no app do cliente                           | upload → `MediaAsset` → fila de imagem → miniaturas → vitrine                                              |
| L6  | Importar planilha de produtos                  | produtos criados/atualizados, erros por linha               | reimportar não duplica                                                                                     |
| L7  | Pausar a loja agora e retomar                  | cliente não consegue pedir; volta a conseguir               | carrinho aberto de cliente durante a pausa                                                                 |
| L8  | Configurar entrega (raio/zona/taxa)            | taxa certa no checkout de um endereço em cada zona          | regra em `packages/shared` = valor gravado no pedido                                                       |
| L9  | Responder avaliação                            | `replyText` gravado, cliente vê no pedido                   | push ao cliente                                                                                            |
| L10 | Chamar entregador avulso                       | `Errand` criado e aceito por entregador                     | entregador vê na hora; loja vê quem aceitou                                                                |
| L11 | Criar cupom e ver usado                        | cupom aplicado em C11                                       |                                                                                                            |
| L12 | Ver financeiro do mês                          | números batem com os pedidos do banco                       | repasses (`Payout`) — ver R3-004                                                                           |
| L13 | Contratar plano/destaque                       | `StoreSubscription`/`StoreBoost`, loja destacada na vitrine | cobrança no worker; expiração                                                                              |

## Entregador (apps/admin, `/entregador`)

| Id  | Tarefa                                            | Estado final verificável                    | Fio a conferir                                                                             |
| --- | ------------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------ |
| E1  | Cadastro (web `/entregador`) até primeira corrida | `Courier` aprovado, vê corridas             | aprovação no `/admin`; documentos (ver R3-006)                                             |
| E2  | Ficar disponível, aceitar, retirar, entregar      | `Delivery` `DELIVERED`, `Order` `DELIVERED` | loja e cliente veem cada etapa em tempo real; dois entregadores disputando a mesma corrida |
| E3  | Corrida avulsa da loja                            | `Errand` concluído                          |                                                                                            |
| E4  | Localização durante a entrega                     | ?                                           | ver R3-003: a ação existe, nada chama e nada escuta                                        |

## Plataforma (apps/admin, `/admin`)

| Id  | Tarefa                                  | Estado final verificável                     |
| --- | --------------------------------------- | -------------------------------------------- |
| A1  | Aprovar loja nova                       | loja `ACTIVE`, dono avisado, `AuditLog`      |
| A2  | Aprovar entregador                      | `Courier` aprovado, avisado, `AuditLog`      |
| A3  | Cancelar pedido pela plataforma         | cliente e loja avisados, pagamento estornado |
| A4  | Enviar campanha de push para uma cidade | `NotificationCampaign` + logs, push recebido |
| A5  | Entrar como lojista e **sair**          | `ImpersonationLog` aberto e fechado (R3-002) |
| A6  | Abrir cidade nova com bairros           | cidade aparece no app, endereço aceito       |
| A7  | Bloquear usuário                        | sessões revogadas, login falha               |
| A8  | Atender pedido LGPD (`DataRequest`)     | pedido listado e concluído (R3-001b)         |

## Ponta a ponta (três perfis ao mesmo tempo)

| Id  | Cenário                                                                                         |
| --- | ----------------------------------------------------------------------------------------------- |
| X1  | Cliente pede, loja aceita, entregador entrega — três navegadores abertos, nenhum recarregamento |
| X2  | Loja não aceita a tempo: lembrete e expiração automática pelo worker                            |
| X3  | Webhook de pagamento chega duas vezes e fora de ordem                                           |
| X4  | Realtime cai e volta: as telas se recuperam sem pedido "perdido"                                |
| X5  | Worker parado: o que o usuário vê? Ao voltar, a fila é processada?                              |

## Hipóteses de produto a validar

Levantadas na leitura do código; a frente de produto confirma ou descarta em
runtime e mede o antes/depois.

1. **Painel da loja com 15 itens de menu.** Para um lojista leigo é muita
   escolha. Proposta inicial em 6 grupos: _Pedidos_ · _Cardápio_ (produtos,
   categorias, complementos, pizzas, importar) · _Entregas_ (regras e zonas,
   chamar entregador, entregadores) · _Minha loja_ (dados, horários, pagamentos)
   · _Vender mais_ (cupons, plano e destaque, avaliações) · _Financeiro_.
   Categorias poderiam ser editadas dentro de Produtos, sem tela própria.
2. **Login no meio da compra.** Adicionar ao carrinho exige login
   (`runAuthedAction`). O cliente é interrompido no primeiro toque de compra.
   Avaliar carrinho de visitante com login só no "confirmar pedido".
3. **Endereço novo fora do checkout.** Cadastrar endereço leva a
   `/enderecos/novo` e volta. Avaliar endereço inline no checkout, com
   preenchimento pelo CEP/localização.
4. **Entregador em dois apps.** O cadastro é no app do cliente (`/entregador`
   no web) e o trabalho no painel (porta 3001/subdomínio). Conferir se a
   passagem é guiada ou se o entregador fica perdido.
5. **Lojista entre dois domínios.** `/cadastro-loja` fica no web; depois da
   aprovação o lojista usa o painel. Como ele descobre o endereço do painel?
6. **Primeira configuração da loja.** Horários, entrega, pagamentos e
   produtos estão em telas separadas. Avaliar um "primeiros passos" na visão
   geral com checklist do que falta para abrir.
