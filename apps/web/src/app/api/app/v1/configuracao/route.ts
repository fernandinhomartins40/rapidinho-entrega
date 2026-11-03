import { NextResponse } from 'next/server';
import { rotaDoApp } from '@rapidinho/auth';
import { parseServerEnv } from '@rapidinho/shared';
import { CONFIGURACAO_DO_APP } from '@rapidinho/shared/app-api/configuracao';
import type { ConfiguracaoDoApp } from '@rapidinho/shared/app-api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = rotaDoApp(async () => {
  const resposta: ConfiguracaoDoApp = {
    ...CONFIGURACAO_DO_APP,
    loginPorFirebase: Boolean(parseServerEnv().FIREBASE_PROJECT_ID),
  };

  return NextResponse.json(resposta);
});
