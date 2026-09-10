/**
 * Gera os arquivos da marca a partir dos originais em alta.
 *
 * Roda uma vez, sob demanda (`pnpm marca:gerar`), e o resultado é versionado:
 * o build não deve depender do sharp nem dos PNGs de 1254px.
 */
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const origem = join(raiz, 'assets/marca');
const destinos = [join(raiz, 'apps/web/public/marca'), join(raiz, 'apps/admin/public/marca')];

/** Azul-marinho da identidade (contorno das letras e do capacete). */
const NAVY = '#0d1f3c';

async function gravar(nome, buffer) {
  for (const destino of destinos) {
    await mkdir(destino, { recursive: true });
    await writeFile(join(destino, nome), buffer);
  }
  console.log(`  ${nome} — ${(buffer.length / 1024).toFixed(1)} KB`);
}

/** Recorta o transparente em volta e devolve a arte no tamanho pedido. */
function arte(arquivo, largura) {
  return sharp(join(origem, arquivo))
    .trim({ threshold: 10 })
    .resize({ width: largura, withoutEnlargement: true });
}

/**
 * Ícone de app: o símbolo sobre um quadrado navy arredondado.
 *
 * O PNG original é transparente e tem contorno escuro — num favicon de 16px
 * sobre aba clara ele sumiria.
 */
async function icone(lado, { margem = 0.18, raio = 0.22, fundo = NAVY } = {}) {
  const interno = Math.round(lado * (1 - margem * 2));
  const simbolo = await arte('simbolo.png', interno).png().toBuffer();
  const meta = await sharp(simbolo).metadata();

  const base = Buffer.from(
    `<svg width="${lado}" height="${lado}" xmlns="http://www.w3.org/2000/svg">` +
      `<rect width="${lado}" height="${lado}" rx="${Math.round(lado * raio)}" fill="${fundo}"/>` +
      `</svg>`,
  );

  return sharp(base)
    .composite([
      {
        input: simbolo,
        top: Math.round((lado - (meta.height ?? interno)) / 2),
        left: Math.round((lado - (meta.width ?? interno)) / 2),
      },
    ])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

async function main() {
  const disponiveis = await readdir(origem);
  console.log(`Originais: ${disponiveis.join(', ')}\n`);

  console.log('Marca:');
  await gravar('logo-completa.webp', await arte('logo-completa.png', 640).webp({ quality: 90 }).toBuffer());
  await gravar('lettering.webp', await arte('lettering.png', 560).webp({ quality: 90 }).toBuffer());
  await gravar('mascote.webp', await arte('mascote.png', 480).webp({ quality: 90 }).toBuffer());
  await gravar('simbolo.webp', await arte('simbolo.png', 256).webp({ quality: 92 }).toBuffer());

  console.log('\nÍcones:');
  await gravar('icone-192.png', await icone(192));
  await gravar('icone-512.png', await icone(512));
  // Maskable: margem maior porque o Android recorta até 20% de cada lado.
  await gravar('icone-maskable-512.png', await icone(512, { margem: 0.28, raio: 0.5 }));
  await gravar('apple-icon.png', await icone(180, { raio: 0 }));
  await gravar('favicon-32.png', await icone(32, { margem: 0.12, raio: 0.25 }));
}

await main();
