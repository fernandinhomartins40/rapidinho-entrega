import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiHandler } from '@rapidinho/auth';
import { gatewayAutorizado, registrarSinalDoGateway } from '@rapidinho/services';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const sinalSchema = z.object({
  versao: z.string().max(20).optional(),
  bateria: z.number().int().min(0).max(100).optional(),
  pendentes: z.number().int().min(0).max(10_000).optional(),
});

/**
 * Sinal de vida do celular gateway. O painel da plataforma mostra há quanto
 * tempo o app não aparece: celular desligado é login parado, e é melhor saber
 * pela tela do que pelo cliente reclamando.
 *
 * Também serve para o app testar a configuração: token errado dá 401.
 */
export const POST = apiHandler(async (request: Request) => {
  if (!gatewayAutorizado(request.headers)) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  }

  await registrarSinalDoGateway(sinalSchema.parse(await request.json().catch(() => ({}))));
  return NextResponse.json({ ok: true });
});
