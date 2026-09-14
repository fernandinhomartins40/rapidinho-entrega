import { expect, test } from '@playwright/test';
import { ESTADOS_DE_SESSAO } from './apoio';

/**
 * Central de notificações da plataforma.
 *
 * Push é o canal mais fácil de queimar: quem desliga não religa. Por isso os
 * dois comportamentos cobertos aqui são os que impedem um envio ruim — o
 * alcance conferido antes e a recusa de link para fora do app.
 */
test.describe('central de notificações', () => {
  test.use({
    baseURL: process.env.E2E_ADMIN_URL ?? 'http://localhost:3001',
    storageState: ESTADOS_DE_SESSAO.superAdmin,
  });

  test('mostra o alcance antes de enviar', async ({ page }) => {
    await page.goto('/admin/notificacoes');
    await expect(page.getByRole('heading', { name: 'Notificações' })).toBeVisible();

    await page.getByLabel('Título').fill('Teste de alcance');
    await page.getByLabel('Mensagem').fill('Conferindo quantas pessoas receberiam.');
    await page.getByRole('button', { name: 'Ver alcance' }).click();

    // O seed não cria ninguém com opt-in de marketing e push instalado, então
    // o esperado aqui é justamente o aviso de alcance zero — que é o que
    // impede o envio às cegas.
    await expect(page.getByRole('status')).toContainText(/pessoa/);
  });

  test('recusa link para fora do app — é o formato que um golpe imitaria', async ({ page }) => {
    await page.goto('/admin/notificacoes');

    await page.getByLabel('Título').fill('Promoção');
    await page.getByLabel('Mensagem').fill('Confira agora.');
    await page.getByLabel('Abrir ao tocar').fill('https://site-falso.com');
    await page.getByRole('button', { name: 'Enviar campanha' }).click();

    await expect(page.getByText(/caminho do app/i)).toBeVisible();
  });
});
