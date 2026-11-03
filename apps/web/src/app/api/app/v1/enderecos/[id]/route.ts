import { NextResponse } from 'next/server';
import { exigirUsuarioDoToken, rotaDoApp } from '@rapidinho/auth';
import { excluirEnderecoDoCliente, salvarEnderecoDoCliente } from '@rapidinho/services/regras';
import { exigirOk, limitarEscrita, okCom } from '@/lib/api-do-app';
import { lerEndereco, paraEnderecoSalvo } from '@/lib/enderecos-do-app';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Contexto = { params: Promise<{ id: string }> };

export const GET = rotaDoApp(async (request: Request, { params }: Contexto) => {
  const user = await exigirUsuarioDoToken(request);
  const { id } = await params;

  return NextResponse.json(await paraEnderecoSalvo(user.id, id));
});

export const PATCH = rotaDoApp(async (request: Request, { params }: Contexto) => {
  const user = await exigirUsuarioDoToken(request);
  await limitarEscrita(user);

  const { id } = await params;
  const dados = await lerEndereco(request);
  exigirOk(await salvarEnderecoDoCliente(user.id, dados, id));

  return NextResponse.json(await paraEnderecoSalvo(user.id, id));
});

export const DELETE = rotaDoApp(async (request: Request, { params }: Contexto) => {
  const user = await exigirUsuarioDoToken(request);
  await limitarEscrita(user);

  const { id } = await params;
  return okCom(exigirOk(await excluirEnderecoDoCliente(user.id, id)));
});
