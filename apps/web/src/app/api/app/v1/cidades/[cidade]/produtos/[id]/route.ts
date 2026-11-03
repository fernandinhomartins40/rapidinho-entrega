import { NextResponse } from 'next/server';
import { rotaDoApp } from '@rapidinho/auth';
import { produtoDoApp } from '@rapidinho/services/regras';
import { naoEncontrado } from '@/lib/api-do-app';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Contexto = { params: Promise<{ cidade: string; id: string }> };

export const GET = rotaDoApp(async (_request: Request, { params }: Contexto) => {
  const { cidade, id } = await params;
  const produto = await produtoDoApp(cidade, id);
  if (!produto) throw naoEncontrado('Produto não encontrado.');

  return NextResponse.json(produto);
});
