import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createPrivateKey, generateKeyPairSync } from 'node:crypto';
import { SignJWT } from 'jose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  esquecerChavesDoFirebase,
  maxAgeDoCacheControl,
  validarIdTokenDoFirebase,
} from './firebase';

/**
 * Par de chaves gerado aqui e `fetch` trocado: nada sai para o Google.
 * O certificado vem do openssl porque o Node gera a chave, mas não emite X.509.
 */
const PROJETO = 'rapidinho-teste';
const KID = 'chave-1';
const agora = new Date('2026-11-02T12:00:00.000Z');
const emSegundos = Math.floor(agora.getTime() / 1000);

function gerarPar() {
  const pasta = mkdtempSync(join(tmpdir(), 'firebase-teste-'));
  const arquivoDaChave = join(pasta, 'chave.pem');
  const arquivoDoCertificado = join(pasta, 'certificado.pem');

  execFileSync(
    'openssl',
    [
      'req',
      '-x509',
      '-newkey',
      'rsa:2048',
      '-nodes',
      '-days',
      '1',
      '-subj',
      '/CN=securetoken',
      '-keyout',
      arquivoDaChave,
      '-out',
      arquivoDoCertificado,
    ],
    { stdio: 'ignore' },
  );

  const par = {
    chave: createPrivateKey(readFileSync(arquivoDaChave)),
    certificado: readFileSync(arquivoDoCertificado, 'utf8'),
  };
  rmSync(pasta, { recursive: true, force: true });
  return par;
}

const legitimo = gerarPar();

function buscarChaves(cacheControl = 'public, max-age=3600') {
  return vi.fn(
    async () =>
      new Response(JSON.stringify({ [KID]: legitimo.certificado }), {
        headers: { 'cache-control': cacheControl },
      }),
  ) as unknown as typeof fetch;
}

interface Claims {
  aud?: string;
  iss?: string;
  exp?: number;
  iat?: number;
  auth_time?: number;
  sub?: string;
  phone_number?: string;
}

async function emitir(claims: Claims = {}, chave = legitimo.chave, kid: string | undefined = KID) {
  const dados: Claims = {
    aud: PROJETO,
    iss: `https://securetoken.google.com/${PROJETO}`,
    exp: emSegundos + 3600,
    iat: emSegundos - 10,
    auth_time: emSegundos - 10,
    sub: 'uid-1',
    phone_number: '+5544999998888',
    ...claims,
  };

  return new SignJWT({ ...dados })
    .setProtectedHeader({ alg: 'RS256', ...(kid ? { kid } : {}) })
    .sign(chave);
}

const validar = (token: string, buscar = buscarChaves()) =>
  validarIdTokenDoFirebase(token, { projectId: PROJETO, buscar, agora });

describe('validarIdTokenDoFirebase', () => {
  beforeEach(() => esquecerChavesDoFirebase());

  it('aceita o token válido e devolve o telefone', async () => {
    expect(await validar(await emitir())).toEqual({ ok: true, telefone: '+5544999998888' });
  });

  it('recusa assinatura de outra chave', async () => {
    const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    expect(await validar(await emitir({}, privateKey))).toEqual({ ok: false, motivo: 'invalido' });
  });

  it('recusa token adulterado depois de assinado', async () => {
    const [cabecalho, , assinatura] = (await emitir()).split('.');
    const corpo = Buffer.from(
      JSON.stringify({ aud: PROJETO, phone_number: '+5544911112222' }),
    ).toString('base64url');
    expect((await validar(`${cabecalho}.${corpo}.${assinatura}`)).ok).toBe(false);
  });

  it('recusa alg none', async () => {
    const cabecalho = Buffer.from(JSON.stringify({ alg: 'none', kid: KID })).toString('base64url');
    const corpo = Buffer.from(JSON.stringify({ aud: PROJETO })).toString('base64url');
    expect((await validar(`${cabecalho}.${corpo}.`)).ok).toBe(false);
  });

  it('recusa aud de outro projeto', async () => {
    expect((await validar(await emitir({ aud: 'outro-projeto' }))).ok).toBe(false);
  });

  it('recusa iss de outro projeto', async () => {
    const iss = 'https://securetoken.google.com/outro-projeto';
    expect((await validar(await emitir({ iss }))).ok).toBe(false);
  });

  it('recusa token expirado', async () => {
    expect((await validar(await emitir({ exp: emSegundos - 60 }))).ok).toBe(false);
  });

  it('recusa iat e auth_time no futuro', async () => {
    expect((await validar(await emitir({ iat: emSegundos + 600 }))).ok).toBe(false);
    expect((await validar(await emitir({ auth_time: emSegundos + 600 }))).ok).toBe(false);
  });

  it('recusa sem telefone, mesmo com assinatura certa', async () => {
    expect((await validar(await emitir({ phone_number: '' }))).ok).toBe(false);
  });

  it('recusa kid desconhecido e token sem kid', async () => {
    expect((await validar(await emitir({}, legitimo.chave, 'outra'))).ok).toBe(false);
    esquecerChavesDoFirebase();
    const semKid = await new SignJWT({ aud: PROJETO })
      .setProtectedHeader({ alg: 'RS256' })
      .sign(legitimo.chave);
    expect((await validar(semKid)).ok).toBe(false);
  });

  it('recusa lixo sem ir buscar chave', async () => {
    const buscar = buscarChaves();
    expect(await validar('isto-nao-e-um-jwt', buscar)).toEqual({ ok: false, motivo: 'invalido' });
    expect(buscar).not.toHaveBeenCalled();
  });

  it('respeita o Cache-Control: não busca de novo dentro do prazo', async () => {
    const buscar = buscarChaves('public, max-age=3600');
    const token = await emitir();

    await validarIdTokenDoFirebase(token, { projectId: PROJETO, buscar, agora });
    await validarIdTokenDoFirebase(token, {
      projectId: PROJETO,
      buscar,
      agora: new Date(agora.getTime() + 3_599_000),
    });
    expect(buscar).toHaveBeenCalledTimes(1);

    await validarIdTokenDoFirebase(token, {
      projectId: PROJETO,
      buscar,
      agora: new Date(agora.getTime() + 3_601_000),
    });
    expect(buscar).toHaveBeenCalledTimes(2);
  });

  it('sem Cache-Control, não guarda', async () => {
    const buscar = buscarChaves('no-store');
    const token = await emitir();
    await validar(token, buscar);
    await validar(token, buscar);
    expect(buscar).toHaveBeenCalledTimes(2);
  });

  it('falha ao buscar as chaves é indisponibilidade, não token inválido', async () => {
    const buscar = vi.fn(async () => new Response('', { status: 503 })) as unknown as typeof fetch;
    expect(await validar(await emitir(), buscar)).toEqual({ ok: false, motivo: 'indisponivel' });
  });
});

describe('maxAgeDoCacheControl', () => {
  it('lê o max-age e ignora o resto', () => {
    expect(maxAgeDoCacheControl('public, max-age=19298, must-revalidate')).toBe(19298);
    expect(maxAgeDoCacheControl('s-maxage=10')).toBe(0);
    expect(maxAgeDoCacheControl(null)).toBe(0);
  });
});
