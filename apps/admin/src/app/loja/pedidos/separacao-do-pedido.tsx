'use client';

import { useEffect, useState, useTransition } from 'react';
import { Check, MessageCircle, RotateCcw, Scale, X } from 'lucide-react';
import { Button, cn } from '@rapidinho/ui';
import {
  faixaDePeso,
  fecharContaDaSeparacao,
  formatCents,
  formatGrams,
  lerPesoDigitado,
  MINUTOS_PARA_RESPOSTA_DE_TROCA,
  parseCurrencyToCents,
  valorDoItemSeparado,
  whatsappLink,
} from '@rapidinho/shared';
import { concluirSeparacao, registrarItemDaSeparacao } from './separacao';
import type { ItemDoPedido, PedidoNaTela } from './tipos';

/**
 * Separação na tela da loja: um item por linha, com a balança na mão.
 *
 * A prévia do total usa a mesma regra do servidor (`fecharContaDaSeparacao`),
 * então o que a loja vê aqui é o que o cliente vai pagar.
 */

type Resultado = { ok: boolean; message?: string };

/** Pago online (Pix/cartão): o que já foi pago, descontado o que voltou. */
export function pagoOnlineDoPedido(pedido: PedidoNaTela): number | null {
  const pagamento = pedido.payment;
  return pagamento &&
    pagamento.status === 'PAID' &&
    pagamento.provider !== 'OFFLINE' &&
    (pagamento.method === 'PIX' || pagamento.method === 'CREDIT_CARD_ONLINE')
    ? pagamento.amountCents - pagamento.refundedCents
    : null;
}

export function SeparacaoDoPedido({ pedido }: { pedido: PedidoNaTela }) {
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  function executar(acao: () => Promise<Resultado>) {
    setErro(null);
    iniciar(async () => {
      const resultado = await acao();
      if (!resultado.ok) setErro(resultado.message ?? 'Não foi possível concluir.');
      else if (resultado.message) setAviso(resultado.message);
    });
  }

  const pagoOnline = pagoOnlineDoPedido(pedido);
  const conta = fecharContaDaSeparacao({
    itens: pedido.items,
    totalEstimadoCents: pedido.totalCents,
    deliveryFeeCents: pedido.deliveryFeeCents,
    surchargeCents: pedido.surchargeCents,
    discountCents: pedido.discountCents,
    commissionRate: 0,
    pagoOnlineCents: pagoOnline,
  });

  const conferidos = pedido.items.filter(
    (item) => item.pickStatus != null && item.pickStatus !== 'AWAITING_CUSTOMER',
  ).length;
  const esperando = pedido.items.some((item) => item.pickStatus === 'AWAITING_CUSTOMER');
  const pronto = conferidos === pedido.items.length;

  return (
    <section className="space-y-3 rounded-xl border-2 border-dashed p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 font-semibold">
          <Scale className="h-4 w-4" aria-hidden />
          Separação
        </p>
        <span className="text-muted-foreground text-xs font-medium">
          {conferidos} de {pedido.items.length} conferidos
        </span>
      </div>

      {pagoOnline != null ? (
        <p className="text-muted-foreground text-xs">
          Pago online: peso a menos volta automático para o cliente; peso a mais não é cobrado.
          Corte o mais perto do pedido.
        </p>
      ) : (
        <p className="text-muted-foreground text-xs">
          Paga na entrega: o entregador cobra o valor final, pelo peso real (até +10% do pedido).
        </p>
      )}

      <ul className="divide-y">
        {pedido.items.map((item) => (
          <LinhaDaSeparacao
            key={item.id}
            item={item}
            pedido={pedido}
            pendente={pendente}
            onExecutar={executar}
          />
        ))}
      </ul>

      <div className="bg-secondary space-y-1 rounded-lg p-3 text-sm">
        <p className="flex justify-between">
          <span className="text-muted-foreground">Estimado no pedido</span>
          <span>{formatCents(pedido.totalCents)}</span>
        </p>
        <p className="flex justify-between font-bold">
          <span>Total final (prévia)</span>
          <span>{formatCents(conta.totalCents)}</span>
        </p>
        {conta.estornoCents > 0 ? (
          <p className="text-success flex justify-between">
            <span>Volta para o cliente</span>
            <span>{formatCents(conta.estornoCents)}</span>
          </p>
        ) : null}
        {conta.cortesiaCents > 0 ? (
          <p className="text-warning-text flex justify-between">
            <span>Por conta da loja (acima do teto)</span>
            <span>{formatCents(conta.cortesiaCents)}</span>
          </p>
        ) : null}
      </div>

      {erro ? <p className="text-destructive text-sm font-medium">{erro}</p> : null}
      {aviso ? <p className="text-success text-sm font-medium">{aviso}</p> : null}

      <Button
        block
        size="lg"
        disabled={!pronto || esperando || pendente}
        isLoading={pendente}
        onClick={() => executar(() => concluirSeparacao(pedido.id))}
      >
        <Check className="h-5 w-5" aria-hidden />
        {esperando
          ? 'Esperando o cliente responder'
          : pronto
            ? `Concluir separação · ${formatCents(conta.totalCents)}`
            : 'Confira todos os itens'}
      </Button>
    </section>
  );
}

