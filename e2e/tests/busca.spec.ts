import { expect, test } from '@playwright/test';

/**
 * Busca sem acento.
 *
 * Quem digita no celular pula o acento — "acucar", "feijao", "linguica". A
 * busca precisa não se importar, e não se importava: `contains` do Prisma vira
 * `ILIKE`, que não dobra acento, então metade do mercado era invisível para
 * quem escrevia do jeito rápido.
 */
test.describe('busca na vitrine', () => {
  const SEM_ACENTO = [
    { termo: 'acucar', esperado: /Açúcar/i },
    { termo: 'feijao', esperado: /Feijão/i },
    { termo: 'linguica', esperado: /Linguiça/i },
  ];

  for (const { termo, esperado } of SEM_ACENTO) {
    test(`"${termo}" acha o produto acentuado`, async ({ page }) => {
      await page.goto(`/palmital-pr/busca?q=${termo}`);

      await expect(page.getByRole('heading', { name: 'Produtos' })).toBeVisible();
      await expect(page.getByText(esperado).first()).toBeVisible();
    });
  }

  test('com acento também acha — não trocamos um caso pelo outro', async ({ page }) => {
    await page.goto('/palmital-pr/busca?q=açúcar');

    await expect(page.getByText(/Açúcar/i).first()).toBeVisible();
  });

  test('termo curto demais pede mais letras em vez de varrer o banco', async ({ page }) => {
    await page.goto('/palmital-pr/busca?q=a');

    await expect(page.getByText(/pelo menos duas letras/i)).toBeVisible();
  });
});
