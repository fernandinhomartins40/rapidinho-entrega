/**
 * Gera as imagens da landing a partir dos originais em `assets/`.
 *
 * Mesmo esquema do `gerar-marca.mjs`: roda sob demanda (`pnpm landing:gerar`)
 * e o resultado é versionado, para o build não depender dos PNGs de 1–2 MB.
 */
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

/** Recorta o transparente em volta e reduz para a largura pedida. */
function recortada(arquivo, largura) {
  return sharp(join(origem, arquivo))
    .trim({ threshold: 10 })
    .resize({ width: largura, withoutEnlargement: true });
}

/**
 * Tira o fundo branco de um recorte, preenchendo a partir das bordas.
 *
 * Um corte por limiar simples apagaria também os brilhos brancos de dentro do
 * desenho (a cruz da farmácia, o reflexo do hambúrguer); o preenchimento só
 * alcança o branco que encosta na borda.
 */
async function semFundoBranco(input) {
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const claro = (i) => {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    return Math.min(r, g, b) > 222 && Math.max(r, g, b) - Math.min(r, g, b) < 24;
  };

  const visitado = new Uint8Array(width * height);
  const fila = [];
  for (let x = 0; x < width; x++) fila.push(x, (height - 1) * width + x);
  for (let y = 0; y < height; y++) fila.push(y * width, y * width + width - 1);

  while (fila.length > 0) {
    const i = fila.pop();
    if (visitado[i] || !claro(i)) continue;
    visitado[i] = 1;
    data[i * 4 + 3] = 0;

    const x = i % width;
    const y = (i - x) / width;
    if (x > 0) fila.push(i - 1);
    if (x < width - 1) fila.push(i + 1);
    if (y > 0) fila.push(i - width);
    if (y < height - 1) fila.push(i + width);
  }

  return sharp(data, { raw: { width, height, channels: 4 } })
    .trim({ threshold: 1 })
    .webp({ quality: 90, alphaQuality: 90 })
    .toBuffer();
}

/**
 * Ícones das categorias, recortados da tela do app no mockup do celular.
 * Coordenadas no `Smartphone.png` original (1254 × 1254).
 */
const CATEGORIAS = {
  restaurantes: { left: 370, top: 455, width: 85, height: 80 },
  mercado: { left: 535, top: 455, width: 80, height: 75 },
  farmacia: { left: 700, top: 455, width: 75, height: 70 },
  bebidas: { left: 355, top: 598, width: 55, height: 92 },
  'pet-shop': { left: 520, top: 610, width: 70, height: 68 },
  outros: { left: 685, top: 612, width: 70, height: 66 },
};

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
  await gravar(
    'cidade-noturna.webp',
    await sharp(join(origem, 'cidade-noturna.webp'))
      .resize({ width: 1920, withoutEnlargement: true })
      .webp({ quality: 72 })
      .toBuffer(),
  );
  await gravar('motoboy.webp', await recortada('mascote_hero.png', 1100).webp({ quality: 86 }).toBuffer());
  await gravar('celular.webp', await recortada('Smartphone.png', 900).webp({ quality: 86 }).toBuffer());
  await gravar('cliente.webp', await recortada('cliente-com-celular.png', 640).webp({ quality: 84 }).toBuffer());

  console.log('\nCategorias:');
  const celular = join(origem, 'Smartphone.png');
  for (const [nome, area] of Object.entries(CATEGORIAS)) {
    const recorte = await sharp(celular).extract(area).png().toBuffer();
    await gravar(`categorias/${nome}.webp`, await semFundoBranco(recorte));
  }

  await gravarMedidas();
}

await main();
