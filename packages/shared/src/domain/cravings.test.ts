import { describe, expect, it } from 'vitest';
import {
  classificarPrato,
  combinaComAVontade,
  proximoCartao,
  type PratoDoBaralho,
} from './cravings';

describe('classificarPrato', () => {
  it.each([
    ['Marmita fitness', 'saudavel', '🍱'],
    ['Feijoada completa', 'refeicao', '🍲'],
    ['Combo Smash', 'lanche', '🍔'],
    ['Cachorro-quente completo', 'lanche', '🌭'],
    ['Coxinha de frango', 'salgado', '🍗'],
    ['Porção de fritas', 'porcao', '🍟'],
    ['Açaí 300 ml', 'doce', '🍇'],
    ['Torta de limão (fatia)', 'doce', '🍰'],
    ['Refrigerante lata 350 ml', 'bebida', '🥤'],
    ['Chocolate quente', 'bebida', '🍫'],
    ['Filé de frango grelhado', 'saudavel', '🍗'],
  ])('%s → %s %s', (nome, tipo, emoji) => {
    const arte = classificarPrato(nome);
    expect(arte.tipo).toBe(tipo);
    expect(arte.emoji).toBe(emoji);
  });

  it('sabor de pizza é sempre pizza e rende para dividir', () => {
    const arte = classificarPrato('Chocolate com morango', 'Doces', true);
    expect(arte).toMatchObject({ tipo: 'pizza', emoji: '🍕', paraDividir: true });
  });

  it('porção e combo família rendem para dividir; marmita não', () => {
    expect(classificarPrato('Combo família').paraDividir).toBe(true);
    expect(classificarPrato('Porção de mandioca frita').paraDividir).toBe(true);
    expect(classificarPrato('Marmita grande').paraDividir).toBe(false);
  });
});

const prato = (dados: Partial<PratoDoBaralho> & { chave: string }): PratoDoBaralho => ({
  tipo: 'refeicao',
  precoCents: 2500,
  tempoMin: 40,
  paraDividir: false,
  lojaId: 'loja',
  popularidade: 0.5,
  ...dados,
});

describe('combinaComAVontade', () => {
  it('filtra pelo que a pessoa pediu', () => {
    expect(combinaComAVontade(prato({ chave: 'a', tipo: 'doce' }), 'doce')).toBe(true);
    expect(combinaComAVontade(prato({ chave: 'b', precoCents: 3990 }), 'barato')).toBe(false);
    expect(combinaComAVontade(prato({ chave: 'c', tempoMin: 70 }), 'rapido')).toBe(false);
    expect(combinaComAVontade(prato({ chave: 'd', tipo: 'bebida' }), 'tanto-faz')).toBe(true);
  });
});

describe('proximoCartao', () => {
  it('sem sinal, mostra o mais pedido no horário', () => {
    const restantes = [
      prato({ chave: 'pouco', popularidade: 0.1 }),
      prato({ chave: 'muito', popularidade: 0.9 }),
    ];
    expect(proximoCartao(restantes, { curtidos: [], descartados: [] })?.chave).toBe('muito');
  });

  it('depois de curtir doce, puxa outro doce à frente de um salgado mais popular', () => {
    const curtido = prato({ chave: 'acai', tipo: 'doce', precoCents: 1500, lojaId: 'l1' });
    const restantes = [
      prato({
        chave: 'coxinha',
        tipo: 'salgado',
        popularidade: 0.7,
        precoCents: 700,
        lojaId: 'l2',
      }),
      prato({ chave: 'sundae', tipo: 'doce', popularidade: 0.4, precoCents: 1590, lojaId: 'l3' }),
    ];
    expect(proximoCartao(restantes, { curtidos: [curtido], descartados: [] })?.chave).toBe(
      'sundae',
    );
  });

  it('dois descartes do mesmo tipo empurram o tipo para trás', () => {
    const lanche = (chave: string) => prato({ chave, tipo: 'lanche' });
    const restantes = [
      prato({ chave: 'burger', tipo: 'lanche', popularidade: 0.8 }),
      prato({ chave: 'marmita', tipo: 'refeicao', popularidade: 0.5 }),
    ];
    const historico = { curtidos: [], descartados: [lanche('x1'), lanche('x2'), lanche('x3')] };
    expect(proximoCartao(restantes, historico)?.chave).toBe('marmita');
  });

  it('acabou o baralho, não há próximo', () => {
    expect(proximoCartao([], { curtidos: [], descartados: [] })).toBeNull();
  });
});
