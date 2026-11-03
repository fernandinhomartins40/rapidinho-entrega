import { NextResponse } from 'next/server';
import { rotaDoApp, usuarioDoToken } from '@rapidinho/auth';
import { cidadeAtiva, pratosDaCidade } from '@rapidinho/services/regras';
import type { RespostaPratos } from '@rapidinho/shared/app-api';
import { naoEncontrado } from '@/lib/api-do-app';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Contexto = { params: Promise<{ cidade: string }> };

/** Pública; com token, marca o que o cliente já pediu. */
export const GET = rotaDoApp(async (request: Request, { params }: Contexto) => {
  const { cidade: slug } = await params;

  const cidade = await cidadeAtiva(slug);
  if (!cidade) throw naoEncontrado('Cidade não encontrada.');

  const user = await usuarioDoToken(request);
  const pratos = await pratosDaCidade(cidade.id, { userId: user?.id ?? null });

  const resposta: RespostaPratos = {
    pratos: pratos.map((prato) => ({
      chave: prato.chave,
      nome: prato.nome,
      descricao: prato.descricao,
      lojaId: prato.loja.id,
      lojaNome: prato.loja.nome,
      lojaSlug: prato.loja.slug,
      aPartirDe: prato.aPartirDe,
      precoCents: prato.precoCents,
      tempoMin: prato.tempoMin,
      tipo: prato.tipo,
      paraDividir: prato.paraDividir,
      popularidade: prato.popularidade,
      imagemUrl: prato.imagem,
      emAlta: prato.emAlta,
      jaPediu: prato.jaPediu,
    })),
  };

  return NextResponse.json(resposta);
});
