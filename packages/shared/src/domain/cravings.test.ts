import { describe, expect, it } from 'vitest';
import {
  arteDoProduto,
  classificarPrato,
  combinaComAVontade,
  proximoCartao,
  type PratoDoBaralho,
} from './cravings';

describe('classificarPrato', () => {
  it.each([
    ['Marmita fitness', 'saudavel', 'Salad'],
    ['Feijoada completa', 'refeicao', 'Soup'],
    ['Combo Smash', 'lanche', 'Sandwich'],
    ['Cachorro-quente completo', 'lanche', 'Sandwich'],
    ['Coxinha de frango', 'salgado', 'Drumstick'],
    ['Porção de fritas', 'porcao', 'Utensils'],
    ['Açaí 300 ml', 'doce', 'Grape'],
    ['Torta de limão (fatia)', 'doce', 'CakeSlice'],
    ['Refrigerante lata 350 ml', 'bebida', 'CupSoda'],
    ['Chocolate quente', 'bebida', 'Candy'],
    ['Filé de frango grelhado', 'saudavel', 'Drumstick'],
  ])('%s → %s %s', (nome, tipo, icone) => {
    const arte = classificarPrato(nome);
    expect(arte.tipo).toBe(tipo);
    expect(arte.icone).toBe(icone);
  });

  it('sabor de pizza é sempre pizza e rende para dividir', () => {
    const arte = classificarPrato('Chocolate com morango', 'Doces', true);
    expect(arte).toMatchObject({ tipo: 'pizza', icone: 'Pizza', paraDividir: true });
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

describe('arteDoProduto', () => {
  it.each([
    ['Arroz branco 5 kg', 'MARKET', 'Wheat'],
    ['Leite integral 1 L', 'MARKET', 'Milk'],
    ['Detergente 500 ml', 'MARKET', 'SprayCan'],
    ['Dipirona 500 mg', 'PHARMACY', 'Pill'],
    ['Fralda infantil M', 'PHARMACY', 'Baby'],
    ['Ração para cachorro 15 kg', 'OTHER', 'PawPrint'],
    ['Botijão de gás P13', 'OTHER', 'Flame'],
  ])('%s (%s) → %s', (nome, segmento, icone) => {
    expect(arteDoProduto(nome, segmento).icone).toBe(icone);
  });

  it('restaurante usa a classificação de prato', () => {
    expect(arteDoProduto('Combo Smash', 'RESTAURANT').tipo).toBe('lanche');
  });
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
