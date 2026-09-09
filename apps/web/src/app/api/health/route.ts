import { NextResponse } from 'next/server';
import { prisma } from '@rapidinho/database';

export const dynamic = 'force-dynamic';

/**
 * Healthcheck do container. Toca o banco de propósito: um app que responde mas
 * não alcança o Postgres não está saudável, e o compose precisa saber disso
 * antes de mandar tráfego para ele.
 */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: 'ok', service: 'web' });
  } catch {
    return NextResponse.json({ status: 'degraded', service: 'web' }, { status: 503 });
  }
}
