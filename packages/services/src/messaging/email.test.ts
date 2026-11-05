import { afterEach, describe, expect, it, vi } from 'vitest';
import { createVelomailEmailProvider } from './email';

afterEach(() => vi.unstubAllGlobals());

function capturarEnvio(resposta: unknown, status = 200) {
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(resposta), { status }));
  vi.stubGlobal('fetch', fetch);
  return () => JSON.parse(fetch.mock.calls[0]![1].body as string) as Record<string, unknown>;
}

describe('createVelomailEmailProvider', () => {
  it('separa o nome do e-mail: o Velomail recusa "Nome <email>" no from', async () => {
    const corpo = capturarEnvio({ success: true, message_id: 'mt-1' });
    const provedor = createVelomailEmailProvider(
      'chave',
      'Rapidinho Entrega <nao-responda@rapidinhoentrega.com.br>',
      'https://www.velomail.com.br/api',
    );

    const enviado = await provedor.send({ to: 'a@b.com', subject: 'Oi', html: '<p>Oi</p>' });

    expect(enviado).toEqual({ id: 'mt-1' });
    expect(corpo()).toMatchObject({
      from: 'nao-responda@rapidinhoentrega.com.br',
      from_name: 'Rapidinho Entrega',
      tracking_enabled: false,
    });
  });

  it('aceita o remetente só com o e-mail', async () => {
    const corpo = capturarEnvio({ success: true, message_id: 'mt-2' });
    const provedor = createVelomailEmailProvider('chave', 'nao-responda@x.com', 'https://v/api');

    await provedor.send({ to: 'a@b.com', subject: 'Oi', html: '<p>Oi</p>' });

    expect(corpo().from).toBe('nao-responda@x.com');
    expect(corpo()).not.toHaveProperty('from_name');
  });

  it('devolve null quando o Velomail recusa', async () => {
    capturarEnvio({ error: 'Validation Error', details: [{ path: 'from' }] }, 400);
    const provedor = createVelomailEmailProvider('chave', 'x@y.com', 'https://v/api');

    expect(await provedor.send({ to: 'a@b.com', subject: 'Oi', html: '<p>Oi</p>' })).toBeNull();
  });
});
