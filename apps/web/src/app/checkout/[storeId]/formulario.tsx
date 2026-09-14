'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Banknote, CreditCard, MapPin, QrCode, Store } from 'lucide-react';
import { Button, Card, CardContent, Input, Label, cn } from '@rapidinho/ui';
import { formatCents, PAYMENT_METHOD_LABEL } from '@rapidinho/shared';
import type { CarrinhoResolvido } from '@/lib/cart';
import type { ResumoDoCheckout } from '@/lib/checkout';
import { finalizarPedido } from '../actions';
import { ACTION_IDLE } from '@/lib/action-state';

type Pagamento = 'PIX' | 'CREDIT_CARD_ONLINE' | 'CASH_ON_DELIVERY' | 'CARD_ON_DELIVERY';

interface Endereco {
  id: string;
  label: string | null;
  street: string;
  number: string | null;
  complement: string | null;
  neighborhood: string;
  referencePoint: string | null;
  isDefault: boolean;
}

const ICONE: Record<Pagamento, typeof QrCode> = {
  PIX: QrCode,
  CREDIT_CARD_ONLINE: CreditCard,
  CASH_ON_DELIVERY: Banknote,
  CARD_ON_DELIVERY: CreditCard,
};

export function FormularioDeCheckout({
  carrinho,
  loja,
  enderecos,
  resumo,
  tipo,
  enderecoEscolhido,
  cupom,
  cliente,
}: {
  carrinho: CarrinhoResolvido;
  loja: {
    id: string;
    nome: string;
    slug: string;
    aceitaRetirada: boolean;
    pagamentos: Record<Pagamento, boolean>;
    tempoMin: number;
    cidadeSlug: string;
    cidadeId: string;
  };
  enderecos: Endereco[];
  resumo: ResumoDoCheckout;
  tipo: 'DELIVERY' | 'PICKUP';
  enderecoEscolhido: string | null;
  cupom: string;
  cliente: { nome: string | null; telefone: string | null };
}) {
  const router = useRouter();
  const [estado, acao, pendente] = useActionState(finalizarPedido, ACTION_IDLE);
  const [pagamento, setPagamento] = useState<Pagamento | null>(null);
  const [troco, setTroco] = useState('');
  const [codigoDoCupom, setCodigoDoCupom] = useState(cupom);

  const disponiveis = (Object.keys(loja.pagamentos) as Pagamento[]).filter(
    (metodo) => loja.pagamentos[metodo],
  );

  /** Recarrega a página com a escolha na URL: o servidor recalcula tudo. */
  function atualizarBusca(campo: string, valor: string) {
    const parametros = new URLSearchParams({
      tipo,
      ...(enderecoEscolhido ? { endereco: enderecoEscolhido } : {}),
      ...(codigoDoCupom ? { cupom: codigoDoCupom } : {}),
    });

    if (valor) parametros.set(campo, valor);
    else parametros.delete(campo);

    router.replace(`/checkout/${loja.id}?${parametros.toString()}`);
  }

  return (
    <main className="mx-auto max-w-lg px-5 py-6 pb-40">
      <h1 className="text-2xl font-bold tracking-tight">Finalizar pedido</h1>
      <p className="text-muted-foreground mt-1">
        {loja.nome} · chega em cerca de {loja.tempoMin} min
      </p>

      <form action={acao} className="mt-6 space-y-5">
        <input type="hidden" name="storeId" value={loja.id} />
        <input type="hidden" name="type" value={tipo} />
        <input type="hidden" name="addressId" value={enderecoEscolhido ?? ''} />
        <input type="hidden" name="couponCode" value={codigoDoCupom} />
        <input type="hidden" name="notes" value={carrinho.notes ?? ''} />

        {loja.aceitaRetirada ? (
          <Card>
            <CardContent className="grid gap-2 pt-5 sm:grid-cols-2">
              <button
                type="button"
                aria-pressed={tipo === 'DELIVERY'}
                onClick={() => atualizarBusca('tipo', 'DELIVERY')}
                className={cn(
                  'min-h-touch flex items-center gap-2 rounded-xl border-2 p-3 text-left',
                  tipo === 'DELIVERY' ? 'border-primary bg-accent' : 'border-input',
                )}
              >
                <MapPin className="h-5 w-5 shrink-0" aria-hidden />
                <span className="font-semibold">Receber em casa</span>
              </button>
              <button
                type="button"
                aria-pressed={tipo === 'PICKUP'}
                onClick={() => atualizarBusca('tipo', 'PICKUP')}
                className={cn(
                  'min-h-touch flex items-center gap-2 rounded-xl border-2 p-3 text-left',
                  tipo === 'PICKUP' ? 'border-primary bg-accent' : 'border-input',
                )}
              >
                <Store className="h-5 w-5 shrink-0" aria-hidden />
                <span className="font-semibold">Retirar na loja</span>
              </button>
            </CardContent>
          </Card>
        ) : null}

        {tipo === 'DELIVERY' ? (
          <Card>
            <CardContent className="space-y-3 pt-5">
              <p className="font-semibold">Onde entregar</p>

              {enderecos.length === 0 ? (
                <div className="space-y-2">
                  <p className="text-muted-foreground text-sm">
                    Você ainda não tem endereço cadastrado.
                  </p>
                  <Button asChild variant="outline">
                    <Link
                      href={`/enderecos/novo?cidade=${loja.cidadeId}&voltar=/checkout/${loja.id}`}
                    >
                      Cadastrar endereço
                    </Link>
                  </Button>
                </div>
              ) : (
                <>
                  <ul className="space-y-2">
                    {enderecos.map((endereco) => (
                      <li key={endereco.id}>
                        <button
                          type="button"
                          aria-pressed={enderecoEscolhido === endereco.id}
                          onClick={() => atualizarBusca('endereco', endereco.id)}
                          className={cn(
                            'min-h-touch w-full rounded-xl border-2 p-3 text-left',
                            enderecoEscolhido === endereco.id
                              ? 'border-primary bg-accent'
                              : 'border-input',
                          )}
                        >
                          <span className="block font-medium">
                            {endereco.label ?? endereco.street}
                          </span>
                          <span className="text-muted-foreground block text-sm">
                            {[endereco.street, endereco.number].filter(Boolean).join(', ')} —{' '}
                            {endereco.neighborhood}
                          </span>
                          {endereco.referencePoint ? (
                            <span className="text-muted-foreground block text-sm">
                              Referência: {endereco.referencePoint}
                            </span>
                          ) : null}
                        </button>
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={`/enderecos/novo?cidade=${loja.cidadeId}&voltar=/checkout/${loja.id}`}
                    className="inline-block text-sm font-semibold underline"
                  >
                    Cadastrar outro endereço
                  </Link>
                </>
              )}
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardContent className="space-y-3 pt-5">
            <p className="font-semibold">Como você vai pagar</p>

            <ul className="space-y-2">
              {disponiveis.map((metodo) => {
                const Icone = ICONE[metodo];
                return (
                  <li key={metodo}>
                    <label
                      className={cn(
                        'min-h-touch flex cursor-pointer items-center gap-3 rounded-xl border-2 p-3',
                        pagamento === metodo ? 'border-primary bg-accent' : 'border-input',
                      )}
                    >
                      <input
                        type="radio"
                        name="paymentMethod"
                        value={metodo}
                        checked={pagamento === metodo}
                        onChange={() => setPagamento(metodo)}
                        className="h-5 w-5"
                        required
                      />
                      <Icone className="h-5 w-5 shrink-0" aria-hidden />
                      <span className="font-medium">{PAYMENT_METHOD_LABEL[metodo]}</span>
                    </label>
                  </li>
                );
              })}
            </ul>

            {pagamento === 'CASH_ON_DELIVERY' ? (
              <div>
                <Label htmlFor="changeForCents">Precisa de troco para quanto?</Label>
                <Input
                  id="changeForCents"
                  name="changeForCents"
                  inputMode="decimal"
                  value={troco}
                  onChange={(evento) => setTroco(evento.target.value)}
                  placeholder="Deixe vazio se tiver o valor certo"
                  error={estado.fieldErrors?.changeForCents}
                />
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 pt-5">
            <p className="font-semibold">Cupom de desconto</p>
            <div className="flex gap-2">
              <Input
                value={codigoDoCupom}
                onChange={(evento) => setCodigoDoCupom(evento.target.value.toUpperCase())}
                placeholder="Digite o código"
                className="uppercase"
                aria-label="Código do cupom"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => atualizarBusca('cupom', codigoDoCupom)}
              >
                Aplicar
              </Button>
            </div>
            {resumo.couponMessage ? (
              <p className="text-destructive text-sm font-medium">{resumo.couponMessage}</p>
            ) : null}
            {resumo.discountCents > 0 ? (
              <p className="text-success text-sm font-medium">
                Desconto de {formatCents(resumo.discountCents)} aplicado.
              </p>
            ) : null}
          </CardContent>
        </Card>

        {!cliente.nome ? (
          <Card>
            <CardContent className="space-y-3 pt-5">
              <p className="font-semibold">Como a loja te chama?</p>
              <Input
                name="customerName"
                placeholder="Seu nome"
                required
                error={estado.fieldErrors?.customerName}
              />
            </CardContent>
          </Card>
        ) : null}

        {/* Resumo e botão fixos: em checkout longo o cliente perde de vista o
            total, que é justamente o que ele precisa confirmar. */}
        <div className="bg-card pb-safe fixed inset-x-0 bottom-0 z-30 border-t p-4">
          <div className="mx-auto max-w-lg space-y-2">
            <div className="space-y-1 text-sm">
              <p className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatCents(resumo.subtotalCents)}</span>
              </p>
              {tipo === 'DELIVERY' ? (
                <p className="flex justify-between">
                  <span className="text-muted-foreground">Entrega</span>
                  <span>
                    {resumo.deliveryFeeCents === 0 ? (
                      <span className="text-success font-semibold">Grátis</span>
                    ) : (
                      formatCents(resumo.deliveryFeeCents)
                    )}
                  </span>
                </p>
              ) : null}
              {resumo.discountCents > 0 ? (
                <p className="text-success flex justify-between">
                  <span>Desconto</span>
                  <span>−{formatCents(resumo.discountCents)}</span>
                </p>
              ) : null}
              <p className="flex justify-between text-base font-bold">
                <span>Total</span>
                <span>{formatCents(resumo.totalCents)}</span>
              </p>
            </div>

            {resumo.deliveryFeeReason ? (
              <p className="text-success text-sm font-medium">{resumo.deliveryFeeReason}</p>
            ) : null}

            {resumo.bloqueio ? (
              <p className="text-destructive text-sm font-medium">{resumo.bloqueio}</p>
            ) : null}

            {estado.message && !estado.ok ? (
              <p role="alert" className="text-destructive text-sm font-medium">
                {estado.message}
              </p>
            ) : null}

            <Button
              type="submit"
              size="lg"
              block
              disabled={pendente || resumo.bloqueio != null || pagamento == null}
            >
              {pendente ? 'Enviando…' : `Fazer pedido · ${formatCents(resumo.totalCents)}`}
            </Button>
          </div>
        </div>
      </form>
    </main>
  );
}