function LinhaDaSeparacao({
  item,
  pedido,
  pendente,
  onExecutar,
}: {
  item: ItemDoPedido;
  pedido: PedidoNaTela;
  pendente: boolean;
  onExecutar: (acao: () => Promise<Resultado>) => void;
}) {
  const [peso, setPeso] = useState('');
  const [faltou, setFaltou] = useState(false);
  const [trocaNome, setTrocaNome] = useState('');
  const [trocaPreco, setTrocaPreco] = useState('');
  const agora = useAgoraEmMinutos();

  const porPeso = item.weightGrams != null;
  const politica = pedido.substitutionPolicy;
  const base = { orderId: pedido.id, itemId: item.id };
  const desfazer = () => onExecutar(() => registrarItemDaSeparacao({ ...base, acao: 'RESET' }));

  const pesoGramas = porPeso ? lerPesoDigitado(peso) : null;
  const previa =
    porPeso && pesoGramas
      ? valorDoItemSeparado({ ...item, pickStatus: 'PICKED', pickedWeightGrams: pesoGramas })
      : null;
  const faixa = porPeso ? faixaDePeso(item.weightGrams!) : null;

  const trocaCents = trocaPreco ? parseCurrencyToCents(trocaPreco) : 0;
  const trocaValida = trocaNome.trim().length >= 2 && trocaCents > 0;

  const titulo = (
    <p className="font-medium">
      {porPeso ? formatGrams(item.weightGrams!) : `${item.quantity}×`} {item.productName}
      <span className="text-muted-foreground float-right font-normal">
        {formatCents(item.totalCents)}
      </span>
    </p>
  );

  // Já conferido: mostra o que foi decidido e deixa desfazer.
  if (item.pickStatus != null) {
    const valor = valorDoItemSeparado(item);
    const minutos =
      item.questionAskedAt && agora != null
        ? Math.floor((agora - new Date(item.questionAskedAt).getTime()) / 60_000)
        : null;

    return (
      <li className="space-y-1.5 py-2.5 text-sm">
        {titulo}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p
            className={cn(
              'font-medium',
              item.pickStatus === 'MISSING' && 'text-destructive',
              item.pickStatus === 'AWAITING_CUSTOMER' && 'text-warning-text',
              (item.pickStatus === 'PICKED' || item.pickStatus === 'REPLACED') && 'text-success',
            )}
          >
            {item.pickStatus === 'PICKED'
              ? porPeso && item.pickedWeightGrams
                ? `Pesou ${formatGrams(item.pickedWeightGrams)} · ${formatCents(valor.finalCents)}`
                : 'Separado'
              : item.pickStatus === 'MISSING'
                ? 'Em falta — sai da conta'
                : item.pickStatus === 'REPLACED'
                  ? `Trocado por ${item.replacementName} · ${formatCents(valor.finalCents)}${item.replacementAccepted ? ' (cliente aceitou)' : ''}`
                  : `Perguntado ao cliente: ${item.replacementName} por ${formatCents(item.replacementPriceCents ?? 0)}${minutos != null ? ` · há ${minutos} min` : ''}`}
          </p>
          <Button size="sm" variant="ghost" disabled={pendente} onClick={desfazer}>
            <RotateCcw className="h-4 w-4" aria-hidden />
            Desfazer
          </Button>
        </div>
        {valor.cortesiaCents > 0 ? (
          <p className="text-warning-text text-xs">
            {formatCents(valor.cortesiaCents)} acima do teto ficam por conta da loja.
          </p>
        ) : null}
        {item.pickStatus === 'AWAITING_CUSTOMER' ? (
          <div className="flex flex-wrap gap-2">
            {minutos != null && minutos >= MINUTOS_PARA_RESPOSTA_DE_TROCA ? (
              <Button
                size="sm"
                variant="outline"
                disabled={pendente}
                onClick={() =>
                  onExecutar(() => registrarItemDaSeparacao({ ...base, acao: 'MISSING' }))
                }
              >
                Sem resposta: tirar do pedido
              </Button>
            ) : null}
            <Button asChild size="sm" variant="ghost">
              <a href={whatsappLink(pedido.customerPhone)} target="_blank" rel="noreferrer">
                <MessageCircle className="h-4 w-4" aria-hidden />
                WhatsApp
              </a>
            </Button>
          </div>
        ) : null}
      </li>
    );
  }

  return (
    <li className="space-y-2 py-2.5 text-sm">
      {titulo}

      {porPeso ? (
        <div className="space-y-1">
          <div className="flex gap-2">
            <input
              value={peso}
              onChange={(evento) => setPeso(evento.target.value)}
              inputMode="decimal"
              placeholder={`Peso na balança (ex.: ${(item.weightGrams! / 1000).toLocaleString('pt-BR', { minimumFractionDigits: 3 })})`}
              aria-label={`Peso de ${item.productName} em kg`}
              className="border-input min-h-touch min-w-0 flex-1 rounded-lg border px-3"
            />
            <Button
              disabled={pendente || !pesoGramas}
              onClick={() =>
                onExecutar(() =>
                  registrarItemDaSeparacao({
                    ...base,
                    acao: 'PICKED',
                    pesoGramas: pesoGramas ?? undefined,
                  }),
                )
              }
            >
              <Scale className="h-4 w-4" aria-hidden />
              Pesado
            </Button>
          </div>
          <p
            className={cn(
              'text-xs',
              previa && previa.cortesiaCents > 0 ? 'text-warning-text' : 'text-muted-foreground',
            )}
          >
            {previa
              ? previa.cortesiaCents > 0
                ? `Passou de +10%: cobra ${formatCents(previa.finalCents)} e ${formatCents(previa.cortesiaCents)} ficam por conta da loja. Dá para cortar?`
                : `Cliente paga ${formatCents(previa.finalCents)} por ${formatGrams(pesoGramas!)}.`
              : `Ideal entre ${formatGrams(faixa!.minimo)} e ${formatGrams(faixa!.maximo)}.`}
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {!porPeso ? (
          <Button
            size="sm"
            disabled={pendente}
            onClick={() => onExecutar(() => registrarItemDaSeparacao({ ...base, acao: 'PICKED' }))}
          >
            <Check className="h-4 w-4" aria-hidden />
            Separado
          </Button>
        ) : null}
        <Button
          size="sm"
          variant={faltou ? 'secondary' : 'outline'}
          disabled={pendente}
          onClick={() => setFaltou((atual) => !atual)}
        >
          <X className="h-4 w-4" aria-hidden />
          Faltou
        </Button>
      </div>

      {faltou ? (
        <div className="space-y-2 rounded-lg border p-3">
          {politica !== 'REMOVE_ITEM' ? (
            <>
              <p className="text-xs font-semibold">
                {politica === 'CONTACT_ME'
                  ? 'O cliente quer ser consultado. Sugira uma troca:'
                  : 'Trocar por similar (nunca cobra mais que o original):'}
              </p>
              <div className="flex gap-2">
                <input
                  value={trocaNome}
                  onChange={(evento) => setTrocaNome(evento.target.value)}
                  placeholder="O que vai no lugar"
                  aria-label="Produto da troca"
                  className="border-input min-h-touch min-w-0 flex-1 rounded-lg border px-3"
                />
                <input
                  value={trocaPreco}
                  onChange={(evento) => setTrocaPreco(evento.target.value)}
                  inputMode="decimal"
                  placeholder="R$"
                  aria-label="Preço da troca"
                  className="border-input min-h-touch w-24 rounded-lg border px-3"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {politica !== 'CONTACT_ME' ? (
                  <Button
                    size="sm"
                    disabled={pendente || !trocaValida}
                    onClick={() =>
                      onExecutar(() =>
                        registrarItemDaSeparacao({
                          ...base,
                          acao: 'REPLACED',
                          trocaNome: trocaNome.trim(),
                          trocaPrecoCents: trocaCents,
                        }),
                      )
                    }
                  >
                    Trocar
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  variant={politica === 'CONTACT_ME' ? 'default' : 'outline'}
                  disabled={pendente || !trocaValida}
                  onClick={() =>
                    onExecutar(() =>
                      registrarItemDaSeparacao({
                        ...base,
                        acao: 'ASK',
                        trocaNome: trocaNome.trim(),
                        trocaPrecoCents: trocaCents,
                      }),
                    )
                  }
                >
                  <MessageCircle className="h-4 w-4" aria-hidden />
                  Perguntar ao cliente pelo app
                </Button>
              </div>
            </>
          ) : (
            <p className="text-xs font-semibold">O cliente pediu: se faltar, tirar o item.</p>
          )}
          <Button
            size="sm"
            variant="ghost"
            disabled={pendente}
            onClick={() => onExecutar(() => registrarItemDaSeparacao({ ...base, acao: 'MISSING' }))}
          >
            Tirar do pedido
          </Button>
        </div>
      ) : null}
    </li>
  );
}

/** Relógio de minuto em minuto, só depois de montar (evita diferença SSR). */
function useAgoraEmMinutos(): number | null {
  const [agora, setAgora] = useState<number | null>(null);
  useEffect(() => {
    setAgora(Date.now());
    const intervalo = setInterval(() => setAgora(Date.now()), 30_000);
    return () => clearInterval(intervalo);
  }, []);
  return agora;
}
