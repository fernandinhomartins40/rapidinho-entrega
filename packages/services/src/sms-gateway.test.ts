import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { tokenParaLoginDoApp } from './sms-gateway';

const TOKEN = 'a'.repeat(64);
const sha256 = (valor: string) => createHash('sha256').update(valor).digest('hex');

describe('tokenParaLoginDoApp', () => {
  beforeEach(() => {
    vi.stubEnv('DATABASE_URL', 'postgresql://u:p@localhost:5432/db');
    vi.stubEnv('REDIS_URL', 'redis://localhost:6379');
    vi.stubEnv('AUTH_SECRET', 'x'.repeat(32));
    vi.stubEnv('S3_ENDPOINT', 'http://localhost:9000');
    vi.stubEnv('S3_BUCKET', 'b');
    vi.stubEnv('S3_ACCESS_KEY', 'k');
    vi.stubEnv('S3_SECRET_KEY', 's');
    vi.stubEnv('S3_PUBLIC_URL', 'http://localhost/uploads');
    vi.stubEnv('SMS_GATEWAY_TOKEN', TOKEN);
    vi.stubEnv('SMS_APP_EMAIL', 'Operacao@Exemplo.com');
    vi.stubEnv('SMS_APP_SENHA_SHA256', sha256('Senha@123'));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('devolve o token com e-mail (sem diferenciar maiúsculas) e senha certos', () => {
    expect(tokenParaLoginDoApp(' operacao@exemplo.com ', 'Senha@123')).toBe(TOKEN);
  });

  it('recusa senha ou e-mail errados', () => {
    expect(tokenParaLoginDoApp('operacao@exemplo.com', 'senha@123')).toBeNull();
    expect(tokenParaLoginDoApp('outro@exemplo.com', 'Senha@123')).toBeNull();
    expect(tokenParaLoginDoApp('', '')).toBeNull();
  });

  it('fica desligado enquanto a senha não está configurada', () => {
    vi.stubEnv('SMS_APP_SENHA_SHA256', '');
    expect(tokenParaLoginDoApp('operacao@exemplo.com', 'Senha@123')).toBeNull();
  });
});
