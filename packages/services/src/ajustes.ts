import { prisma } from '@rapidinho/database';

/**
 * Ajustes da plataforma que o super admin muda pelo painel, sem deploy.
 *
 * Ficam em `PlatformSetting`, uma linha por chave. Hoje só a chave do Google
 * Maps: é chave de navegador (vai para o app e o site), então a proteção é a
 * restrição por domínio no Google Cloud, não o sigilo.
 */

const CHAVE_DO_GOOGLE_MAPS = 'google_maps_api_key';

export async function lerChaveDoGoogleMaps(): Promise<string | null> {
  const linha = await prisma.platformSetting.findUnique({
    where: { key: CHAVE_DO_GOOGLE_MAPS },
    select: { value: true },
  });
  return typeof linha?.value === 'string' && linha.value ? linha.value : null;
}

/** `null` apaga a chave e o mapa volta ao botão que abre o Google Maps. */
export async function gravarChaveDoGoogleMaps(chave: string | null, userId: string) {
  if (!chave) {
    await prisma.platformSetting.deleteMany({ where: { key: CHAVE_DO_GOOGLE_MAPS } });
    return;
  }
  await prisma.platformSetting.upsert({
    where: { key: CHAVE_DO_GOOGLE_MAPS },
    create: { key: CHAVE_DO_GOOGLE_MAPS, value: chave, updatedById: userId },
    update: { value: chave, updatedById: userId },
  });
}
