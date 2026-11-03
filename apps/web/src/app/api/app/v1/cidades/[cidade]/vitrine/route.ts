import { NextResponse } from 'next/server';
import { rotaDoApp } from '@rapidinho/auth';
import { vitrineDoApp } from '@rapidinho/services/regras';
import { naoEncontrado } from '@/lib/api-do-app';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Contexto = { params: Promise<{ cidade: string }> };

export const GET = rotaDoApp(async (_request: Request, { params }: Contexto) => {
  const { cidade } = await params;
  const vitrine = await vitrineDoApp(cidade);
  if (!vitrine) throw naoEncontrado('Cidade não encontrada.');

  return NextResponse.json(vitrine);
});
