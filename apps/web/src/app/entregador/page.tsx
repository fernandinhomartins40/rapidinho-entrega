import Link from 'next/link';
import { Check } from 'lucide-react';
import { prisma } from '@rapidinho/database';
import { Logotipo } from '@/components/marca/logo';
import { FormularioDeEntregador } from './formulario';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Seja entregador',
  description: 'Faça entregas na sua cidade com o Rapidinho Entrega.',
};

export default async function EntregadorPage() {
  const cidades = await prisma.city.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, state: true },
  });

  return (
    <main className="mx-auto max-w-lg px-5 py-8">
      <Link href="/">
        <Logotipo className="h-9 w-auto" priority />
      </Link>

      <h1 className="mt-6 text-3xl font-bold leading-tight tracking-tight">
        Faça entregas na sua cidade
      </h1>
      <p className="text-muted-foreground mt-2 leading-relaxed">
        Você escolhe quando trabalhar. As corridas aparecem no seu celular e você aceita as que
        quiser.
      </p>

      <ul className="mt-6 space-y-2">
        {[
          'Sem escala fixa: fique online quando puder',
          'Você vê quanto ganha antes de aceitar a corrida',
          'Trajetos curtos, dentro da própria cidade',
          'Ganhos do dia sempre à vista no painel',
        ].map((item) => (
          <li key={item} className="flex gap-2">
            <Check className="text-success mt-0.5 h-5 w-5 shrink-0" aria-hidden />
            {item}
          </li>
        ))}
      </ul>

      {cidades.length === 0 ? (
        <p className="bg-warning/15 mt-6 rounded-xl p-4">
          Ainda não abrimos nenhuma cidade. Volte em breve.
        </p>
      ) : (
        <FormularioDeEntregador cidades={cidades} />
      )}

      <p className="text-muted-foreground mt-8 text-sm">
        Já é entregador?{' '}
        <Link href="/entrar" className="underline">
          Entre com seu telefone
        </Link>
        .
      </p>
    </main>
  );
}
