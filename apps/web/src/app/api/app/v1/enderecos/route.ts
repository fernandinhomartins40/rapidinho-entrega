import { NextResponse } from 'next/server';
import { exigirUsuarioDoToken, rotaDoApp } from '@rapidinho/auth';
import { salvarEnderecoDoCliente } from '@rapidinho/services/regras';
import { exigirOk, limitarEscrita } from '@/lib/api-do-app';
import { enderecosDoApp, lerEndereco, paraEnderecoSalvo } from '@/lib/enderecos-do-app';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = rotaDoApp(async (request: Request) => {
  const user = await exigirUsuarioDoToken(request);
  return NextResponse.json({ enderecos: await enderecosDoApp(user.id) });
});

export const POST = rotaDoApp(async (request: Request) => {
  const user = await exigirUsuarioDoToken(request);
  await limitarEscrita(user);

  const dados = await lerEndereco(request);
  const { id } = exigirOk(await salvarEnderecoDoCliente(user.id, dados));

  return NextResponse.json(await paraEnderecoSalvo(user.id, id), { status: 201 });
});
