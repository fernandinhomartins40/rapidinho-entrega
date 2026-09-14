import { expect, test } from '@playwright/test';
import { ESTADOS_DE_SESSAO } from './apoio';

/**
 * O gargalo de entrada da plataforma.
 *
 * Loja cadastrada não aparece para ninguém até a plataforma aprovar. É o que
 * impede um cadastro falso de virar loja no ar, e por isso o teste percorre o
 * caminho inteiro: o lojista se cadastra sozinho pelo app, a loja não aparece
 * na vitrine, o super admin aprova e só então ela aparece.
 *
 * Documento e nome são únicos por execução — o cadastro recusa CPF repetido,
 * que é justamente a proteção contra cadastro duplicado.
 */

/** CPF válido gerado na hora: o formulário confere o dígito verificador. */
function cpfValido(): string {
  const base = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10));

  for (let posicao = 0; posicao < 2; posicao += 1) {
    const peso = base.length + 1;
    const soma = base.reduce((total, digito, i) => total + digito * (peso - i), 0);
    const resto = (soma * 10) % 11;
    base.push(resto >= 10 ? 0 : resto);
  }

  return base.join('');
}

const marca = Date.now().toString().slice(-6);
const NOME_DA_LOJA = `Mercado Teste ${marca}`;

test.describe.configure({ mode: 'serial' });

test.describe('aprovação de loja', () => {
  test('o lojista se cadastra sozinho e a loja nasce fora do ar', async ({ page }) => {
    await page.goto('/cadastro-loja');

    await page.getByLabel('Nome da loja').fill(NOME_DA_LOJA);
    await page.getByLabel('CPF ou CNPJ').fill(cpfValido());
    await page.getByLabel('Seu nome').fill('Responsável de Teste');
    // Telefone novo a cada execução: o cadastro cria a conta junto.
    await page.getByLabel('WhatsApp').fill(`(44) 98${marca.slice(0, 3)}-${marca.slice(3)}1`);
    // Índice, e não rótulo: o `select` não tem opção vazia, então a primeira
    // cidade já vem marcada — escolher por nome só amarraria o teste ao seed.
    await page.getByLabel('Cidade').selectOption({ index: 0 });
    await page.getByLabel('Rua').fill('Rua de Teste');
    await page.getByLabel('Bairro').fill('Centro');

    await page.getByRole('button', { name: 'Enviar cadastro' }).click();

    await expect(page.getByText(/avisamos no seu whatsapp/i)).toBeVisible({ timeout: 20_000 });

    // A vitrine é o que o cliente vê. Enquanto pendente, a loja não está lá.
    await page.goto('/palmital-pr');
    await expect(page.getByText(NOME_DA_LOJA)).toHaveCount(0);
  });

  test('o super admin aprova e a loja entra no ar', async ({ browser }) => {
    const contexto = await browser.newContext({
      baseURL: process.env.E2E_ADMIN_URL ?? 'http://localhost:3001',
      storageState: ESTADOS_DE_SESSAO.superAdmin,
    });
    const painel = await contexto.newPage();

    await painel.goto('/admin/lojas?status=PENDING_APPROVAL');
    await painel.getByRole('link', { name: NOME_DA_LOJA }).click();

    await painel.getByRole('button', { name: 'Aprovar', exact: true }).click();
    await painel.getByRole('button', { name: /aprovar e publicar/i }).click();

    // O botão de aprovar some quando o status deixa de ser pendente.
    await expect(painel.getByRole('button', { name: 'Aprovar', exact: true })).toHaveCount(0, {
      timeout: 20_000,
    });

    await contexto.close();

    // Agora sim o cliente enxerga a loja — que é o efeito que importa.
    const loja = await browser.newPage();
    await loja.goto(`${process.env.E2E_BASE_URL ?? 'http://localhost:3000'}/palmital-pr`);
    await expect(loja.getByText(NOME_DA_LOJA)).toBeVisible({ timeout: 20_000 });
    await loja.close();
  });
});
