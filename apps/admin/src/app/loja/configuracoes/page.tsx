import { prisma } from '@rapidinho/database';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@rapidinho/ui';
import { formatCents } from '@rapidinho/shared';
import { getStoreContext } from '@/lib/store-context';
import { imagemExibivel, SELECT_IMAGEM } from '@/lib/media';
import { FormulariosDeConfiguracao } from './formularios';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Configurações' };

export default async function ConfiguracoesPage() {
  const { store, access } = await getStoreContext();

  const loja = await prisma.store.findUniqueOrThrow({
    where: { id: store.id },
    select: {
      name: true,
      description: true,
      phone: true,
      whatsapp: true,
      email: true,
      document: true,
      legalName: true,
      street: true,
      number: true,
      neighborhood: true,
      referencePoint: true,
      zipCode: true,
      acceptsPix: true,
      acceptsCardOnline: true,
      acceptsCashOnDelivery: true,
      acceptsCardOnDelivery: true,
      pixKey: true,
      soundAlertEnabled: true,
      autoAcceptOrders: true,
      logoId: true,
      coverId: true,
      logo: { select: SELECT_IMAGEM },
      cover: { select: SELECT_IMAGEM },
      subscription: {
        select: {
          status: true,
          currentPeriodEnd: true,
          plan: { select: { name: true, monthlyPriceCents: true, commissionRate: true } },
        },
      },
    },
  });

  const podeEditar = access.staffRole === 'OWNER' || access.isPlatformAdmin;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground mt-1">Dados da loja, pagamento e preferências.</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Seu plano</CardTitle>
        </CardHeader>
        <CardContent>
          {loja.subscription ? (
            <div className="space-y-1">
              <p className="font-semibold">
                {loja.subscription.plan.name}{' '}
                <Badge variant={loja.subscription.status === 'ACTIVE' ? 'success' : 'warning'}>
                  {loja.subscription.status === 'ACTIVE' ? 'Ativo' : loja.subscription.status}
                </Badge>
              </p>
              <p className="text-muted-foreground text-sm">
                {loja.subscription.plan.monthlyPriceCents === 0
                  ? 'Sem mensalidade'
                  : `${formatCents(loja.subscription.plan.monthlyPriceCents)} por mês`}{' '}
                · comissão de {Number(loja.subscription.plan.commissionRate)}% por pedido
              </p>
              {loja.subscription.currentPeriodEnd ? (
                <p className="text-muted-foreground text-sm">
                  Próxima cobrança em{' '}
                  {loja.subscription.currentPeriodEnd.toLocaleDateString('pt-BR')}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="text-muted-foreground">
              Sua loja ainda não tem plano. Fale com o suporte para escolher um.
            </p>
          )}
        </CardContent>
      </Card>

      {podeEditar ? (
        <FormulariosDeConfiguracao
          loja={{
            ...loja,
            logoUrl: imagemExibivel(loja.logo, 'medium').url,
            coverUrl: imagemExibivel(loja.cover, 'large').url,
          }}
        />
      ) : (
        <Card>
          <CardContent className="text-muted-foreground pt-6">
            Só o dono da loja altera estes dados. Peça a ele se algo aqui precisa mudar.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
