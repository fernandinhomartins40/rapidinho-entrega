import { describe, expect, it } from 'vitest';
import { interpretarLista, notaDoProduto, singular } from './shopping-list';

describe('interpretarLista', () => {
  it('separa por linha, vírgula e "e", sem quebrar a vírgula decimal', () => {
    const itens = interpretarLista('2 arroz 5kg, dipirona e uma coca 2 litros\n1,5 kg de alcatra');

    expect(itens.map((item) => item.original)).toEqual([
      '2 arroz 5kg',
      'dipirona',
      'uma coca 2 litros',
      '1,5 kg de alcatra',
    ]);
  });

  it('lê quantidade em número, por extenso e com "x"', () => {
    const [a, b, c, d] = interpretarLista('3 leite\nduas cervejas\npão x10\n2x sabonete');

    expect(a).toMatchObject({ quantidade: 3, palavras: ['leite'] });
    expect(b).toMatchObject({ quantidade: 2, palavras: ['cerveja'] });
    expect(c).toMatchObject({ quantidade: 10, palavras: ['pao'] });
    expect(d).toMatchObject({ quantidade: 2, palavras: ['sabonete'] });
  });

  it('entende peso e dúzia do jeito que se fala', () => {
    const [carne, ovo, queijo] = interpretarLista(
      'meio quilo de carne moída, meia dúzia de ovos, 300g queijo',
    );

    expect(carne).toMatchObject({ gramas: 500, palavras: ['carne', 'moida'] });
    expect(ovo).toMatchObject({ quantidade: 6, palavras: ['ovo'] });
    expect(queijo).toMatchObject({ gramas: 300, palavras: ['queijo'] });
  });

  it('guarda a embalagem como medida, sem virar palavra de busca', () => {
    const [arroz, coca] = interpretarLista('arroz 5kg; coca 2l');

    expect(arroz).toMatchObject({ palavras: ['arroz'], medidas: ['5kg'] });
    expect(coca).toMatchObject({ palavras: ['coca'], medidas: ['2l'] });
  });

  it('descarta linhas sem nada buscável', () => {
    expect(interpretarLista('e\n  \n- \nobrigado')).toHaveLength(1);
    expect(interpretarLista('')).toEqual([]);
  });

  it('não deixa quantidade absurda passar', () => {
    expect(interpretarLista('500 bananas')[0]?.quantidade).toBeLessThanOrEqual(99);
  });
});

describe('singular', () => {
  it('cobre os plurais comuns de lista de compras', () => {
    expect(singular('paes')).toBe('pao');
    expect(singular('limoes')).toBe('limao');
    expect(singular('ovos')).toBe('ovo');
    expect(singular('gas')).toBe('gas');
  });
});

describe('notaDoProduto', () => {
  const [arroz] = interpretarLista('arroz integral 5kg');

  it('exige a palavra principal', () => {
    expect(notaDoProduto(arroz!, 'Macarrão Integral 500 g')).toBe(0);
  });

  it('dá mais nota a quem casa mais palavras e a embalagem pedida', () => {
    const comum = notaDoProduto(arroz!, 'Arroz Tipo 1 Tio João 5 kg');
    const integral = notaDoProduto(arroz!, 'Arroz Integral Camil 1 kg');
    const certo = notaDoProduto(arroz!, 'Arroz Integral Camil 5 kg');

    expect(integral).toBeGreaterThan(comum);
    expect(certo).toBeGreaterThan(integral);
  });

  it('ignora acento no nome do produto', () => {
    const [acucar] = interpretarLista('acucar');
    expect(notaDoProduto(acucar!, 'Açúcar Cristal União 1 kg')).toBe(1);
  });
});
