import { describe, expect, it } from 'vitest';
import {
  codigosNoSms,
  linkDoSmsDeConfirmacao,
  remetenteDoSms,
  textoDoSmsDeConfirmacao,
} from './sms-reverso';

describe('confirmação reversa por SMS', () => {
  it('monta o texto e o link que abre o app de mensagens', () => {
    expect(textoDoSmsDeConfirmacao('123456')).toBe('Rapidinho 123456');
    expect(linkDoSmsDeConfirmacao('(44) 99999-0000', '123456')).toBe(
      'sms:+5544999990000?body=Rapidinho%20123456',
    );
  });

  it('acha o código sozinho, com o nome ou no meio de uma frase', () => {
    expect(codigosNoSms('Rapidinho 123456')).toEqual(['123456']);
    expect(codigosNoSms('123456')).toEqual(['123456']);
    expect(codigosNoSms('oi meu codigo e 004512 obrigado')).toEqual(['004512']);
  });

  it('não confunde telefone ou número maior com código', () => {
    expect(codigosNoSms('me liga no 44999998888')).toEqual([]);
    expect(codigosNoSms('1234567')).toEqual([]);
    expect(codigosNoSms('sem código')).toEqual([]);
  });

  it('normaliza o remetente nos formatos que as operadoras entregam', () => {
    for (const formato of [
      '+5544999998888',
      '5544999998888',
      '44999998888',
      '044999998888',
      '01544999998888',
    ]) {
      expect(remetenteDoSms(formato), formato).toBe('+5544999998888');
    }
  });

  it('recusa remetente que não é telefone brasileiro', () => {
    expect(remetenteDoSms('27900')).toBeNull();
    expect(remetenteDoSms('VIVO')).toBeNull();
    expect(remetenteDoSms('')).toBeNull();
  });
});
