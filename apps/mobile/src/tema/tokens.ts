import { Platform, type ViewStyle } from 'react-native';

/** Tokens do app. Ver MOBILE-DESIGN.md: tela nenhuma define cor ou medida solta. */
export const cores = {
  marca: '#FF5A1F',
  marcaEscura: '#D93F0B',
  marcaClara: '#FFEDE5',
  vermelho: '#E6192B',
  amarelo: '#FFC400',

  // Azul-noite da marca: banners e chamados fortes. O topo das telas é branco.
  noite: '#1C1A2E',
  noiteMedia: '#2A2742',
  noiteClara: '#3B3758',
  textoNaNoite: '#FFFFFF',
  textoNaNoiteFraco: 'rgba(255,255,255,0.72)',

  fundo: '#F5F5F8',
  superficie: '#FFFFFF',
  superficieAlta: '#EFEFF4',
  linha: '#E6E6EC',

  texto: '#23140C',
  textoMedio: '#6F5B4F',
  textoFraco: '#8C7768',
  textoNaCor: '#FFFFFF',

  sucesso: '#0E8A47',
  sucessoClaro: '#DFF6E8',
  perigo: '#C81E1E',
  perigoClaro: '#FDE6E6',
  aviso: '#9A6500',
  avisoClaro: '#FFF3CC',
} as const;

export const degradeDaMarca = ['#FF8A1F', '#FF5A1F', '#F0361F'] as const;
export const degradeDaNoite = ['#1C1A2E', '#2A2742', '#3A2E4A'] as const;
export const degradeDoSol = ['#FFD233', '#FFB21A', '#FF8A1F'] as const;

/**
 * Cor por segmento: bater o olho e saber o que é, sem ler. `degrade` pinta o
 * bloco do atalho; `cor` e `fundo`, selos e fotos ausentes.
 */
export const coresDaCategoria = {
  comida: { cor: '#F0561F', fundo: '#FFE9DD', degrade: ['#FF9A3D', '#F0461F'] },
  mercado: { cor: '#1E9E3A', fundo: '#DFF6E4', degrade: ['#5BCB3A', '#1E8E2E'] },
  farmacia: { cor: '#1477E6', fundo: '#E0EEFF', degrade: ['#3FB4FF', '#1261E0'] },
  bebidas: { cor: '#7B3FE4', fundo: '#EFE6FE', degrade: ['#A36BFF', '#6A2FD6'] },
  pet: { cor: '#E0338C', fundo: '#FDE4F1', degrade: ['#FF6FB8', '#D9267F'] },
  casa: { cor: '#00A2A8', fundo: '#DBF6F7', degrade: ['#2FD6D0', '#0090A0'] },
  outros: { cor: '#E89A00', fundo: '#FFF3CC', degrade: ['#FFC93D', '#F09A00'] },
} as const;

export type ChaveDaCategoria = keyof typeof coresDaCategoria;

export const espaco = { xs: 4, s: 8, m: 12, l: 16, xl: 24, xxl: 32 } as const;

export const raio = { pequeno: 8, medio: 12, grande: 16, folha: 24, total: 999 } as const;

export const fontes = {
  tituloForte: 'BricolageGrotesque_800ExtraBold',
  titulo: 'BricolageGrotesque_700Bold',
  corpo: 'DMSans_400Regular',
  corpoMedio: 'DMSans_500Medium',
  corpoForte: 'DMSans_700Bold',
} as const;

export const texto = {
  gigante: { fontFamily: fontes.tituloForte, fontSize: 32, lineHeight: 36 },
  titulo1: { fontFamily: fontes.tituloForte, fontSize: 26, lineHeight: 31 },
  titulo2: { fontFamily: fontes.titulo, fontSize: 21, lineHeight: 26 },
  titulo3: { fontFamily: fontes.titulo, fontSize: 17, lineHeight: 22 },
  corpo: { fontFamily: fontes.corpo, fontSize: 15, lineHeight: 21 },
  corpoForte: { fontFamily: fontes.corpoForte, fontSize: 15, lineHeight: 21 },
  legenda: { fontFamily: fontes.corpoMedio, fontSize: 13, lineHeight: 18 },
  mini: { fontFamily: fontes.corpoForte, fontSize: 11, lineHeight: 14 },
} as const;

export const toqueMinimo = 48;

function sombra(y: number, desfoque: number, opacidade: number, elevation: number): ViewStyle {
  return Platform.select({
    android: { elevation, shadowColor: cores.noite },
    default: {
      shadowColor: cores.noite,
      shadowOffset: { width: 0, height: y },
      shadowRadius: desfoque,
      shadowOpacity: opacidade,
    },
  }) as ViewStyle;
}

export const elevacao = {
  baixa: sombra(2, 8, 0.06, 2),
  alta: sombra(6, 18, 0.12, 6),
} as const;
