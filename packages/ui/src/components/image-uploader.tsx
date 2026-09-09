'use client';

import * as React from 'react';
import Cropper from 'react-easy-crop';
import { Camera, ImageOff, Loader2, RotateCw, Trash2, ZoomIn } from 'lucide-react';
import {
  ALLOWED_IMAGE_MIME_TYPES,
  ASPECT_RATIOS,
  MAX_UPLOAD_BYTES,
  type UploadContext,
} from '@rapidinho/shared';
import { cn } from '../lib/utils';
import { processImageForUpload, sniffImageMimeType, type CropArea } from '../lib/image-processing';
import { Button } from './button';

/**
 * Componente ÚNICO de upload de imagem do sistema.
 *
 * Nenhum outro lugar do código deve subir imagem: quem precisa de foto usa
 * este componente, informa o contexto e recebe o id do arquivo já processado.
 * O aspect ratio vem do contexto (produto 1:1, capa 16:9, banner 21:9), então
 * quem chama não escolhe errado.
 *
 * Fluxo: escolher arquivo → validar tipo real → recortar → comprimir e
 * converter → enviar → o servidor gera thumb/médio/grande e o blur.
 */

export interface ImageUploaderProps {
  context: UploadContext;
  /// Id do MediaAsset já salvo, para editar uma imagem existente.
  value?: string | null;
  /// URL de exibição da imagem atual.
  previewUrl?: string | null;
  onChange: (mediaId: string | null) => void;
  /// Endpoint que recebe o arquivo. Sobrescrito no painel do lojista.
  uploadUrl?: string;
  label?: string;
  helperText?: string;
  disabled?: boolean;
  className?: string;
}

interface UploadResponse {
  id: string;
  url: string;
}

const CONTEXT_HINT: Record<UploadContext, string> = {
  PRODUCT: 'Foto quadrada do produto',
  STORE_LOGO: 'Logo da loja (quadrado)',
  STORE_COVER: 'Capa da loja (paisagem)',
  PROMO_BANNER: 'Banner promocional (faixa larga)',
  CATEGORY_ICON: 'Ícone da categoria',
  COURIER_DOCUMENT: 'Foto do documento',
  STORE_DOCUMENT: 'Foto do documento',
  PIZZA_FLAVOR: 'Foto do sabor',
};

