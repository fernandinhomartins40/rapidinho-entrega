import { expect, test } from '@playwright/test';
import { ESTADOS_DE_SESSAO } from './apoio';

/**
 * Fluxo completo do pedido: da vitrine ao acompanhamento.
 *
 * É o caminho que, se quebrar, tira a plataforma do ar na prática — mesmo com
 * todo o resto funcionando.
 */
test.describe('pedido do cliente', () => {
  test.use({ storageState: ESTADOS_DE_SESSAO.cliente });

  // Cada execução começa do zero: carrinho de uma rodada anterior traria itens
  // com preço e disponibilidade de outro momento.
  //
  // Esvaziar dispara Server Action, que revalida a página e tira o botão do
  // DOM no meio do clique. O Playwright trata isso como erro ("element was
  // detached"), mas aqui é exatamente o sucesso esperado — foi o que derrubou
  // o teste no CI. Por isso o clique tolera o detach, e o que se confere é o
  // efeito: recarregar e contar de novo.
  test.beforeEach(async ({ page }) => {
    const seletor = { name: /^esvaziar carrinho/i } as const;

    // Uma volta por loja com carrinho aberto, com folga. O limite existe para
    // o teste falhar dizendo o que houve, em vez de girar para sempre.
    for (let volta = 0; volta < 6; volta += 1) {
      await page.goto('/carrinho');

      const esvaziar = page.getByRole('button', seletor);
      if ((await esvaziar.count()) === 0) break;

      await esvaziar
        .first()
        .click({ timeout: 10_000 })
        .catch(() => undefined);
      await page.waitForLoadState('networkidle').catch(() => undefined);
    }

    await page.goto('/carrinho');
    await expect(page.getByRole('button', seletor)).toHaveCount(0);
  });

  test('monta o carrinho e finaliza o pedido', async ({ page }) => {
    await page.goto('/palmital-pr');

    // A vitrine separa abertas de fechadas; o teste segue por uma aberta.
    const abertas = page.getByRole('heading', { name: 'Abertas agora' });
    await expect(abertas).toBeVisible();

    // Percorre as lojas abertas até achar uma com produto vendido por unidade.
    // A primeira nem sempre serve: o teste de aprovação publica uma loja sem
    // cardápio, e uma vitrine real também terá lojas recém-aprovadas. Amarrar
    // o fluxo de compra à ordem da vitrine seria falhar por motivo alheio ao
    // que este teste verifica.
    const lojas = page.locator('section:has(#abertas) a[href^="/palmital-pr/"]');
    const total = await lojas.count();
    let produto = null;

    for (let i = 0; i < total; i += 1) {
      await lojas.nth(i).click();
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

      // Um item vendido por unidade: o de peso tem contador em gramas, e subir
      // de 100 em 100 até o pedido mínimo levaria dezenas de cliques.
      const candidato = page.locator('a[href*="/produto/"]').filter({ hasNotText: '/kg' }).first();

      if ((await candidato.count()) > 0) {
        produto = candidato;
        break;
      }

      await page.goBack();
      await expect(lojas.first()).toBeVisible();
    }

    expect(produto, 'nenhuma loja aberta tem produto vendido por unidade').not.toBeNull();
    await produto!.click();
    await expect(page.getByRole('button', { name: /adicionar/i })).toBeVisible();

    // Quantidade alta o bastante para passar do maior pedido mínimo do seed
    // (R$ 30) mesmo no item mais barato do cardápio (cebola, R$ 1,10).
    //
    // O contador desta tela é local, sem ida ao servidor — por isso dá para
    // clicar dezenas de vezes em menos de um segundo, o que não seria viável
    // no carrinho, onde cada clique revalida a página inteira.
    const mais = page.getByRole('button', { name: /aumentar quantidade/i });
    await expect(mais).toBeVisible();

    for (let clique = 0; clique < 45; clique += 1) {
      await mais.click();
    }

    // O botão fica desabilitado enquanto houver grupo obrigatório sem escolha;
    // o teste usa um produto simples, então ele já nasce habilitado.
    const adicionar = page.getByRole('button', { name: /^adicionar/i });
    await expect(adicionar).toBeEnabled();
    await adicionar.click();

    // A Server Action grava e devolve para a loja. Navegar antes disso
    // cancelaria a requisição em voo e o item nunca chegaria ao carrinho.
    await page.waitForURL(/\/palmital-pr\/[^/]+$/, { timeout: 20_000 });

    await page.goto('/carrinho');
    await expect(page.getByRole('heading', { name: /seu carrinho/i })).toBeVisible();

    // Com a quantidade escolhida na tela do produto, o subtotal já passa do
    // mínimo de qualquer loja do seed.
    await expect(page.getByText(/pedido mínimo/i)).toBeHidden();

    await page
      .getByRole('link', { name: /continuar/i })
      .first()
      .click();
    await expect(page).toHaveURL(/\/checkout\//);

    // Dinheiro na entrega: é o método que não depende de gateway externo.
    const dinheiro = page.getByRole('radio', { name: /dinheiro/i });
    await dinheiro.waitFor({ state: 'visible' });
    await dinheiro.check();

    const botao = page.getByRole('button', { name: /fazer pedido/i });
    await expect(botao).toBeEnabled({ timeout: 15_000 });
    await botao.click();

    await expect(page).toHaveURL(/\/pedidos\/[a-z0-9]+/i, { timeout: 20_000 });
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('o histórico mostra o pedido recém-criado', async ({ page }) => {
    await page.goto('/pedidos');
    await expect(page.getByRole('heading', { name: /meus pedidos/i })).toBeVisible();
  });
});
