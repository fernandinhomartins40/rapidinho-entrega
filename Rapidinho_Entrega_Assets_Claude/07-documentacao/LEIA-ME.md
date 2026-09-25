# Rapidinho Entrega — assets para landing page

Referência: `01-referencia/landing-original.png` (783 × 2008 px). O pacote decompõe a landing sem usar a página inteira como fundo. Os objetos gerados em alta resolução são aproximações da referência, pois o print original tem poucos pixels. **Se você tem a logo vetorial oficial e as artes originais da marca, use-as no lugar dos recortes.**

## Diagnóstico da página

| Prioridade | Achado | Ação na implementação |
| --- | --- | --- |
| Alta | O print estreito não fornece logo ou selos oficiais em qualidade de produção. | Substituir os recortes por arquivos oficiais antes de publicar. |
| Alta | A tela do celular no print é ilustrativa e contém conteúdo difícil de ler. | Montar a UI em HTML/CSS ou usar `04-app/tela-app-referencia.svg` somente como mockup ilustrativo. |
| Média | A seção hero tem muitos elementos simultâneos em largura pequena. | No mobile, empilhar título, CTA e motoboy, mantendo contraste do texto. |
| Média | Estatísticas e depoimento são afirmações publicitárias. | Confirmar números, nome, foto e autorização antes da publicação. |

## Mapa de uso

| Arquivo | Seção e técnica | Ajuste sugerido |
| --- | --- | --- |
| `03-hero/cidade-noturna.webp` | Fundo do hero com `background-image` e overlay escuro em CSS | `cover`, centro à direita; PNG como fallback. |
| `03-hero/motoboy-scooter.webp` | Elemento de primeiro plano no hero | `object-fit: contain`; versão PNG com alpha como fallback; nunca cobrir texto. |
| `03-hero/rastros-velocidade.svg` | Decoração atrás da scooter | Posição absoluta; ocultar em telas pequenas ou reduzir opacidade. |
| `05-depoimentos/cliente-com-celular.webp` | Pessoa na faixa amarela | `object-fit: contain`, alinhada ao rodapé; PNG como fallback. |
| `04-app/celular-vazio.webp` | Casca visual do smartphone | Preferir criar o telefone inteiro em CSS se precisar sobrepor uma tela dinâmica; PNG disponível. |
| `04-app/tela-app-referencia.svg` | Mockup legível do app | Reprodução visual; para tela real, substituir por captura autorizada do produto. |
| `02-marca/logo-referencia-baixa-resolucao.png` | Referência de marca no print | **Não usar em tamanho grande.** Arquivo oficial é necessário para fidelidade. |
| `02-marca/*-recorte-referencia.png` | Referências visuais dos botões das lojas | Usar badges oficiais e URLs reais ao publicar. |
| `06-icones/*.svg` | Ícones simples de benefícios e categorias | Componentes SVG com `aria-hidden="true"` quando acompanhados por texto. |
| `06-icones/pin-marca.svg` | Ícone ilustrativo do local | SVG com texto adjacente. |

## Elementos para CSS/HTML

- Cabeçalho, navegação, títulos, números e CTAs: HTML sem texto dentro de imagens.
- Cards de benefícios, etapas, categorias e depoimentos: grid/flex com sombras e cantos em CSS.
- Fundo amarelo do depoimento e grafismo laranja atrás do celular: gradientes e formas em CSS.
- Botões de carrossel: controles reais com foco, teclado e nomes acessíveis.
- Ícones sociais comuns: biblioteca SVG já presente no projeto, sem recortar o print.

## Direção visual e responsividade

Tokens aproximados do print: `#101112` carvão, `#FFCB24` amarelo, `#FFB900` ouro, `#F04B28` coral, `#F5F7FA` cinza claro, `#FFFFFF` branco. Sugestão de largura máxima do conteúdo: 1200 px; breakpoints: 1024, 768 e 480 px. Desktop: hero em duas colunas. Tablet: motoboy menor e cards em duas colunas. Mobile: coluna única, categorias roláveis ou grade 2×3, foto do depoimento sob ou ao lado do cartão sem sobreposição do texto. Evite alturas fixas.

## Fontes técnicas

- WCAG 2.2, foco visível: https://www.w3.org/WAI/WCAG22/Understanding/focus-visible
- Imagens responsivas (`srcset`, `sizes`): https://web.dev/learn/images/responsive-images

## Limites

Não foram fornecidos código, logo vetorial, fontes oficiais, URLs das lojas nem capturas reais do aplicativo. O logotipo e os badges de lojas são recortes da referência e não devem substituir os arquivos oficiais de publicação. As imagens geradas seguem o visual geral, mas não são réplicas exatas dos personagens ou do dispositivo do print.
