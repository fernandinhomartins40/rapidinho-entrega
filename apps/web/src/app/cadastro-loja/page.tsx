import Link from 'next/link';
import { Check } from 'lucide-react';
import { prisma } from '@rapidinho/database';
import { formatCents } from '@rapidinho/shared';
import { Logotipo } from '@/components/marca/logo';
import { FormularioDeCadastro } from './formulario';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Cadastre sua loja',
  description:
    'Venda pelo Rapidinho Entrega. Sem mensalidade para começar e cadastro em poucos minutos.',
};

export default async function CadastroLojaPage() {
  const [cidades, categorias, planoGratuito] = await Promise.all([
    prisma.city.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, state: true },
    }),
    prisma.storeCategory.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, name: true },
    }),
    prisma.plan.findFirst({
      where: { isDefault: true, isActive: true },
      select: { name: true, monthlyPriceCents: true, commissionRate: true, trialDays: true },
    }),
  ]);

  return (
    <main className="mx-auto max-w-lg px-5 py-8">
      <Link href="/">
        <Logotipo className="h-9 w-auto" priority />
      </Link>

      <h1 className="mt-6 text-3xl font-bold leading-tight tracking-tight">
        Sua loja vendendo online
      </h1>
      <p className="text-muted-foreground mt-2 leading-relaxed">
        Preencha uma vez e comece a receber pedidos. Se você sabe usar o WhatsApp, sabe usar o
        painel.
      </p>

      {planoGratuito ? (
        <ul className="mt-6 space-y-2">
          {[
            planoGratuito.monthlyPriceCents === 0
              ? 'Sem mensalidade para começar'
              : `${formatCents(planoGratuito.monthlyPriceCents)} por mês`,
            `Você paga ${Number(planoGratuito.commissionRate)}% de comissão só quando vender`,
            'Cadastre um produto em menos de 30 segundos',
            'Tem centenas de itens? Importe de uma planilha',
          ].map((item) => (
            <li key={item} className="flex gap-2">
              <Check className="text-success mt-0.5 h-5 w-5 shrink-0" aria-hidden />
              {item}
            </li>
          ))}
        </ul>
      ) : null}

      {cidades.length === 0 ? (
        <p className="bg-warning/15 mt-6 rounded-xl p-4">
          Ainda não abrimos nenhuma cidade. Deixe seu contato pelo WhatsApp da plataforma e avisamos
          quando chegarmos à sua.
        </p>
      ) : (
        <FormularioDeCadastro cidades={cidades} categorias={categorias} />
      )}

      <p className="text-muted-foreground mt-8 text-sm">
        Já tem loja cadastrada?{' '}
        <Link href="/entrar" className="underline">
          Entre com seu telefone
        </Link>
        .
      </p>
    </main>
  );
}
