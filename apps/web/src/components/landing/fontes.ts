import localFont from 'next/font/local';

/**
 * Fontes exclusivas da landing, auto-hospedadas como a Inter do layout.
 *
 * Só o subconjunto latino e só o peso usado: a Poppins ExtraBold Itálico nos
 * títulos (8 KB) e a Kaushan Script nas duas frases manuscritas. Ficam fora do
 * layout raiz para não pesar nas telas do app, que não as usam.
 */
export const fonteTitulo = localFont({
  src: '../../app/fonts/poppins-800-italic-latin.woff2',
  variable: '--font-titulo',
  weight: '800',
  style: 'italic',
  display: 'swap',
});

export const fonteManuscrita = localFont({
  src: '../../app/fonts/kaushan-script-latin.woff2',
  variable: '--font-manuscrita',
  weight: '400',
  display: 'swap',
  preload: false,
});