export function ImageUploader({
  context,
  value,
  previewUrl,
  onChange,
  uploadUrl = '/api/uploads',
  label,
  helperText,
  disabled,
  className,
}: ImageUploaderProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [sourceUrl, setSourceUrl] = React.useState<string | null>(null);
  const [crop, setCrop] = React.useState({ x: 0, y: 0 });
  const [zoom, setZoom] = React.useState(1);
  const [rotation, setRotation] = React.useState(0);
  const [croppedArea, setCroppedArea] = React.useState<CropArea | null>(null);
  const [isUploading, setIsUploading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [localPreview, setLocalPreview] = React.useState<string | null>(previewUrl ?? null);

  const aspect = ASPECT_RATIOS[context];

  React.useEffect(() => {
    setLocalPreview(previewUrl ?? null);
  }, [previewUrl]);

  // Um object URL não liberado segura o arquivo inteiro na memória; em celular
  // fraco isso derruba a aba depois de alguns cadastros seguidos.
  React.useEffect(() => {
    return () => {
      if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    };
  }, [sourceUrl]);

  async function handleFileSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setError(null);

    if (file.size > MAX_UPLOAD_BYTES) {
      setError('Imagem muito grande. Escolha uma foto de até 8 MB.');
      return;
    }

    const realType = await sniffImageMimeType(file);

    if (realType === 'image/heic') {
      setError(
        'Esta foto está no formato do iPhone (HEIC). Tire a foto pelo app ou salve como JPEG.',
      );
      return;
    }
    if (!realType || !ALLOWED_IMAGE_MIME_TYPES.includes(realType as never)) {
      setError('Arquivo inválido. Envie uma imagem JPEG, PNG ou WebP.');
      return;
    }

    setSourceUrl(URL.createObjectURL(file));
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
  }

  async function handleConfirmCrop() {
    if (!sourceUrl || !croppedArea) return;

    setIsUploading(true);
    setError(null);

    try {
      const processed = await processImageForUpload(sourceUrl, croppedArea, { rotation });

      const formData = new FormData();
      formData.append('file', processed.file);
      formData.append('context', context);

      const response = await fetch(uploadUrl, { method: 'POST', body: formData });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? 'Não foi possível enviar a imagem');
      }

      const result = (await response.json()) as UploadResponse;

      setLocalPreview(processed.previewUrl);
      onChange(result.id);
      setSourceUrl(null);
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : 'Não foi possível enviar a imagem. Tente de novo.',
      );
    } finally {
      setIsUploading(false);
    }
  }

  function handleRemove() {
    setLocalPreview(null);
    onChange(null);
    setError(null);
  }

  const aspectClassName =
    aspect === 1 ? 'aspect-square' : aspect > 2 ? 'aspect-[21/9]' : 'aspect-video';

  return (
    <div className={cn('w-full', className)}>
      {label ? <p className="mb-1.5 text-sm font-semibold">{label}</p> : null}

      {sourceUrl ? (
        <div className="border-primary/40 bg-card rounded-xl border-2 p-3">
          <div
            className={cn('relative w-full overflow-hidden rounded-lg bg-black', aspectClassName)}
          >
            <Cropper
              image={sourceUrl}
              crop={crop}
              zoom={zoom}
              rotation={rotation}
              aspect={aspect}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={(_area, areaPixels) => setCroppedArea(areaPixels)}
              showGrid
            />
          </div>

          <div className="mt-3 flex items-center gap-3">
            <ZoomIn className="text-muted-foreground h-5 w-5 shrink-0" aria-hidden />
            <input
              type="range"
              min={1}
              max={3}
              step={0.05}
              value={zoom}
              onChange={(event) => setZoom(Number(event.target.value))}
              aria-label="Aproximar a imagem"
              className="accent-primary h-2 w-full cursor-pointer"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setRotation((current) => (current + 90) % 360)}
              aria-label="Girar a imagem"
            >
              <RotateCw className="h-5 w-5" aria-hidden />
            </Button>
          </div>

          <div className="mt-3 flex gap-2">
            <Button type="button" onClick={handleConfirmCrop} isLoading={isUploading} block>
              Usar esta foto
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setSourceUrl(null)}
              disabled={isUploading}
            >
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={disabled || isUploading}
            className={cn(
              'border-input bg-muted/40 hover:border-primary hover:bg-accent relative flex w-40 shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 border-dashed transition-colors disabled:opacity-50',
              aspectClassName,
            )}
            aria-label={localPreview ? 'Trocar imagem' : 'Adicionar imagem'}
          >
            {isUploading ? (
              <Loader2 className="text-primary h-8 w-8 animate-spin" aria-hidden />
            ) : localPreview ? (
              /* Prévia local em object URL: não passa pelo <Image> do Next,
                 que não otimiza blob e exigiria dimensões conhecidas. */
              <img src={localPreview} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="text-muted-foreground flex flex-col items-center gap-1 p-3 text-center text-xs font-medium">
                <Camera className="h-7 w-7" aria-hidden />
                Toque para adicionar
              </span>
            )}
          </button>

          <div className="flex-1 pt-1">
            <p className="text-muted-foreground text-sm">{helperText ?? CONTEXT_HINT[context]}</p>

            {localPreview ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive mt-2"
                onClick={handleRemove}
                disabled={disabled || isUploading}
              >
                <Trash2 className="h-4 w-4" aria-hidden />
                Remover
              </Button>
            ) : null}

            {value == null && !localPreview ? (
              <p className="text-muted-foreground mt-2 flex items-center gap-1.5 text-xs">
                <ImageOff className="h-4 w-4" aria-hidden />
                Sem foto — o produto aparece com um ícone
              </p>
            ) : null}
          </div>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_IMAGE_MIME_TYPES.join(',')}
        onChange={handleFileSelected}
        className="hidden"
        tabIndex={-1}
      />

      {error ? (
        <p role="alert" className="text-destructive mt-2 text-sm font-medium">
          {error}
        </p>
      ) : null}
    </div>
  );
}
