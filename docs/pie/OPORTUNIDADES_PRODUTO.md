# Oportunidades de produto: o Rapidinho é um app de delivery de verdade?

Auditor-Chefe, 2026-11-02. Base: o parecer do R2 (usuário adversarial, com as jornadas executadas no navegador), a matriz do R4, o código e as correções desta rodada.

A pergunta do dono: o app tem as funções de um aplicativo de entrega, completo e alinhado, para pessoas leigas que pedem comida e compras de mercado?

## Resposta curta

**O núcleo é de um app de delivery de verdade e funciona.** Dá para:

- escolher a cidade, ver as lojas, montar o pedido (inclusive pizza meio a meio e item por peso de mercado);
- pagar em dinheiro, cartão na entrega ou Pix na chave da loja;
- acompanhar em tempo real, avaliar e pedir de novo.

A loja tem um painel completo, e o entregador tem a fila de corridas. A compra principal resistiu a duplo clique e a "voltar" (R2, seção 2).

Ainda **não está completo para o público leigo em larga escala**. Faltam quatro coisas que todo app de delivery tem:

1. avisar o cliente com o app fechado;
2. pagamento online pela plataforma;
3. instalação sem atrito (loja de apps);
4. ver o entregador no mapa.

As três primeiras dependem de decisão e custo do dono, e estão detalhadas abaixo.

## O que existe e foi comprovado

| Função | Situação | Prova |
|---|---|---|
| Escolher a cidade e lembrar dela | Funciona | R2 J2; `/app` com cookie |
| Vitrine por categoria, "Tô com fome" com pratos de vários restaurantes, busca | Funciona; a busca não entende termos regionais ("xis") | R2 J3, R2-017 |
| Produto com complementos obrigatórios e opcionais, pizza por sabores e tamanhos | Funciona; tocar no nome da opção foi corrigido nesta rodada | R2-002 → 6f3ebdf |
| Carrinho, cupom, retirada ou entrega, endereço, troco | Funciona; "Grátis" antes do endereço e troco em texto corrigidos | R2-009, R2-011 → 6f3ebdf |
| Pagamento: dinheiro, cartão na entrega, Pix na chave da loja | Funciona; o Pix da loja agora tem confirmação no painel | R3-001 → 4395f01 |
| Acompanhar o pedido em tempo real | Funciona com o app aberto | R2 J5 |
| Cancelar enquanto a loja não aceitou | **Criado nesta rodada** | c5a6c06, testado |
| Avaliar e pedir de novo | Existe | R4 matriz |
| Favoritos, endereços, conta, exportar e excluir dados (LGPD) | Funciona; a exportação dentro do app foi corrigida | c5a6c06 |
| Mercado: separação, pesagem justa, substituição combinada com o cliente | Existe | R3, R4 matriz |
| Farmácia: foto da receita; item +18 conferido na entrega | Existe; o upload dentro do app foi corrigido (APK 1.1) | R2-016 → c5a6c06 |
| Painel da loja: pedidos com alerta sonoro, cardápio, horários, área de entrega, cupons, avaliações, financeiro, impulsionar | Funciona (fumaça do R4: todas as rotas 200 com o papel certo) | R4 |
| Entregador: fila de corridas da cidade ou da loja, aceite sem disputa, ganhos do dia | Funciona | R1 (corrida atômica), R4 |
| Plataforma: aprovar loja, planos, cupons, banners, campanhas, auditoria, usuários, senha provisória | Funciona | R4 |
| Login "como o WhatsApp" (SMS uma vez, conectado por 400 dias) | Funciona no app Android | R4 RT, entregas anteriores |

## O que falta, por prioridade

Formato: problema → o que muda para o leigo → esforço → quem decide.

### P1. Avisar o cliente com o app fechado *(decisão do dono, com custo)*

- **Problema:** com o app fechado, o cliente não recebe nada. As duas vias de aviso existentes estão desligadas:
  - o WhatsApp está como `fake` por padrão no deploy (`.github/scripts/preparar-env.sh:135`);
  - o push web não funciona dentro da WebView do Android.

  O cliente só vê que o pedido saiu se abrir o app.
