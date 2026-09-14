import { expect, test } from '@playwright/test';
import { ESTADOS_DE_SESSAO } from './apoio';

/**
 * Cadastro de produto pelo lojista.
 *
 * O requisito é "menos de 30 segundos", e o teste guarda isso: se alguém
 * acrescentar um campo obrigatório ao cadastro rápido, ele quebra.
 */
test.describe('painel do lojista', () => {
  test.use({
    baseURL: process.env.E2E_ADMIN_URL ?? 'http://localhost:3001',
    storageState: ESTADOS_DE_SESSAO.lojista,
  });

  test('cadastra um produto com nome e preço apenas', async ({ page }) => {
    await page.goto('/loja/produtos');
    await expect(page.getByRole('heading', { name: 'Produtos' })).toBeVisible();

    const nome = `Produto de teste ${Date.now()}`;

    await page.getByLabel(/nome do produto/i).fill(nome);
    await page.getByLabel('Preço', { exact: true }).fill('12,90');
    await page.getByRole('button', { name: /adicionar ao cardápio/i }).click();

    await expect(page.getByRole('status')).toContainText(/no cardápio/i);
    // `exact` porque a mensagem de sucesso também contém o nome do produto.
    await expect(page.getByText(nome, { exact: true })).toBeVisible();
  });

  test('pausa e reativa um produto com um clique', async ({ page }) => {
    await page.goto('/loja/produtos');

    const pausar = page.getByRole('button', { name: /^pausar /i }).first();
    await pausar.waitFor({ state: 'visible' });

    const rotulo = (await pausar.getAttribute('aria-label')) ?? '';
    const nomeDoProduto = rotulo.replace(/^pausar /i, '');

    await pausar.click();

    // A mesma linha passa a oferecer "Reativar": o estado muda no lugar, sem
    // recarregar a lista inteira.
    const reativar = page.getByRole('button', { name: `Reativar ${nomeDoProduto}` });
    await expect(reativar).toBeVisible();

    // Devolve o produto ao cardápio. Os testes compartilham o banco semeado, e
    // deixar um item pausado quebraria o fluxo de pedido do cliente — que é
    // justamente o teste mais importante da suíte.
    await reativar.click();
    await expect(page.getByRole('button', { name: `Pausar ${nomeDoProduto}` })).toBeVisible();
  });
});
