import { cookies } from 'next/headers';
import { getCurrentUser } from '@rapidinho/auth';
import { BarraInferior } from '@/components/app/barra-inferior';
import { BarraDoCarrinho } from '@/components/app/barra-do-carrinho';
import { contarItensDoCarrinho } from '@/lib/cart';
import { COOKIE_DA_CIDADE } from '@/lib/cidade-lembrada';

/**
 * Moldura das telas do app: conteúdo, atalho do carrinho e barra de baixo.
 *
 * Pedidos, favoritos e perfil ficam fora de `/[cidade]`, mas precisam da
 * mesma barra — sem ela o cliente entra em "Pedidos" e não tem como voltar
 * sem o botão do sistema. A cidade vem da rota quando existe, e do cookie
 * que a vitrine grava quando não.
 */
export async function CascaDoApp({
  children,
  cidadeSlug,
}: {
  children: React.ReactNode;
  cidadeSlug?: string;
}) {
  const user = await getCurrentUser();
  const lembrada = cidadeSlug ? undefined : (await cookies()).get(COOKIE_DA_CIDADE)?.value;

  const cidade = cidadeSlug ?? (lembrada ? decodeURIComponent(lembrada) : null);
  const itensNoCarrinho = user ? await contarItensDoCarrinho(user.id) : 0;

  return (
    <>
      {/* Reserva o espaço da barra fixa (e do atalho do carrinho acima dela):
          sem isso o último item da lista fica embaixo da navegação. */}
      <div className={itensNoCarrinho > 0 ? 'pb-44' : 'pb-28'}>{children}</div>
      <BarraDoCarrinho itens={itensNoCarrinho} />
      <BarraInferior cidadeSlug={cidade} />
    </>
  );
}
