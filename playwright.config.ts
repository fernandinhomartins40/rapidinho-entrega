import { defineConfig, devices } from '@playwright/test';

/**
 * Testes de ponta a ponta dos fluxos críticos.
 *
 * O aparelho padrão é um celular, não um desktop: é onde o cliente e o lojista
 * realmente usam o sistema, e bug de layout em tela pequena é o que mais
 * aparece na prática.
 */
export default defineConfig({
  testDir: './e2e/tests',
  // Autentica uma vez por papel e guarda o estado; ver e2e/global-setup.ts.
  globalSetup: './e2e/global-setup.ts',
  // Um fluxo de pedido inteiro em 3G simulado passa de 30s com folga.
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  // Os testes compartilham o mesmo banco semeado; rodar em paralelo faria um
  // corromper o estado do outro.
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],

  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
  },

  projects: [
    {
      name: 'celular',
      use: {
        ...devices['Pixel 5'],
        // Permite usar um Chromium já instalado na máquina (imagem de CI,
        // container de desenvolvimento) em vez de baixar outro a cada run.
        ...(process.env.E2E_CHROMIUM_PATH
          ? { launchOptions: { executablePath: process.env.E2E_CHROMIUM_PATH } }
          : {}),
      },
    },
  ],
});
