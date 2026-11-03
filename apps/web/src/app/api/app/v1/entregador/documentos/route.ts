import { NextResponse } from 'next/server';
import { z } from 'zod';
import { exigirCadastroDeEntregadorDoToken, rotaDoApp } from '@rapidinho/auth';
import {
  enviarDocumentoDoEntregador,
  listarDocumentosDoEntregador,
} from '@rapidinho/services/regras';
import type { RespostaDocumentos, TipoDeDocumento } from '@rapidinho/shared/app-api';
import { exigirOk, lerCorpo, limitarEscrita, okCom } from '@/lib/api-do-app';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const entradaSchema = z.object({
  tipo: z.enum(['CNH', 'CRLV', 'OUTRO']).optional(),
  imagemId: z.string().min(1).optional(),
  veiculo: z.enum(['MOTORCYCLE', 'BICYCLE', 'CAR', 'ON_FOOT']).optional(),
  placa: z.string().trim().max(10).nullable().optional(),
});

/** Sem exigir aprovação: é enviando a CNH que o cadastro chega a ser aprovado. */
export const GET = rotaDoApp(async (request: Request) => {
  const { courierId } = await exigirCadastroDeEntregadorDoToken(request);
  const dados = await listarDocumentosDoEntregador(courierId);

  const resposta: RespostaDocumentos = {
    status: dados.status,
    veiculo: dados.vehicleType,
    placa: dados.vehiclePlate,
    documentos: dados.documents.map((documento) => ({
      id: documento.id,
      tipo: documento.label as TipoDeDocumento,
      aprovado: documento.isApproved,
      motivoDaRecusa: documento.rejectReason,
      enviadoEm: documento.createdAt.toISOString(),
    })),
  };

  return NextResponse.json(resposta);
});

export const POST = rotaDoApp(async (request: Request) => {
  const { user, courierId } = await exigirCadastroDeEntregadorDoToken(request);
  await limitarEscrita(user);

  const dados = await lerCorpo(request, entradaSchema);

  return okCom(exigirOk(await enviarDocumentoDoEntregador({ courierId, userId: user.id }, dados)));
});
