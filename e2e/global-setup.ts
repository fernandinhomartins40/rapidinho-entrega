import { chromium, type FullConfig } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { ESTADOS_DE_SESSAO, entrarNoFormulario, TELEFONES } from './tests/apoio';

/**
 * Autentica uma vez por papel e guarda o estado da sessão.
 *
 * O login por OTP é protegido contra força bruta: 3 códigos por telefone a
 * cada 15 minutos. Logar em cada teste esgotaria esse limite na terceira
 * execução — e baixar o limite só para o teste passar enfraqueceria
 * justamente a proteção que ele deveria cobrir.
 *
 * Reusar o estado da sessão é também o que o Playwright recomenda: o login
 * deixa de ser repetido em todo teste e cada um começa já na tela que importa.
 */
export default async function globalSetup(config: FullConfig): Promise<void> {
  await mkdir('e2e/.auth', { recursive: true });

  const admin = process.env.E2E_ADMIN_URL ?? 'http://localhost:3001';
  const web = config.projects[0]?.use.baseURL ?? 'http://localhost:3000';

  const navegador = await chromium.launch(
    process.env.E2E_CHROMIUM_PATH ? { executablePath: process.env.E2E_CHROMIUM_PATH } : undefined,
  );

  const papeis = [
    { base: web, telefone: TELEFONES.cliente, arquivo: ESTADOS_DE_SESSAO.cliente },
    { base: admin, telefone: TELEFONES.lojista, arquivo: ESTADOS_DE_SESSAO.lojista },
    { base: admin, telefone: TELEFONES.superAdmin, arquivo: ESTADOS_DE_SESSAO.superAdmin },
  ];

  try {
    for (const papel of papeis) {
      const contexto = await navegador.newContext();
      const pagina = await contexto.newPage();

      await pagina.goto(`${papel.base}/entrar`);
      await entrarNoFormulario(pagina, papel.telefone);
      await contexto.storageState({ path: papel.arquivo });

      await contexto.close();
    }
  } finally {
    await navegador.close();
  }
}
