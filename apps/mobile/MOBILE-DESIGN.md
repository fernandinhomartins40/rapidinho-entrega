# Rapidinho: sistema visual do app nativo

Toda tela segue este documento. Valor novo de cor, tamanho ou raio entra em
`src/tema/tokens.ts`, nunca solto na tela.

## Leitura do app

- **O que é:** delivery de comida, mercado, farmácia e pet de uma cidade do interior.
- **Para quem:** cliente e motoboy, leigos, celular Android simples, sol na rua.
- **Sensação:** sério, moderno, de marca forte. Rebrand aprovado pelo dono em
  2026-11-14: o visual anterior (mascote, ícones 3D, azul-noite) parecia infantil.
- **Dials:** expressão 6, movimento 4, densidade 4.

## Direção (rebrand de 2026-11-14, igual à landing)

- **Topo preto** (`cores.noite`) na home, com o letreiro branco, a cidade, a
  busca e as pílulas de segmento. As demais telas usam o `TopoDaTela` branco.
- **Laranja da marca** (`cores.marca`) em botões e destaques; `marcaViva` só em
  detalhes sobre o preto.
- **Ícones só de linha** (`lucide-react-native`). Nada de ícone 3D nem mascote:
  estado vazio é ícone de linha num círculo laranja-claro (`EstadoDaTela`).
- **Títulos** em Poppins, texto em DM Sans, sempre com inicial maiúscula.
- **Banners em quatro lugares**, escolhidos no campo "Posição" do painel:
  carrossel do topo da home, faixas entre as seções da home, topo da tela de
  categoria (de uma categoria ou de todas) e aba de pedidos. Sem campanha, só o
  topo da home mostra o banner da marca; os outros lugares somem.
- **Barra de baixo** branca com o botão laranja do meio (lista ou sacola).

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

- **Marca:** laranja `#E65100` (viva `#FF6B00`, escura `#C2410C`), vermelho `#E6192B`.
- **Preto:** `#111214`, `#1C1D20`, `#2A2B30`.
- **Categorias:** comida laranja, mercado verde, farmácia azul, bebidas roxo,
  pet rosa, casa turquesa, outros amarelo.
- **Texto:** Poppins em títulos, DM Sans no resto.
- **Forma:** 12 em campos, pílula em botões e filtros, 24 em cartões e folhas.
- **Sombra:** duas alturas apenas, sempre com `elevation` para valer no Android.

## Regras de composição

- Selo só com estado real: aberta, fechada, patrocinada, desconto, status.
- Toda lista tem carregando (esqueleto), vazio com ícone de linha, erro com
  "Tentar de novo" e puxar para atualizar.
- Foto ausente nunca vira quadrado cinza: usa o fundo da categoria com o ícone.
- Nada de botão que não faz nada: sino só quando existir central de avisos,
  microfone só quando houver ditado próprio.
- Sem emoji e sem `Alert.alert`, exceto confirmação destrutiva.
- Ícones só de `lucide-react-native`.
