import { NextResponse } from 'next/server';
import { rotaDoApp } from '@rapidinho/auth';
import { listarCidades } from '@rapidinho/services/regras';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = rotaDoApp(async () => NextResponse.json({ cidades: await listarCidades() }));
