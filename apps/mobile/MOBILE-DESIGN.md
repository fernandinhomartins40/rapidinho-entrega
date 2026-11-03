# Rapidinho: sistema visual do app nativo

Toda tela segue este documento. Valor novo de cor, tamanho ou raio entra em
`src/tema/tokens.ts`, nunca solto na tela.

## Leitura do app

- **O que é:** delivery de comida, mercado, farmácia e pet de uma cidade do interior.
- **Para quem:** cliente e motoboy, leigos, celular Android simples, sol na rua.
- **Sensação:** vivo, moderno, de marca forte. Direção aprovada pelo dono em
  2026-11-03, a partir das telas de referência que ele enviou.
- **Dials:** expressão 8, movimento 5, densidade 4.

## Direção (referência do dono)

- **Topo azul-noite** (`degradeDaNoite`) com faixas de brilho laranja no canto,
  cantos de baixo bem arredondados. É o `TopoEscuro` de `componentes/topo.tsx`:
  toda tela principal usa ele, com o letreiro na home e título com ícone laranja
  nas demais.
- **Corpo claro** levemente lilás (`cores.fundo`), cartões brancos grandes, raio 24.
- **Atalhos de categoria** em blocos com degradê da cor do segmento e ícone branco.
- **Banner da marca** amarelo-laranja (`degradeDoSol`) com o entregador, quando
  não há campanha no ar.
- **Barra de baixo** branca flutuante com cinco lugares: Início, Pedidos, botão
  laranja "Pedir" elevado no meio (abre a sacola), Favoritos, Perfil.
- **Filtros** em pílula: o escolhido laranja, os outros brancos (`Pilulas`).
- **Status do pedido** em selo colorido (laranja andando, verde entregue, cinza
  cancelado, amarelo aguardando Pix) e trilha de etapas com ícones.
- **Mascote** nos vazios e nas chamadas. Hoje é o entregador de capacete; trocar
  pelo menino de boné quando o dono enviar o PNG sem fundo.

## Escolhas seguras

- Alvo de toque mínimo de 48 dp. Contraste AA em texto, inclusive no topo escuro.
- Tudo respeita a área segura do Android; listas das abas reservam 110 dp no fim
  por causa da barra flutuante.

## Riscos assumidos

- **Cor por categoria.** Ganho: reconhecer farmácia ou mercado sem ler. Custo:
  muitas cores; por isso a cor vem sempre da categoria da loja, nunca por gosto
  da tela.
- **Vitrine de campanha na home.** Ganho: espaço real para o lojista e para o dono
  negociarem desconto. Sem campanha ativa, cai para o banner da marca, nunca para
  um buraco.
- **Botão central "Pedir".** Ganho: a sacola a um toque de qualquer aba. Custo:
  não é aba; a rota `(abas)/pedir` só reserva o lugar.

## Tokens

- **Marca:** laranja `#FF5A1F`, vermelho `#E6192B`, amarelo `#FFC400`.
- **Noite:** `#1C1A2E`, `#2A2742`, `#3B3758`.
- **Categorias:** comida laranja, mercado verde, farmácia azul, bebidas roxo,
  pet rosa, casa turquesa, outros amarelo.
- **Texto:** Bricolage Grotesque em títulos, DM Sans no resto.
- **Forma:** 12 em campos, pílula em botões e filtros, 24 em cartões e folhas.
- **Sombra:** duas alturas apenas, sempre com `elevation` para valer no Android.

## Regras de composição

- Selo só com estado real: aberta, fechada, patrocinada, desconto, status.
- Toda lista tem carregando (esqueleto), vazio com mascote, erro com "Tentar de
  novo" e puxar para atualizar.
- Foto ausente nunca vira quadrado cinza: usa o fundo da categoria com o ícone.
- Nada de botão que não faz nada: sino só quando existir central de avisos,
  microfone só quando houver ditado próprio.
- Sem emoji e sem `Alert.alert`, exceto confirmação destrutiva.
- Ícones só de `lucide-react-native`.
