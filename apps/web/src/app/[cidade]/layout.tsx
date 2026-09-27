import { notFound } from 'next/navigation';
import { prisma } from '@rapidinho/database';
import { CascaDoApp } from '@/components/app/casca-do-app';

export const dynamic = 'force-dynamic';

export default async function CidadeLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ cidade: string }>;
}) {
  const { cidade: slug } = await params;

  const cidade = await prisma.city.findFirst({
    where: { slug, isActive: true },
    select: { slug: true },
  });

  if (!cidade) notFound();

  return <CascaDoApp cidadeSlug={cidade.slug}>{children}</CascaDoApp>;
}
