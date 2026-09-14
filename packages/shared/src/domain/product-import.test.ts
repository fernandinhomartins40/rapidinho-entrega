import { describe, expect, it } from 'vitest';
import { detectDelimiter, parseCsvLine, parseProductCsv } from './product-import';

describe('parseCsvLine', () => {
  it('não quebra nome que contém o separador', () => {
    // Um split ingênuo transformaria isto em 3 colunas e jogaria o preço para
    // a coluna errada.
    const campos = parseCsvLine('"Refrigerante 2L, uva";12,90;Bebidas', ';');
    expect(campos).toEqual(['Refrigerante 2L, uva', '12,90', 'Bebidas']);
  });

  it('trata aspas duplicadas como aspa literal', () => {
    expect(parseCsvLine('"Cerveja ""Puro Malte""";8,50', ';')).toEqual([
      'Cerveja "Puro Malte"',
      '8,50',
    ]);
  });
});

describe('detectDelimiter', () => {
  it('reconhece o ponto e vírgula do Excel em português', () => {
    expect(detectDelimiter('Nome;Preço;Categoria')).toBe(';');
  });

  it('reconhece a vírgula quando é esse o separador', () => {
    expect(detectDelimiter('Nome,Preco,Categoria')).toBe(',');
  });
});

describe('parseProductCsv', () => {
  it('importa uma planilha de mercadinho com cabeçalho acentuado', () => {
    const { products, issues } = parseProductCsv(
      ['Nome;Preço;Categoria', 'Arroz 5kg;27,90;Mercearia', 'Feijão 1kg;8,49;Mercearia'].join('\n'),
    );

    expect(issues).toEqual([]);
    expect(products).toHaveLength(2);
    expect(products[0]).toMatchObject({
      name: 'Arroz 5kg',
      priceCents: 2790,
      categoryName: 'Mercearia',
    });
  });

  it('remove o BOM que o Excel escreve no início do arquivo', () => {
    // Sem remover, o primeiro cabeçalho vira "\uFEFFNome" e não casa com alias
    // nenhum — o arquivo inteiro seria recusado.
    const { products, issues } = parseProductCsv('\uFEFFNome;Preço\nÁgua 500ml;3,00');

    expect(issues).toEqual([]);
    expect(products[0]?.name).toBe('Água 500ml');
  });

  it('aceita preço escrito com R$ e com ponto de milhar', () => {
    const { products } = parseProductCsv('Nome;Preço\nCesta básica;R$ 1.250,00');
    expect(products[0]?.priceCents).toBe(125000);
  });

  it('reconhece cabeçalhos sem acento e em maiúsculas', () => {
    const { products, issues } = parseProductCsv('NOME;PRECO;SECAO\nSabão;5,99;Limpeza');

    expect(issues).toEqual([]);
    expect(products[0]?.categoryName).toBe('Limpeza');
  });

  it('marca a linha ruim e importa o resto', () => {
    // O ponto da importação é não obrigar o lojista a voltar para o cadastro
    // manual por causa de uma linha.
    const { products, issues } = parseProductCsv(
      ['Nome;Preço', 'Arroz;27,90', 'Produto sem preço;', 'Feijão;8,49'].join('\n'),
    );

    expect(products).toHaveLength(2);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.line).toBe(3);
  });

  it('pula item repetido em vez de criar produto duplicado', () => {
    const { products, issues } = parseProductCsv(
      ['Nome;Preço', 'Arroz;27,90', 'ARROZ;28,90'].join('\n'),
    );

    expect(products).toHaveLength(1);
    expect(issues[0]?.message).toContain('mais de uma vez');
  });

  it('entende venda por peso pela coluna de unidade', () => {
    const { products } = parseProductCsv('Nome;Preço;Unidade\nPicanha;89,90;kg');
    expect(products[0]?.sellingUnit).toBe('WEIGHT_KG');
  });

  it('trata "não" na coluna de disponibilidade', () => {
    const { products } = parseProductCsv('Nome;Preço;Disponível\nSorvete;12,00;não');
    expect(products[0]?.isAvailable).toBe(false);
  });

  it('explica o problema quando faltam as colunas obrigatórias', () => {
    const { products, issues } = parseProductCsv('Coluna A;Coluna B\nx;y');

    expect(products).toEqual([]);
    expect(issues[0]?.message).toContain('nome e preço');
  });

  it('ignora linhas em branco no meio da planilha', () => {
    const { products, issues } = parseProductCsv('Nome;Preço\nArroz;27,90\n\n\nFeijão;8,49');

    expect(products).toHaveLength(2);
    expect(issues).toEqual([]);
  });
});
