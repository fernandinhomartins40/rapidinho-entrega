import imageCompression from 'browser-image-compression';

/**
 * Processamento de imagem no CLIENTE, antes do upload.
 *
 * Faz diferença real na operação: o lojista está num 3G do interior tirando
 * foto com celular. Subir 4 MB de JPEG direto da câmera é o que trava o
 * cadastro. Aqui a foto sai de ~4 MB para ~120 KB antes de sair do aparelho.
 *
 * Ordem: recorte (aspect travado) → redimensiona → comprime → converte para
 * WebP (AVIF quando o navegador codifica, JPEG como último recurso).
 */

export interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Maior lado da imagem enviada. O servidor gera as variantes menores. */
const MAX_UPLOAD_DIMENSION = 1600;
const COMPRESSION_QUALITY = 0.8;

async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', () => reject(new Error('Não foi possível ler a imagem')));
    image.src = src;
  });
}

/** Formato de saída suportado pelo navegador, do melhor para o pior. */
async function pickOutputType(): Promise<'image/avif' | 'image/webp' | 'image/jpeg'> {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;

  // toDataURL devolve PNG quando o tipo pedido não é suportado.
  if (canvas.toDataURL('image/avif').startsWith('data:image/avif')) return 'image/avif';
  if (canvas.toDataURL('image/webp').startsWith('data:image/webp')) return 'image/webp';
  return 'image/jpeg';
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Falha ao converter a imagem'))),
      type,
      quality,
    );
  });
}

/**
 * Recorta a área escolhida e devolve um canvas já limitado ao tamanho máximo.
 * O recorte também descarta os metadados EXIF do arquivo original — inclusive
 * a geolocalização, que não deve viajar junto com a foto do produto.
 *
 * Quando há rotação, a imagem é primeiro desenhada girada em um canvas
 * intermediário: as coordenadas do recorte que o cropper devolve já são
 * relativas à imagem girada.
 */
async function cropToCanvas(
  imageSrc: string,
  crop: CropArea,
  rotation = 0,
): Promise<HTMLCanvasElement> {
  const image = await loadImage(imageSrc);
  const source = rotation === 0 ? image : rotateImage(image, rotation);

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Navegador sem suporte a canvas');

  const scale = Math.min(1, MAX_UPLOAD_DIMENSION / Math.max(crop.width, crop.height));
  canvas.width = Math.round(crop.width * scale);
  canvas.height = Math.round(crop.height * scale);

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(
    source,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    canvas.width,
    canvas.height,
  );

  return canvas;
}

function rotateImage(image: HTMLImageElement, degrees: number): HTMLCanvasElement {
  const radians = (degrees * Math.PI) / 180;
  const sin = Math.abs(Math.sin(radians));
  const cos = Math.abs(Math.cos(radians));

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(image.width * cos + image.height * sin);
  canvas.height = Math.round(image.width * sin + image.height * cos);

  const context = canvas.getContext('2d');
  if (!context) throw new Error('Navegador sem suporte a canvas');

  context.translate(canvas.width / 2, canvas.height / 2);
  context.rotate(radians);
  context.drawImage(image, -image.width / 2, -image.height / 2);

  return canvas;
}

export interface ProcessedImage {
  file: File;
  previewUrl: string;
  width: number;
  height: number;
  sizeBytes: number;
}

export async function processImageForUpload(
  imageSrc: string,
  crop: CropArea,
  options: { rotation?: number; fileName?: string } = {},
): Promise<ProcessedImage> {
  const { rotation = 0, fileName = 'imagem' } = options;
  const canvas = await cropToCanvas(imageSrc, crop, rotation);
  const outputType = await pickOutputType();

  const blob = await canvasToBlob(canvas, outputType, COMPRESSION_QUALITY);
  const extension = outputType.split('/')[1] ?? 'webp';

  const cropped = new File([blob], `${fileName}.${extension}`, { type: outputType });

  // Segunda passada: garante o teto de tamanho mesmo em foto muito detalhada.
  const compressed = await imageCompression(cropped, {
    maxSizeMB: 0.4,
    maxWidthOrHeight: MAX_UPLOAD_DIMENSION,
    useWebWorker: true,
    fileType: outputType,
    initialQuality: COMPRESSION_QUALITY,
  });

  return {
    file: compressed,
    previewUrl: URL.createObjectURL(compressed),
    width: canvas.width,
    height: canvas.height,
    sizeBytes: compressed.size,
  };
}

/** Verifica a assinatura real do arquivo — extensão mente, magic number não. */
export async function sniffImageMimeType(file: File): Promise<string | null> {
  const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const hex = Array.from(header)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');

  if (hex.startsWith('ffd8ff')) return 'image/jpeg';
  if (hex.startsWith('89504e47')) return 'image/png';
  if (hex.startsWith('52494646') && hex.slice(16, 24) === '57454250') return 'image/webp';

  // Contêiner ISO-BMFF: o "brand" logo após `ftyp` diz se é AVIF ou HEIC.
  if (hex.slice(8, 16) === '66747970') {
    const brand = hex.slice(16, 24);
    if (brand === '61766966' || brand === '61766973') return 'image/avif';
    // HEIC é o padrão da câmera do iPhone e só abre no Safari.
    if (brand.startsWith('6865') || brand === '6d696631') return 'image/heic';
  }

  return null;
}
