import { expect, test } from '@playwright/test';
import { ESTADOS_DE_SESSAO } from './apoio';

/**
 * Painel da plataforma e a fronteira entre os papéis.
 *
 * Loja que não é aprovada não aparece para ninguém — é o gargalo de entrada da
 * plataforma. E o painel da plataforma é o alvo mais valioso do sistema.
 */
test.describe('painel da plataforma', () => {
  test.use({
    baseURL: process.env.E2E_ADMIN_URL ?? 'http://localhost:3001',
    storageState: ESTADOS_DE_SESSAO.superAdmin,
  });

  test('lista as lojas e abre o detalhe', async ({ page }) => {
    await page.goto('/admin/lojas');
    await expect(page.getByRole('heading', { name: 'Lojas' })).toBeVisible();

    // O seed cria 10 lojas ativas em Palmital. O link do detalhe é o próprio
    // nome da loja, que varia — por isso a busca é pelo destino.
    await page.locator('a[href^="/admin/lojas/"]').first().click();
    await expect(page).toHaveURL(/\/admin\/lojas\/.+/);
  });

  test('o super admin chega ao painel da plataforma pela raiz', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/admin/);
  });
});

test.describe('fronteira entre papéis', () => {
  test.use({
    baseURL: process.env.E2E_ADMIN_URL ?? 'http://localhost:3001',
    storageState: ESTADOS_DE_SESSAO.lojista,
  });

  test('o lojista não alcança o painel da plataforma', async ({ page }) => {
    await page.goto('/admin');

    // A autorização é no servidor: o lojista é devolvido para o próprio
    // painel, e não chega a ver a tela por um instante antes de ser expulso.
    await expect(page).not.toHaveURL(/\/admin/);
  });
});
