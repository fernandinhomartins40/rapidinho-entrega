import { describe, expect, it } from 'vitest';
import { notificationSegmentSchema } from '@rapidinho/shared';
import { filtroDoSegmento } from './campaign';

const base = notificationSegmentSchema.parse({});

describe('filtroDoSegmento', () => {
  it('exige opt-in de marketing — campanha sem consentimento é infração de LGPD', () => {
    expect(filtroDoSegmento(base).marketingOptIn).toBe(true);
  });

  it('exige inscrição de push, senão a notificação não chega a lugar nenhum', () => {
    expect(filtroDoSegmento(base).pushSubscriptions).toEqual({ some: {} });
  });

  it('ignora quem saiu ou está bloqueado', () => {
    const filtro = filtroDoSegmento(base);

    expect(filtro.deletedAt).toBeNull();
    expect(filtro.status).toBe('ACTIVE');
  });

  it('sem cidade escolhida, não filtra por endereço', () => {
    expect(filtroDoSegmento(base).addresses).toBeUndefined();
  });

  it('filtra pela cidade do endereço do usuário', () => {
    const filtro = filtroDoSegmento({ ...base, cityIds: ['cidade-1', 'cidade-2'] });

    expect(filtro.addresses).toEqual({ some: { cityId: { in: ['cidade-1', 'cidade-2'] } } });
  });

  it('lojista inclui a equipe da loja', () => {
    const filtro = filtroDoSegmento({ ...base, publico: 'STORE_OWNERS' });

    expect(filtro.role).toEqual({ in: ['STORE_OWNER', 'STORE_STAFF'] });
  });

  it('inatividade alcança também quem nunca pediu — é o público da campanha de retorno', () => {
    const agora = new Date('2026-03-20T12:00:00Z');
    const filtro = filtroDoSegmento({ ...base, inativoHaDias: 30 }, agora);

    expect(filtro.orders).toEqual({
      none: { createdAt: { gte: new Date('2026-02-18T12:00:00Z') } },
    });
  });

  it('o filtro de inatividade prevalece sobre o de "já pediu", que seria contraditório', () => {
    const filtro = filtroDoSegmento({ ...base, apenasComPedido: true, inativoHaDias: 30 });

    expect(filtro.orders).toHaveProperty('none');
  });
});
