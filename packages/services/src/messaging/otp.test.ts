import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSmsDevOtpSender, smsDoCodigo } from './otp';

const CHAVE = 'CHAVE-DE-TESTE';
const envio = { phone: '+5544999998888', code: '123456', expiresInMinutes: 5 };

function responder(corpo: unknown, status = 200) {
  const fetchFalso = vi.fn().mockResolvedValue(new Response(JSON.stringify(corpo), { status }));
  vi.stubGlobal('fetch', fetchFalso);
  return fetchFalso;
}

afterEach(() => vi.unstubAllGlobals());

describe('smsDoCodigo', () => {
  it('cabe em um SMS e não tem acento — acento derruba o limite para 70 caracteres', () => {
    const texto = smsDoCodigo('123456', 5, 'rapidinhoentrega.com.br');

    expect(texto.length).toBeLessThanOrEqual(160);
    expect(texto).toMatch(/^[\x20-\x7E\n]+$/);
  });

  it('termina no formato que o teclado do celular reconhece', () => {
    expect(smsDoCodigo('123456', 5, 'rapidinhoentrega.com.br')).toMatch(
      /\n@rapidinhoentrega\.com\.br #123456$/,
    );
  });
});

describe('createSmsDevOtpSender', () => {
  const sender = createSmsDevOtpSender({ apiKey: CHAVE, domain: 'rapidinhoentrega.com.br' });

  it('envia só os dígitos do número, com DDI', async () => {
    const fetchFalso = responder([
      { situacao: 'OK', codigo: '1', id: '42', descricao: 'MENSAGEM NA FILA' },
    ]);

    await sender.send(envio);

    const [url, init] = fetchFalso.mock.calls[0]!;
    expect(url).toBe('https://api.smsdev.com.br/v1/send');
    expect(JSON.parse(init.body)).toEqual([
      expect.objectContaining({ key: CHAVE, type: 9, number: 5544999998888 }),
    ]);
  });

  it('falha quando a SMSDev recusa, sem vazar a chave na mensagem', async () => {
    responder([{ situacao: 'ERRO', codigo: '403', descricao: `NAO AUTENTICADO (${CHAVE}).` }]);

    const erro = await sender.send(envio).catch((e: Error) => e);

    expect(erro).toBeInstanceOf(Error);
    expect((erro as Error).message).toContain('403');
    expect((erro as Error).message).not.toContain(CHAVE);
  });

  it('falha quando a API está fora do ar', async () => {
    responder({}, 502);

    await expect(sender.send(envio)).rejects.toThrow('HTTP 502');
  });
});
