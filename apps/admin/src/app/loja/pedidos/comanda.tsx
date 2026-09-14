'use client';

import { useEffect, useState } from 'react';
import { Button } from '@rapidinho/ui';
import { formatCents, PAYMENT_METHOD_LABEL } from '@rapidinho/shared';
import { formatarEndereco, lerEndereco, type PedidoNaTela } from './tipos';

/**
 * Comanda para impressora térmica.
 *
 * Impressora térmica não entende layout: ela imprime uma coluna de largura
 * fixa. Por isso o CSS de impressão zera margem, fixa a largura do papel e usa
 * fonte monoespaçada — é o que faz as colunas de preço alinharem no papel.
 *
 * 58mm e 80mm são os dois tamanhos que existem no balcão; a escolha fica com o
 * lojista porque ele sabe qual comprou.
 */

const LARGURAS = {
  '58mm': { papel: '58mm', conteudo: '54mm', fonte: '11px', colunas: 32 },
  '80mm': { papel: '80mm', conteudo: '76mm', fonte: '12px', colunas: 48 },
} as const;

type Largura = keyof typeof LARGURAS;

const CHAVE_LARGURA = 'rapidinho.comanda.largura';

function cssDaComanda(medidas: (typeof LARGURAS)[Largura]): string {
  return `.comanda {
          width: ${medidas.conteudo};
          font-family: 'Courier New', monospace;
          font-size: ${medidas.fonte};
          line-height: 1.35;
          color: #000;
        }
        .comanda p {
          margin: 0;
          /* Nome de produto longo tem de quebrar: cortar esconde o pedido. */
          overflow-wrap: anywhere;
        }
        .comanda .centro {
          text-align: center;
        }
        .comanda .negrito {
          font-weight: 700;
        }
        .comanda .recuo {
          padding-left: 1.5ch;
        }
        .comanda .preco {
          float: right;
        }
        .comanda .item {
          margin-bottom: 2px;
          /* Um item não pode ser partido entre dois pedaços de papel. */
          break-inside: avoid;
        }

        @media print {
          /* A impressora térmica não tem margem física: qualquer margem aqui
             empurra o conteúdo para fora do papel. */
          @page {
            size: ${medidas.papel} auto;
            margin: 0;
          }
          body * {
            visibility: hidden;
          }
          .comanda,
          .comanda * {
            visibility: visible;
          }
          .comanda {
            position: absolute;
            left: 0;
            top: 0;
          }
          .no-print {
            display: none !important;
          }
        }`;
}

export function abrirImpressao(): void {
  window.print();
}

