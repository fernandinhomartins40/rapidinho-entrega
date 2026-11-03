import { describe, expect, it, vi } from 'vitest';
import { createExpoPushProvider } from './expo-push';

/** `fetch` trocado: nada sai para a Expo. */
function resposta(data: unknown[]) {
  return vi.fn(async () => Response.json({ data })) as unknown as typeof fetch;
}

const mensagem = (tokens: string[]) => ({ tokens, title: 'Pedido #1', body: 'Saiu para entrega' });

describe('createExpoPushProvider', () => {
  it('conta os enviados e separa quem desinstalou', async () => {
    const enviar = resposta([
      { status: 'ok' },
      { status: 'error', details: { error: 'DeviceNotRegistered' } },
      { status: 'error', details: { error: 'MessageRateExceeded' } },
    ]);

    const resultado = await createExpoPushProvider(enviar).send(mensagem(['a', 'b', 'c']));

    expect(resultado).toEqual({ enviados: 1, invalidos: ['b'] });
  });

  it('manda em lotes de 100', async () => {
    const enviar = vi.fn(async (_url: string, init: RequestInit) =>
      Response.json({
        data: (JSON.parse(String(init.body)) as unknown[]).map(() => ({ status: 'ok' })),
      }),
    );
    const tokens = Array.from({ length: 150 }, (_, indice) => `t${indice}`);

    const resultado = await createExpoPushProvider(enviar as unknown as typeof fetch).send(
      mensagem(tokens),
    );

    expect(enviar).toHaveBeenCalledTimes(2);
    expect(resultado.enviados).toBe(150);
  });

  it('erro HTTP sobe para quem chamou registrar a falha', async () => {
    const enviar = vi.fn(async () => new Response('', { status: 500 })) as unknown as typeof fetch;
    await expect(createExpoPushProvider(enviar).send(mensagem(['a']))).rejects.toThrow('HTTP 500');
  });
});
