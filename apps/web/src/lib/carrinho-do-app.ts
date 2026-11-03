import { NextResponse } from 'next/server';
import { listarCarrinhos, paraCarrinhoDoApp } from '@rapidinho/services/regras';
import type { RespostaCarrinho } from '@rapidinho/shared/app-api';

/** Toda rota do carrinho devolve o estado final, recalculado do catálogo. */
export async function responderCarrinho(userId: string, status = 200): Promise<NextResponse> {
  const carrinhos = await listarCarrinhos(userId);

  const resposta: RespostaCarrinho = {
    carrinhos: carrinhos.map(({ carrinho, cidadeSlug }) => paraCarrinhoDoApp(carrinho, cidadeSlug)),
    quantidadeDeItens: carrinhos.reduce(
      (soma, { carrinho }) =>
        soma + carrinho.itens.reduce((total, item) => total + item.quantidade, 0),
      0,
    ),
  };

  return NextResponse.json(resposta, { status });
}
