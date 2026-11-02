import { NextResponse } from 'next/server';
import { getCurrentUser } from '@rapidinho/auth';
import { reunirDadosDoTitular } from '@/lib/dados-do-titular';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Exportação dos dados como download de verdade.
 *
 * O site gera o arquivo no navegador, mas a WebView do app nativo não salva
 * arquivo gerado assim: o app entrega este endereço ao gerenciador de
 * downloads do Android, junto com o cookie da sessão.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: 'Entre para exportar seus dados.' }, { status: 401 });

  const json = await reunirDadosDoTitular(user.id);
  if (!json) return NextResponse.json({ error: 'Conta não encontrada.' }, { status: 404 });

  return new NextResponse(json, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': 'attachment; filename="meus-dados-rapidinho.json"',
      'Cache-Control': 'no-store',
    },
  });
}
