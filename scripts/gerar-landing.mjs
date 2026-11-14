/**
 * Gera as imagens da landing a partir dos originais em `assets/`.
 *
 * Mesmo esquema do `gerar-marca.mjs`: roda sob demanda (`pnpm landing:gerar`)
 * e o resultado é versionado, para o build não depender dos PNGs de 1–2 MB.
 */
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const origem = join(raiz, 'assets');
const destino = join(raiz, 'apps/web/public/landing');

const medidas = {};

async function gravar(nome, buffer) {
  const caminho = join(destino, nome);
  await mkdir(dirname(caminho), { recursive: true });
  await writeFile(caminho, buffer);

  const { width, height } = await sharp(buffer).metadata();
  medidas[nome] = { width, height };

  console.log(`  ${nome} — ${width}x${height}, ${(buffer.length / 1024).toFixed(1)} KB`);
}

/**
 * Fotos-mestre ficam em JPEG XL: o `cjxl --lossless_jpeg=1` guarda o JPG
 * byte a byte em ~20% menos espaço. O sharp não lê JXL, então o `djxl`
 * (libjxl, `winget install libjxl.libjxl`) devolve o JPG original.
 */
function jpgDoJxl(arquivo) {
  const saida = join(tmpdir(), 'rapidinho-landing.jpg');
  execFileSync('djxl', [join(origem, arquivo), saida], { stdio: 'ignore' });
  return saida;
}

/** Recorta o transparente em volta e reduz para a largura pedida. */
function recortada(arquivo, largura) {
  return sharp(join(origem, arquivo))
    .trim({ threshold: 10 })
    .resize({ width: largura, withoutEnlargement: true });
}

/**
 * Cantos da tela no `landing/celular.png` (852 × 1846), medidos na arte:
 * superior esquerdo, superior direito, inferior direito, inferior esquerdo.
 * O celular está em perspectiva, então a tela é um quadrilátero, não um retângulo.
 */
const TELA = [
  [244, 348],
  [651, 274],
  [567, 1512],
  [155, 1486],
];

/** Homografia do quadrado unitário para o quadrilátero (Heckbert), já invertida. */
function inversaDaPerspectiva([[x0, y0], [x1, y1], [x2, y2], [x3, y3]]) {
  const dx1 = x1 - x2,
    dx2 = x3 - x2,
    dx3 = x0 - x1 + x2 - x3;
  const dy1 = y1 - y2,
    dy2 = y3 - y2,
    dy3 = y0 - y1 + y2 - y3;
  const den = dx1 * dy2 - dx2 * dy1;
  const g = (dx3 * dy2 - dx2 * dy3) / den;
  const h = (dx1 * dy3 - dx3 * dy1) / den;
  const [a, b, c] = [x1 - x0 + g * x1, x3 - x0 + h * x3, x0];
  const [d, e, f] = [y1 - y0 + g * y1, y3 - y0 + h * y3, y0];
  // Adjunta da matriz [[a,b,c],[d,e,f],[g,h,1]]: a escala some na divisão final.
  const m = [
    e - f * h,
    c * h - b,
    b * f - c * e,
    f * g - d,
    a - c * g,
    c * d - a * f,
    d * h - e * g,
    b * g - a * h,
    a * e - b * d,
  ];
  return (x, y) => {
    const w = m[6] * x + m[7] * y + m[8];
    return [(m[0] * x + m[1] * y + m[2]) / w, (m[3] * x + m[4] * y + m[5]) / w];
  };
}

/**
 * O celular com a tela inicial do app dentro.
 *
 * A captura ainda tem a logo antiga no topo: ela é coberta pela logo nova
 * antes de entrar na tela. O recorte da câmera é redesenhado por cima.
 */
async function celularComTela() {
  const captura = join(origem, 'google-play/capturas/01-inicio.png');
  const { width: cw, height: ch } = await sharp(captura).metadata();
  const logo = await sharp(join(origem, 'marca/lettering-negativo.png'))
    .trim({ threshold: 10 })
    .resize({ width: 520 })
    .png()
    .toBuffer();
  const { height: lh } = await sharp(logo).metadata();
  const fundo = '#0f0f10';
  const mascara = Buffer.from(
    `<svg width="${cw}" height="${ch}" xmlns="http://www.w3.org/2000/svg">` +
      `<rect width="${cw}" height="${ch}" rx="90" fill="#fff"/></svg>`,
  );
  const cobertura = Buffer.from(
    `<svg width="${cw}" height="${ch}" xmlns="http://www.w3.org/2000/svg">` +
      `<rect x="330" y="130" width="420" height="160" fill="${fundo}"/>` +
      `<rect x="${cw / 2 - 180}" y="18" width="360" height="100" rx="50" fill="#000"/></svg>`,
  );
  const tela = await sharp(captura)
    .composite([
      { input: cobertura },
      { input: logo, left: Math.round(cw / 2 - 260), top: Math.round(208 - lh / 2) },
      { input: mascara, blend: 'dest-in' },
    ])
    .ensureAlpha()
    .raw()
    .toBuffer();

  const { data, info } = await sharp(join(origem, 'landing/celular.png'))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const paraUV = inversaDaPerspectiva(TELA);
  const xs = TELA.map((p) => p[0]),
    ys = TELA.map((p) => p[1]);
  for (let y = Math.min(...ys); y <= Math.max(...ys); y++) {
    for (let x = Math.min(...xs); x <= Math.max(...xs); x++) {
      const [u, v] = paraUV(x, y);
      if (u < 0 || u >= 1 || v < 0 || v >= 1) continue;
      // Vizinho mais próximo basta: a imagem final sai reduzida.
      const j = (Math.floor(v * ch) * cw + Math.floor(u * cw)) * 4;
      const alfa = tela[j + 3] / 255;
      const i = (y * info.width + x) * 4;
      for (let k = 0; k < 3; k++)
        data[i + k] = Math.round(tela[j + k] * alfa + data[i + k] * (1 - alfa));
    }
  }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png()
    .toBuffer();
}

async function gravarMedidas() {
  const entradas = Object.entries(medidas)
    .map(([nome, { width, height }]) => `  '${nome}': { width: ${width}, height: ${height} },`)
    .join('\n');

  const conteudo = `/**
 * Medidas das imagens da landing.
 *
 * ARQUIVO GERADO por \`pnpm landing:gerar\` — não edite à mão.
 */
export const MEDIDAS_DA_LANDING = {
${entradas}
} as const satisfies Record<string, { width: number; height: number }>;

export type ImagemDaLanding = keyof typeof MEDIDAS_DA_LANDING;
`;

  await writeFile(join(raiz, 'apps/web/src/components/landing/medidas.ts'), conteudo);
  console.log('\n  apps/web/src/components/landing/medidas.ts atualizado');
}

async function main() {
  console.log('Landing:');
  // Foto do hero: opaca, sem recorte. 2000px cobre a metade direita de telas retina.
  await gravar(
    'motoboy.webp',
    await sharp(jpgDoJxl('landing/hero-motoboy.jxl'))
      .resize({ width: 2000, withoutEnlargement: true })
      .webp({ quality: 78 })
      .toBuffer(),
  );
  await gravar(
    'celular.webp',
    await sharp(await celularComTela())
      .trim({ threshold: 10 })
      .resize({ width: 1200, withoutEnlargement: true })
      .webp({ quality: 86 })
      .toBuffer(),
  );
  await gravar(
    'cliente.webp',
    await recortada('cliente-com-celular.png', 640).webp({ quality: 84 }).toBuffer(),
  );

  await gravarMedidas();
}

await main();