- **Para o leigo:** é a diferença entre "o app me avisou que está chegando" e "fiquei abrindo o app".
- **Caminhos:**
  - **(a) WhatsApp pela Evolution API:** já está implementada no código (`WHATSAPP_PROVIDER=evolution`). Exige um número dedicado e um servidor da Evolution. É o caminho mais rápido.
  - **(b) Notificação nativa no APK pelo Firebase Cloud Messaging:** gratuito, mas exige um projeto Firebase.
  - **(c) SMS só para "saiu para entrega":** custa um crédito da SMSDev por pedido.
- **Esforço:** (a) P se já houver servidor; (b) M.

### P2. Pagamento online pela plataforma *(decisão do dono)*

- **Problema:** sem gateway real (`PAYMENT_PROVIDER=fake`), só há Pix na chave da própria loja, confirmado à mão. O cartão pelo app foi escondido nesta rodada porque nunca funcionou: falta a tokenização (R3-008).
- **Para o leigo:** pagar pelo app e o pedido entrar sozinho, sem a loja conferir o extrato.
- **Caminho:** configurar o Mercado Pago (`MERCADOPAGO_ACCESS_TOKEN` e `MERCADOPAGO_WEBHOOK_SECRET`). O webhook ficou robusto nesta rodada (R3-003, R3-004). O cartão exige a tela de tokenização do Mercado Pago.
- **Esforço:** Pix pelo gateway P (configuração); cartão M.

### P3. Instalar sem atrito *(decisão do dono, custo de US$ 25)*

- **Problema:** o APK é instalado "de fonte desconhecida". Para leigo, o aviso do Android assusta, e muitos desistem. Não há app para iPhone; a tela agora é honesta sobre isso (6f3ebdf).
- **Caminho:** publicar na Google Play (conta de desenvolvedor de US$ 25, chave de assinatura própria). Para iPhone, ou um app iOS (conta Apple de US$ 99/ano), ou liberar o login por SMS no navegador do iPhone, com limite agressivo. Esta segunda opção é a hipótese H2 do R2: custo de SMS contra vendas perdidas.
- **Esforço:** Play Store M; iOS G.

### P4. Ver o entregador no mapa

- **Problema:** a ação de localização existe, mas ninguém a chama e ninguém a escuta (R3-023).
- **Caminho:** o painel do entregador envia a posição a cada 15 s enquanto há corrida, e a tela do pedido mostra o mapa.
- **Esforço:** M.

### P5. Equipe da loja *(funcionalidade faltando)*

- **Problema:** o papel "funcionário" existe e entra com senha, mas não há tela para o dono adicionar alguém (R3-019).
- **Caminho:** uma seção "Equipe" em Configurações (nome, e-mail, senha provisória), reaproveitando a lógica de senha provisória criada nesta rodada.
- **Esforço:** P/M.

### P6. Menores, já fundamentados pelo R2

- Busca com sinônimos regionais ("xis", "coca", "refri") (R2-017).
- Enter aplica o cupom (R2-018).
- Painel do lojista legível no celular (R2-021).
- "Reconectando…" com orientação (R2-027).
- Unir endereço e checkout numa tela (hipótese H1 do R2, a validar com usuário).
- Forçar a troca da senha provisória no primeiro acesso (H3).

## Feito nesta rodada pensando no leigo

- O app abre direto nas lojas, não na propaganda (R2-001).
- Tocar no nome da opção marca a opção (R2-002).
- O cadastro de loja não apaga o que foi digitado (R2-003).
- "Reenviar código" com contagem, e telefone formatado (R2-014).
- Número colado com +55 funciona; o telefone certo aparece na conta (R2-010, R2-012).
- Troco "R$ 50" aceito; o frete não promete "Grátis" antes do endereço (R2-009, R2-011).
- O cliente cancela o pedido recém-feito; o nome fica salvo para o próximo (R2-019, R2-015).
- O Pix só aparece quando dá para pagar; o cartão que sempre falhava saiu (A12, A13).
- O lojista confere o Pix na tela; o pedido não some mais (R3-001).
- A landing sem números inventados; "Baixar agora" baixa o app (R2-020, R2-008).
- O entregador e o lojista encontram o caminho certo para entrar (R2-006, R2-007).
- Para iPhone, uma tela honesta, com saída (R2-004).
