import { describe, expect, it } from 'vitest';
import {
  descreverSegmento,
  limiteDeInatividade,
  notificationCampaignSchema,
  notificationSegmentSchema,
  papeisDoPublico,
} from './notification-segment';

const base = notificationSegmentSchema.parse({});

describe('notificationCampaignSchema', () => {
  it('aceita uma campanha mínima', () => {
    const campanha = notificationCampaignSchema.parse({
      title: 'Frete grátis hoje',
      body: 'Nas lojas de Palmital, até as 22h.',
      segment: {},
    });

    expect(campanha.segment.publico).toBe('CUSTOMERS');
    expect(campanha.linkUrl).toBeUndefined();
  });

  it('recusa link externo — é o formato que um golpe imitaria', () => {
    const entrada = {
      title: 'Promoção',
      body: 'Confira',
      linkUrl: 'https://site-falso.com',
      segment: {},
    };

    expect(() => notificationCampaignSchema.parse(entrada)).toThrow();
  });

  it('recusa caminho protocolo-relativo, que o navegador trata como externo', () => {
    const entrada = { title: 'Promoção', body: 'Confira', linkUrl: '//evil.com', segment: {} };

    expect(() => notificationCampaignSchema.parse(entrada)).toThrow();
  });

  it('aceita caminho interno', () => {
    const campanha = notificationCampaignSchema.parse({
      title: 'Promoção',
      body: 'Confira',
      linkUrl: '/palmital-pr',
      segment: {},
    });

    expect(campanha.linkUrl).toBe('/palmital-pr');
  });

  it('recusa mensagem longa demais para caber na prévia da notificação', () => {
    const entrada = { title: 'Ok', body: 'x'.repeat(181), segment: {} };

    expect(() => notificationCampaignSchema.parse(entrada)).toThrow();
  });
});

describe('papeisDoPublico', () => {
  it('lojista inclui a equipe da loja — quem atende também precisa saber', () => {
    expect(papeisDoPublico('STORE_OWNERS')).toEqual(['STORE_OWNER', 'STORE_STAFF']);
  });

  it('cliente não inclui outros papéis', () => {
    expect(papeisDoPublico('CUSTOMERS')).toEqual(['CUSTOMER']);
  });
});

describe('limiteDeInatividade', () => {
  it('sem o filtro, não há data-limite', () => {
    expect(limiteDeInatividade(base)).toBeNull();
  });

  it('conta os dias para trás a partir de agora', () => {
    const agora = new Date('2026-03-20T12:00:00Z');
    const limite = limiteDeInatividade({ ...base, inativoHaDias: 30 }, agora);

    expect(limite?.toISOString()).toBe('2026-02-18T12:00:00.000Z');
  });
});

describe('descreverSegmento', () => {
  it('sem cidade escolhida, diz que é geral', () => {
    expect(descreverSegmento(base)).toBe('Clientes · todas as cidades');
  });

  it('junta os filtros numa linha só', () => {
    const texto = descreverSegmento(
      { ...base, publico: 'COURIERS', apenasComPedido: true, inativoHaDias: 15 },
      ['Palmital — PR'],
    );

    expect(texto).toBe('Entregadores · Palmital — PR · com pedido · parados há 15 dias');
  });
});
