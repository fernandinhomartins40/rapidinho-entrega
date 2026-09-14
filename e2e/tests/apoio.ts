import type { Page } from '@playwright/test';

/**
 * Apoio dos testes de ponta a ponta.
 *
 * O login por OTP depende de um código que chega por WhatsApp. Em
 * desenvolvimento o provedor é o `console`, e a Server Action devolve o código
 * na resposta para a tela mostrar — é desse caminho que os testes se servem,
 * o mesmo que uma pessoa usaria, em vez de ler o banco por fora.
 */

/** Telefones do seed. Trocar aqui se o seed mudar. */
export const TELEFONES = {
  cliente: '(44) 99999-0002',
  lojista: '(44) 99000-0000',
  superAdmin: '(44) 99999-0001',
} as const;

/**
 * Estados de sessão gravados pelo global setup.
 *
 * Caminho relativo à raiz do projeto: o Playwright carrega estes arquivos como
 * CommonJS, onde `import.meta.url` não existe.
 */
export const ESTADOS_DE_SESSAO = {
  cliente: 'e2e/.auth/cliente.json',
  lojista: 'e2e/.auth/lojista.json',
  superAdmin: 'e2e/.auth/super-admin.json',
} as const;

/**
 * Preenche o formulário de login e espera a sessão existir.
 *
 * Usado só pelo global setup; os testes já começam autenticados pelo estado
 * salvo, porque o limite de 3 códigos por telefone a cada 15 minutos não
 * sobreviveria a um login por teste.
 */
export async function entrarNoFormulario(page: Page, telefone: string): Promise<void> {
  await page.getByLabel(/telefone/i).fill(telefone);
  await page.getByRole('button', { name: /receber código/i }).click();

  const dica = page.getByTestId('codigo-dev');
  await dica.waitFor({ state: 'visible', timeout: 20_000 });

  const codigo = (await dica.textContent())?.replace(/\D/g, '') ?? '';

  await page.getByLabel(/código/i).fill(codigo);

  // Nome exato: /entrar/i também casaria com "Usar outro telefone", e o teste
  // clicaria no botão errado.
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();

  // A sessão é criada por redirect do servidor; seguir antes que ele termine
  // faria a próxima página cair de volta no login.
  await page.waitForURL((url) => !url.pathname.startsWith('/entrar'), { timeout: 20_000 });
}