export function Comanda({
  pedido,
  loja,
  onFechar,
}: {
  pedido: PedidoNaTela;
  loja: string;
  onFechar: () => void;
}) {
  const [largura, setLargura] = useState<Largura>('80mm');

  // A largura é do equipamento, não do pedido: lembrar a escolha evita que o
  // lojista tenha de reajustar a cada impressão.
  useEffect(() => {
    try {
      const salva = localStorage.getItem(CHAVE_LARGURA);
      if (salva === '58mm' || salva === '80mm') setLargura(salva);
    } catch {
      // Navegador com armazenamento bloqueado: segue com o padrão.
    }
  }, []);

  function escolher(nova: Largura) {
    setLargura(nova);
    try {
      localStorage.setItem(CHAVE_LARGURA, nova);
    } catch {
      // Sem persistência, a escolha ainda vale para esta impressão.
    }
  }

  const medidas = LARGURAS[largura];
  const endereco = lerEndereco(pedido.addressSnapshot);
  const separador = '-'.repeat(medidas.colunas);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/60 print:static print:bg-transparent">
      <div className="no-print flex flex-wrap items-center justify-between gap-3 bg-white p-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">Largura do papel:</span>
          {(Object.keys(LARGURAS) as Largura[]).map((opcao) => (
            <Button
              key={opcao}
              variant={largura === opcao ? 'default' : 'outline'}
              size="sm"
              onClick={() => escolher(opcao)}
            >
              {opcao}
            </Button>
          ))}
        </div>
        <div className="flex gap-2">
          <Button onClick={abrirImpressao}>Imprimir</Button>
          <Button variant="ghost" onClick={onFechar}>
            Fechar
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-white p-4 print:overflow-visible print:p-0">
        <div className="comanda mx-auto bg-white">
          <p className="centro negrito">{loja}</p>
          <p className="centro">PEDIDO #{pedido.number}</p>
          <p className="centro">
            {new Date(pedido.createdAt).toLocaleString('pt-BR', {
              day: '2-digit',
              month: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
          <p>{separador}</p>

          <p className="negrito">{pedido.type === 'PICKUP' ? 'RETIRADA NO LOCAL' : 'ENTREGA'}</p>
          <p>{pedido.customerName}</p>
          <p>{pedido.customerPhone}</p>
          {endereco ? (
            <>
              <p>{formatarEndereco(endereco)}</p>
              {endereco.complement ? <p>{endereco.complement}</p> : null}
              {endereco.referencePoint ? (
                <p className="negrito">REF: {endereco.referencePoint}</p>
              ) : null}
            </>
          ) : null}
          <p>{separador}</p>

          {pedido.items.map((item) => (
            <div key={item.id} className="item">
              <p className="negrito">
                {item.weightGrams
                  ? `${(item.weightGrams / 1000).toFixed(3)}kg`
                  : `${item.quantity}x`}{' '}
                {item.productName}
                {item.pizzaSizeName ? ` (${item.pizzaSizeName})` : ''}
                <span className="preco">{formatCents(item.totalCents)}</span>
              </p>
              {item.flavors.length > 0 ? (
                <p className="recuo">{item.flavors.map((sabor) => sabor.flavorName).join(' / ')}</p>
              ) : null}
              {item.complements.map((complemento) => (
                <p key={complemento.id} className="recuo">
                  + {complemento.quantity}x {complemento.optionName}
                </p>
              ))}
              {item.pizzaExtraName ? <p className="recuo">+ {item.pizzaExtraName}</p> : null}
              {item.notes ? <p className="recuo negrito">OBS: {item.notes}</p> : null}
            </div>
          ))}

          <p>{separador}</p>
          <p>
            Subtotal<span className="preco">{formatCents(pedido.subtotalCents)}</span>
          </p>
          {pedido.deliveryFeeCents > 0 ? (
            <p>
              Entrega<span className="preco">{formatCents(pedido.deliveryFeeCents)}</span>
            </p>
          ) : null}
          {pedido.discountCents > 0 ? (
            <p>
              Desconto<span className="preco">-{formatCents(pedido.discountCents)}</span>
            </p>
          ) : null}
          <p className="negrito">
            TOTAL<span className="preco">{formatCents(pedido.totalCents)}</span>
          </p>

          {pedido.payment ? (
            <>
              <p>{separador}</p>
              <p>
                {PAYMENT_METHOD_LABEL[pedido.payment.method as keyof typeof PAYMENT_METHOD_LABEL] ??
                  pedido.payment.method}
              </p>
              {pedido.payment.changeForCents ? (
                <p className="negrito">
                  TROCO PARA {formatCents(pedido.payment.changeForCents)}
                  <span className="preco">
                    {formatCents(pedido.payment.changeForCents - pedido.totalCents)}
                  </span>
                </p>
              ) : null}
            </>
          ) : null}

          {pedido.notes ? (
            <>
              <p>{separador}</p>
              <p className="negrito">OBS: {pedido.notes}</p>
            </>
          ) : null}

          <p>{separador}</p>
          <p className="centro">Obrigado pela preferencia!</p>
        </div>
      </div>

      {/* <style> puro em vez de `<style jsx>`: aquele exige o styled-jsx, e
          é dependência demais para uma folha de estilo de impressão. */}
      <style dangerouslySetInnerHTML={{ __html: cssDaComanda(medidas) }} />
    </div>
  );
}
