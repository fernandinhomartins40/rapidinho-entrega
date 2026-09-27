/**
 * Dados da demonstração de Palmital/PR.
 *
 * Tudo aqui é FICTÍCIO: nomes de loja, pessoas, documentos e telefones foram
 * inventados para testar o aplicativo com volume realista. Preços em centavos,
 * na faixa de uma cidade do interior do Paraná em 2026.
 */

// ---------------------------------------------------------------------------
// Produtos
// ---------------------------------------------------------------------------

export interface ProdutoDemo {
  nome: string;
  precoCents: number;
  descricao?: string;
  /** Vendido por quilo: o preço é do kg. */
  porKg?: boolean;
  /** Farmácia: remédio que exige receita, ou controlado (não vende pelo app). */
  receita?: 'REQUIRED' | 'CONTROLLED';
}

export interface SecaoDemo {
  nome: string;
  produtos: ProdutoDemo[];
}

const p = (nome: string, precoCents: number, descricao?: string): ProdutoDemo => ({
  nome,
  precoCents,
  ...(descricao ? { descricao } : {}),
});

const comReceita = (nome: string, precoCents: number): ProdutoDemo => ({
  nome,
  precoCents,
  descricao: 'Venda sob prescrição médica: envie a foto da receita no pedido.',
  receita: 'REQUIRED',
});

const kg = (nome: string, precoCents: number, descricao?: string): ProdutoDemo => ({
  nome,
  precoCents,
  porKg: true,
  ...(descricao ? { descricao } : {}),
});

const HORTIFRUTI: SecaoDemo = {
  nome: 'Hortifrúti',
  produtos: [
    kg('Banana prata', 699),
    kg('Banana nanica', 549),
    kg('Maçã gala', 1199),
    kg('Laranja pera', 499, 'Boa para suco'),
    kg('Limão taiti', 699),
    kg('Mamão formosa', 799),
    kg('Melancia', 349),
    kg('Abacaxi pérola', 899),
    kg('Uva niágara', 1499),
    kg('Tomate', 899),
    kg('Batata inglesa', 599),
    kg('Cebola', 549),
    kg('Alho', 3290),
    kg('Cenoura', 549),
    kg('Beterraba', 599),
    kg('Chuchu', 449),
    kg('Abobrinha', 699),
    kg('Pimentão verde', 999),
    kg('Mandioca descascada', 899),
    kg('Batata-doce', 549),
    p('Alface crespa (pé)', 399),
    p('Couve manteiga (maço)', 349),
    p('Cheiro-verde (maço)', 299),
    p('Repolho (unidade)', 699),
    p('Ovos brancos (30 unidades)', 2290, 'Bandeja com 30 ovos'),
    p('Ovos caipira (12 unidades)', 1490),
  ],
};

const ACOUGUE_MERCADO: SecaoDemo = {
  nome: 'Açougue',
  produtos: [
    kg('Picanha bovina', 8990),
    kg('Alcatra', 5490),
    kg('Contrafilé', 5290),
    kg('Patinho', 4590),
    kg('Acém', 3490),
    kg('Costela bovina', 2990),
    kg('Carne moída de primeira', 4490),
    kg('Carne moída de segunda', 3290),
    kg('Coxa e sobrecoxa de frango', 1590),
    kg('Peito de frango', 1990),
    kg('Filé de peito de frango', 2690),
    kg('Linguiça toscana', 2290),
    kg('Linguiça de frango', 1990),
    kg('Bisteca suína', 2390),
    kg('Pernil suíno', 2190),
    kg('Costelinha suína', 2690),
    kg('Panceta', 2990),
  ],
};

const FRIOS: SecaoDemo = {
  nome: 'Frios e laticínios',
  produtos: [
    kg('Queijo mussarela fatiado', 4990),
    kg('Presunto fatiado', 3290),
    kg('Mortadela fatiada', 2290),
    kg('Salame italiano', 7990),
    p('Leite integral 1 L', 549),
    p('Leite desnatado 1 L', 569),
    p('Caixa de leite integral (12 × 1 L)', 6290, 'Fardo com 12 caixas'),
    p('Manteiga com sal 200 g', 1390),
    p('Margarina 500 g', 899),
    p('Requeijão cremoso 200 g', 849),
    p('Iogurte natural 170 g', 399),
    p('Bebida láctea morango 900 g', 799),
    p('Creme de leite 200 g', 399),
    p('Leite condensado 395 g', 699),
    p('Queijo parmesão ralado 50 g', 799),
    p('Cream cheese 150 g', 999),
  ],
};

const PADARIA: SecaoDemo = {
  nome: 'Padaria',
  produtos: [
    kg('Pão francês', 1690, 'Saído do forno de hora em hora'),
    p('Pão de forma tradicional 500 g', 899),
    p('Pão de forma integral 400 g', 1049),
    p('Bisnaguinha 300 g', 799),
    p('Bolo de fubá (unidade)', 1590),
    p('Cuca de uva (unidade)', 1990, 'Receita da casa'),
    p('Sonho de creme', 499),
    p('Rosca de coco', 1290),
  ],
};

const MERCEARIA_BASICA: SecaoDemo = {
  nome: 'Mercearia',
  produtos: [
    p('Arroz tipo 1 5 kg', 2990),
    p('Arroz parboilizado 5 kg', 2890),
    p('Feijão carioca 1 kg', 849),
    p('Feijão preto 1 kg', 899),
    p('Açúcar cristal 5 kg', 2290),
    p('Açúcar refinado 1 kg', 549),
    p('Sal refinado 1 kg', 299),
    p('Óleo de soja 900 ml', 849),
    p('Azeite extra virgem 500 ml', 3490),
    p('Farinha de trigo 5 kg', 2190),
    p('Farinha de mandioca 1 kg', 799),
    p('Fubá mimoso 1 kg', 499),
    p('Café torrado e moído 500 g', 2290),
    p('Café em cápsula (10 unidades)', 2190),
    p('Achocolatado em pó 400 g', 999),
    p('Leite em pó integral 400 g', 1990),
    p('Aveia em flocos 200 g', 549),
    p('Vinagre de álcool 750 ml', 349),
  ],
};

const MASSAS: SecaoDemo = {
  nome: 'Massas, molhos e conservas',
  produtos: [
    p('Macarrão espaguete 500 g', 499),
    p('Macarrão parafuso 500 g', 499),
    p('Macarrão instantâneo 85 g', 199),
    p('Lasanha pré-cozida 500 g', 899),
    p('Molho de tomate tradicional 340 g', 349),
    p('Extrato de tomate 190 g', 399),
    p('Maionese 500 g', 1090),
    p('Ketchup 380 g', 999),
    p('Mostarda 200 g', 599),
    p('Milho verde em lata 170 g', 499),
    p('Ervilha em lata 170 g', 449),
    p('Atum ralado em óleo 170 g', 1090),
    p('Sardinha em óleo 125 g', 649),
    p('Azeitona verde 200 g', 899),
    p('Palmito em conserva 300 g', 1690),
  ],
};

const BISCOITOS: SecaoDemo = {
  nome: 'Biscoitos e doces',
  produtos: [
    p('Biscoito cream cracker 400 g', 649),
    p('Biscoito maisena 400 g', 599),
    p('Biscoito recheado chocolate 130 g', 349),
    p('Biscoito de polvilho 100 g', 499),
    p('Wafer de chocolate 115 g', 399),
    p('Chocolate ao leite 90 g', 699),
    p('Bombom sortido 250 g', 1690),
    p('Paçoca (caixa com 20)', 1290),
    p('Gelatina sabor morango 25 g', 199),
    p('Mistura para bolo chocolate 400 g', 699),
    p('Pipoca de micro-ondas 100 g', 399),
  ],
};

const BEBIDAS: SecaoDemo = {
  nome: 'Bebidas',
  produtos: [
    p('Refrigerante cola 2 L', 1090),
    p('Refrigerante guaraná 2 L', 899),
    p('Refrigerante laranja 2 L', 849),
    p('Refrigerante cola lata 350 ml', 499),
    p('Água mineral sem gás 1,5 L', 349),
    p('Água mineral com gás 500 ml', 299),
    p('Suco de uva integral 1 L', 1490),
    p('Suco de laranja 1 L', 1090),
    p('Chá gelado de pêssego 1,5 L', 749),
    p('Energético 473 ml', 1090),
    p('Isotônico 500 ml', 599),
  ],
};

const BEBIDAS_ALCOOLICAS: SecaoDemo = {
  nome: 'Cervejas e destilados',
  produtos: [
    p('Cerveja pilsen lata 350 ml', 399, 'Venda proibida para menores de 18 anos'),
    p('Fardo cerveja pilsen (12 latas)', 4490, 'Venda proibida para menores de 18 anos'),
    p('Cerveja puro malte long neck 330 ml', 749, 'Venda proibida para menores de 18 anos'),
    p('Cerveja artesanal IPA 500 ml', 1890, 'Venda proibida para menores de 18 anos'),
    p('Vinho tinto suave 750 ml', 2490, 'Venda proibida para menores de 18 anos'),
    p('Cachaça 1 L', 2890, 'Venda proibida para menores de 18 anos'),
    p('Vodka 1 L', 3990, 'Venda proibida para menores de 18 anos'),
  ],
};

const CONGELADOS: SecaoDemo = {
  nome: 'Congelados',
  produtos: [
    p('Pão de queijo congelado 1 kg', 2490),
    p('Lasanha à bolonhesa 600 g', 1990),
    p('Pizza congelada mussarela 460 g', 1690),
    p('Batata pré-frita 1 kg', 1890),
    p('Hambúrguer bovino (caixa com 12)', 2290),
    p('Nuggets de frango 300 g', 1290),
    p('Sorvete de creme 2 L', 2490),
    p('Polpa de fruta maracujá 400 g', 899),
  ],
};

const LIMPEZA: SecaoDemo = {
  nome: 'Limpeza',
  produtos: [
    p('Detergente líquido 500 ml', 299),
    p('Sabão em pó 1,6 kg', 2290),
    p('Sabão líquido para roupas 3 L', 3990),
    p('Amaciante 2 L', 1490),
    p('Água sanitária 2 L', 699),
    p('Desinfetante 2 L', 999),
    p('Esponja de louça (pacote com 3)', 599),
    p('Papel toalha (2 rolos)', 699),
    p('Saco de lixo 50 L (30 unidades)', 1190),
    p('Limpador multiuso 500 ml', 599),
  ],
};

const HIGIENE: SecaoDemo = {
  nome: 'Higiene pessoal',
  produtos: [
    p('Papel higiênico folha dupla (12 rolos)', 2290),
    p('Sabonete em barra 85 g', 299),
    p('Creme dental 90 g', 599),
    p('Escova de dentes macia', 899),
    p('Shampoo 350 ml', 1690),
    p('Condicionador 350 ml', 1790),
    p('Desodorante aerossol 150 ml', 1590),
    p('Absorvente com abas (8 unidades)', 699),
    p('Aparelho de barbear (pacote com 2)', 1190),
  ],
};

const BEBE: SecaoDemo = {
  nome: 'Bebê',
  produtos: [
    p('Fralda descartável M (pacote com 36)', 5490),
    p('Fralda descartável G (pacote com 32)', 5490),
    p('Lenço umedecido (100 unidades)', 1490),
    p('Pomada para assaduras 45 g', 2290),
  ],
};

export const CATALOGO_SUPERMERCADO: SecaoDemo[] = [
  HORTIFRUTI,
  ACOUGUE_MERCADO,
  FRIOS,
  PADARIA,
  MERCEARIA_BASICA,
  MASSAS,
  BISCOITOS,
  BEBIDAS,
  BEBIDAS_ALCOOLICAS,
  CONGELADOS,
  LIMPEZA,
  HIGIENE,
  BEBE,
];

/** A mercearia de bairro tem de tudo um pouco, sem a variedade do mercado. */
export const CATALOGO_MERCEARIA: SecaoDemo[] = [
  { nome: 'Hortifrúti', produtos: HORTIFRUTI.produtos.slice(0, 14) },
  { nome: 'Frios e laticínios', produtos: FRIOS.produtos.slice(0, 11) },
  { nome: 'Padaria', produtos: PADARIA.produtos.slice(0, 5) },
  MERCEARIA_BASICA,
  { nome: 'Massas e molhos', produtos: MASSAS.produtos.slice(0, 9) },
  { nome: 'Biscoitos e doces', produtos: BISCOITOS.produtos.slice(0, 7) },
  BEBIDAS,
  { nome: 'Cervejas', produtos: BEBIDAS_ALCOOLICAS.produtos.slice(0, 3) },
  { nome: 'Limpeza', produtos: LIMPEZA.produtos.slice(0, 7) },
  { nome: 'Higiene', produtos: HIGIENE.produtos.slice(0, 5) },
];

export const CATALOGO_ACOUGUE: SecaoDemo[] = [
  {
    nome: 'Bovinos',
    produtos: [
      kg('Picanha', 8490),
      kg('Maminha', 5690),
      kg('Fraldinha', 4890),
      kg('Alcatra', 5290),
      kg('Contrafilé', 4990),
      kg('Filé mignon', 9990),
      kg('Cupim', 4290),
      kg('Costela gaúcha', 2890),
      kg('Acém', 3290),
      kg('Músculo', 3190),
      kg('Carne moída de primeira', 4290),
      kg('Carne moída de segunda', 3090),
      kg('Fígado bovino', 1890),
    ],
  },
  {
    nome: 'Suínos',
    produtos: [
      kg('Bisteca', 2290),
      kg('Lombo', 2690),
      kg('Pernil', 2090),
      kg('Costelinha', 2590),
      kg('Panceta', 2890),
      kg('Toucinho', 1690),
    ],
  },
  {
    nome: 'Aves',
    produtos: [
      kg('Frango inteiro', 1290),
      kg('Coxa e sobrecoxa', 1490),
      kg('Peito de frango', 1890),
      kg('Filé de peito', 2590),
      kg('Asa de frango', 1790),
      kg('Coração de frango', 3490),
    ],
  },
  {
    nome: 'Linguiças e embutidos',
    produtos: [
      kg('Linguiça toscana', 2190),
      kg('Linguiça caseira da casa', 2690, 'Receita própria, temperada no dia'),
      kg('Linguiça de frango', 1890),
      kg('Bacon em manta', 4290),
    ],
  },
  {
    nome: 'Para o churrasco',
    produtos: [
      p('Kit churrasco 4 pessoas', 11990, 'Picanha, linguiça, frango e pão de alho'),
      p('Kit churrasco 8 pessoas', 21990, 'Picanha, maminha, linguiça, frango e pão de alho'),
      p('Pão de alho (pacote com 5)', 1690),
      p('Carvão vegetal 3 kg', 2290),
      p('Sal grosso 1 kg', 399),
    ],
  },
];

export const CATALOGO_FARMACIA: SecaoDemo[] = [
  {
    nome: 'Medicamentos sem receita',
    produtos: [
      p('Dipirona 500 mg (10 comprimidos)', 790),
      p('Dipirona gotas 20 ml', 1090),
      p('Paracetamol 750 mg (20 comprimidos)', 1290),
      p('Ibuprofeno 400 mg (10 comprimidos)', 1590),
      p('Antiácido efervescente (6 envelopes)', 1190),
      p('Relaxante muscular (10 comprimidos)', 1890),
      p('Antigripal (10 cápsulas)', 2190),
      p('Xarope expectorante 120 ml', 2490),
      p('Pastilha para garganta (12 unidades)', 1490),
      p('Soro fisiológico 500 ml', 890),
      p('Vitamina C efervescente 1 g (10 comprimidos)', 1690),
      p('Polivitamínico (30 comprimidos)', 3990),
      p('Sais para reidratação oral', 390),
      p('Colírio lubrificante 10 ml', 2890),
      p('Pomada para dor muscular 60 g', 2690),
    ],
  },
  {
    nome: 'Medicamentos com receita',
    produtos: [
      comReceita('Amoxicilina 500 mg (21 cápsulas)', 2890),
      comReceita('Azitromicina 500 mg (3 comprimidos)', 3190),
      comReceita('Losartana 50 mg (30 comprimidos)', 1490),
      comReceita('Omeprazol 20 mg (28 cápsulas)', 1890),
      {
        nome: 'Clonazepam 2 mg (30 comprimidos)',
        precoCents: 2290,
        descricao: 'Controle especial: venda só no balcão, com a receita retida.',
        receita: 'CONTROLLED',
      },
    ],
  },
  {
    nome: 'Primeiros socorros',
    produtos: [
      p('Curativo adesivo (40 unidades)', 1190),
      p('Gaze estéril (10 unidades)', 690),
      p('Esparadrapo 10 cm × 4,5 m', 890),
      p('Álcool 70% 1 L', 1290),
      p('Álcool em gel 500 ml', 1190),
      p('Água oxigenada 10 volumes 100 ml', 490),
      p('Termômetro digital', 2990),
      p('Máscara descartável (50 unidades)', 1990),
    ],
  },
  {
    nome: 'Higiene e beleza',
    produtos: [
      p('Protetor solar FPS 50 120 ml', 5990),
      p('Hidratante corporal 400 ml', 2490),
      p('Shampoo anticaspa 200 ml', 2990),
      p('Fio dental 50 m', 890),
      p('Enxaguante bucal 500 ml', 2290),
      p('Creme dental clareador 70 g', 1290),
      p('Desodorante roll-on 50 ml', 1390),
      p('Repelente spray 100 ml', 2690),
      p('Algodão 100 g', 790),
      p('Hastes flexíveis (150 unidades)', 690),
    ],
  },
  {
    nome: 'Mamãe e bebê',
    produtos: [
      p('Fralda infantil M (pacote com 40)', 6490),
      p('Fralda infantil G (pacote com 36)', 6490),
      p('Fralda geriátrica G (8 unidades)', 3990),
      p('Lenço umedecido (96 unidades)', 1390),
      p('Pomada para assaduras 80 g', 3290),
      p('Fórmula infantil 800 g', 6990),
      p('Mamadeira 240 ml', 3490),
      p('Chupeta silicone', 2290),
    ],
  },
  {
    nome: 'Saúde',
    produtos: [
      p('Teste de gravidez', 1990),
      p('Preservativo (3 unidades)', 1290),
      p('Fitas para glicemia (50 unidades)', 7990),
      p('Meia de compressão', 8990),
      p('Bolsa térmica de gel', 2490),
    ],
  },
];

export interface PizzaDemo {
  tamanhos: { nome: string; maxSabores: number; fatias: number }[];
  sabores: { nome: string; descricao: string; precos: number[]; grupo: string }[];
  bordas: { nome: string; tipo: 'EDGE' | 'CRUST' | 'TOPPING'; precoCents: number }[];
}

const salgada = (nome: string, descricao: string, base: number) => ({
  nome,
  descricao,
  grupo: 'Salgadas',
  precos: [base, base + 1200, base + 2400, base + 3600],
});

const especial = (nome: string, descricao: string, base: number) => ({
  nome,
  descricao,
  grupo: 'Especiais',
  precos: [base, base + 1400, base + 2800, base + 4000],
});

const doce = (nome: string, descricao: string, base: number) => ({
  nome,
  descricao,
  grupo: 'Doces',
  precos: [base, base + 1000, base + 2000, base + 3000],
});

export const PIZZA: PizzaDemo = {
  tamanhos: [
    { nome: 'Broto', maxSabores: 1, fatias: 4 },
    { nome: 'Média', maxSabores: 2, fatias: 6 },
    { nome: 'Grande', maxSabores: 3, fatias: 8 },
    { nome: 'Gigante', maxSabores: 4, fatias: 12 },
  ],
  sabores: [
    salgada('Mussarela', 'Molho de tomate, mussarela e orégano', 2990),
    salgada('Calabresa', 'Mussarela, calabresa fatiada e cebola', 3190),
    salgada('Margherita', 'Mussarela, tomate e manjericão fresco', 3290),
    salgada('Portuguesa', 'Presunto, ovo, ervilha, cebola, azeitona e mussarela', 3490),
    salgada('Frango com catupiry', 'Frango desfiado e catupiry', 3490),
    salgada('Milho com bacon', 'Mussarela, milho e bacon crocante', 3390),
    salgada('Napolitana', 'Mussarela, tomate e parmesão', 3290),
    salgada('Atum', 'Atum, cebola e mussarela', 3590),
    salgada('Bacon', 'Mussarela e bacon', 3390),
    salgada('Quatro queijos', 'Mussarela, provolone, parmesão e catupiry', 3690),
    salgada('Palmito', 'Palmito, mussarela e azeitona', 3590),
    salgada('Brócolis com bacon', 'Brócolis, bacon, alho e mussarela', 3590),
    especial('Filé com cheddar', 'Tiras de filé mignon, cheddar e cebola roxa', 4490),
    especial('Costela desfiada', 'Costela bovina desfiada, catupiry e cebola caramelizada', 4690),
    especial('Strogonoff de carne', 'Strogonoff, batata palha e mussarela', 4290),
    especial('Camarão', 'Camarão ao alho, catupiry e mussarela', 5290),
    especial('Pepperoni', 'Mussarela e pepperoni', 3990),
    especial('Carne seca com catupiry', 'Carne seca desfiada, catupiry e cebola', 4590),
    doce('Chocolate', 'Chocolate ao leite e granulado', 3190),
    doce('Brigadeiro', 'Chocolate, brigadeiro e granulado', 3290),
    doce('Romeu e Julieta', 'Mussarela e goiabada', 3190),
    doce('Banana com canela', 'Banana, açúcar, canela e leite condensado', 3090),
    doce('Prestígio', 'Chocolate e coco ralado', 3290),
    doce('Morango com chocolate', 'Chocolate branco e morango', 3590),
  ],
  bordas: [
    { nome: 'Borda de catupiry', tipo: 'EDGE', precoCents: 900 },
    { nome: 'Borda de cheddar', tipo: 'EDGE', precoCents: 900 },
    { nome: 'Borda de chocolate', tipo: 'EDGE', precoCents: 1000 },
    { nome: 'Massa fina', tipo: 'CRUST', precoCents: 0 },
    { nome: 'Massa integral', tipo: 'CRUST', precoCents: 500 },
    { nome: 'Catupiry extra', tipo: 'TOPPING', precoCents: 600 },
    { nome: 'Bacon extra', tipo: 'TOPPING', precoCents: 700 },
    { nome: 'Orégano e azeite à parte', tipo: 'TOPPING', precoCents: 0 },
  ],
};

export const CARDAPIO_PIZZARIA: SecaoDemo[] = [
  {
    nome: 'Bebidas',
    produtos: [
      p('Refrigerante 2 L', 1290),
      p('Refrigerante lata 350 ml', 599),
      p('Suco natural 500 ml', 990),
      p('Água mineral 500 ml', 399),
      p('Cerveja long neck', 890, 'Venda proibida para menores de 18 anos'),
    ],
  },
  {
    nome: 'Porções',
    produtos: [
      p('Batata frita 500 g', 3290, 'Com cheddar e bacon, + R$ 8'),
      p('Calabresa acebolada', 3490),
      p('Polenta frita', 2690),
    ],
  },
  {
    nome: 'Sobremesas',
    produtos: [p('Petit gâteau', 1990), p('Pudim de leite (fatia)', 990)],
  },
];

export const CARDAPIO_HAMBURGUERIA: SecaoDemo[] = [
  {
    nome: 'Hambúrgueres',
    produtos: [
      p('X-Burger', 2290, 'Pão, hambúrguer 150 g, queijo e maionese da casa'),
      p('X-Salada', 2490, 'Hambúrguer 150 g, queijo, alface e tomate'),
      p('X-Bacon', 2890, 'Hambúrguer 150 g, queijo e bacon crocante'),
      p('X-Egg', 2690, 'Hambúrguer 150 g, queijo e ovo'),
      p('X-Tudo', 3690, 'Hambúrguer, queijo, bacon, ovo, calabresa, presunto e salada'),
      p('Smash duplo', 3290, 'Dois smash de 90 g, cheddar e cebola caramelizada'),
      p('Cheddar melt', 3490, 'Hambúrguer 180 g, cheddar cremoso e cebola crispy'),
      p('Burger da casa', 3990, 'Blend 200 g, queijo prato, bacon, picles e molho especial'),
      p('Frango crispy', 2990, 'Filé de frango empanado, alface e maionese de ervas'),
      p('Veggie de grão-de-bico', 2990, 'Hambúrguer de grão-de-bico, rúcula e tomate seco'),
    ],
  },
  {
    nome: 'Combos',
    produtos: [
      p('Combo X-Bacon', 4290, 'X-Bacon, batata média e refrigerante lata'),
      p('Combo Smash', 4590, 'Smash duplo, batata média e refrigerante lata'),
      p('Combo família', 11990, '4 X-Burgers, batata grande e refrigerante 2 L'),
    ],
  },
  {
    nome: 'Acompanhamentos',
    produtos: [
      p('Batata frita média', 1690),
      p('Batata frita grande', 2490),
      p('Batata com cheddar e bacon', 2990),
      p('Onion rings', 1990),
      p('Nuggets (10 unidades)', 1890),
    ],
  },
  {
    nome: 'Bebidas',
    produtos: [
      p('Refrigerante lata 350 ml', 599),
      p('Refrigerante 2 L', 1290),
      p('Milk-shake de chocolate 400 ml', 1890),
      p('Milk-shake de morango 400 ml', 1890),
      p('Suco natural 500 ml', 990),
    ],
  },
];

export const CARDAPIO_LANCHONETE: SecaoDemo[] = [
  {
    nome: 'Salgados',
    produtos: [
      p('Coxinha de frango', 650),
      p('Coxinha com catupiry', 750),
      p('Pastel de carne', 800),
      p('Pastel de queijo', 750),
      p('Pastel de frango com catupiry', 850),
      p('Esfiha de carne', 600),
      p('Enroladinho de salsicha', 550),
      p('Risole de presunto e queijo', 650),
      p('Kibe', 650),
      p('Pão de queijo (unidade)', 350),
      p('Cento de salgadinhos para festa', 8990, 'Coxinha, kibe, risole e bolinha de queijo'),
    ],
  },
  {
    nome: 'Lanches',
    produtos: [
      p('Misto quente', 990),
      p('Beirute de frango', 2490),
      p('Cachorro-quente completo', 1490, 'Duas salsichas, purê, milho, batata palha'),
      p('Bauru', 1690),
      p('Sanduíche natural de frango', 1290),
      p('Tapioca de queijo e presunto', 1390),
    ],
  },
  {
    nome: 'Café e bebidas',
    produtos: [
      p('Café coado', 450),
      p('Café com leite', 600),
      p('Cappuccino', 900),
      p('Chocolate quente', 950),
      p('Suco de laranja 400 ml', 890),
      p('Vitamina de banana', 990),
      p('Refrigerante lata', 550),
    ],
  },
  {
    nome: 'Doces',
    produtos: [
      p('Bolo de cenoura com chocolate (fatia)', 890),
      p('Torta de limão (fatia)', 990),
      p('Brigadeiro gourmet', 450),
      p('Pudim (fatia)', 890),
    ],
  },
];

export const CARDAPIO_ACAI: SecaoDemo[] = [
  {
    nome: 'Açaí',
    produtos: [
      p('Açaí 300 ml', 1390, 'Escolha até 5 complementos'),
      p('Açaí 500 ml', 1890, 'Escolha até 5 complementos'),
      p('Açaí 700 ml', 2490, 'Escolha até 5 complementos'),
      p('Açaí 1 L', 3290, 'Escolha até 5 complementos'),
      p('Barca de açaí (serve 3)', 5490, 'Açaí, frutas, granola, leite condensado e bombons'),
    ],
  },
  {
    nome: 'Sorvetes',
    produtos: [
      p('Sorvete 1 bola', 690),
      p('Sorvete 2 bolas', 1190),
      p('Pote de sorvete 1,5 L', 3490),
      p('Picolé de fruta', 450),
      p('Picolé cremoso', 650),
      p('Sundae de chocolate', 1590),
    ],
  },
  {
    nome: 'Bebidas',
    produtos: [
      p('Milk-shake 500 ml', 1790),
      p('Smoothie de frutas vermelhas', 1690),
      p('Água mineral', 399),
    ],
  },
];

export const CARDAPIO_RESTAURANTE: SecaoDemo[] = [
  {
    nome: 'Marmitas',
    produtos: [
      p('Marmita pequena', 1890, 'Arroz, feijão, salada e uma carne'),
      p('Marmita média', 2290, 'Arroz, feijão, salada, farofa e uma carne'),
      p('Marmita grande', 2690, 'Arroz, feijão, salada, farofa, macarrão e duas carnes'),
      p('Marmita fitness', 2590, 'Arroz integral, legumes no vapor e frango grelhado'),
    ],
  },
  {
    nome: 'Pratos executivos',
    produtos: [
      p('Filé de frango à parmegiana', 3290, 'Com arroz e fritas'),
      p('Bife acebolado', 2990, 'Com arroz, feijão e fritas'),
      p('Tilápia grelhada', 3490, 'Com arroz, purê e salada'),
      p('Strogonoff de frango', 2890, 'Com arroz e batata palha'),
      p('Feijoada completa', 3690, 'Sábados. Com arroz, couve, torresmo e laranja'),
      p('Costela assada', 3890, 'Com mandioca e salada'),
    ],
  },
  {
    nome: 'Porções',
    produtos: [
      p('Porção de fritas', 2490),
      p('Porção de mandioca frita', 2490),
      p('Isca de tilápia', 4990),
      p('Frango a passarinho', 3990),
    ],
  },
  {
    nome: 'Bebidas',
    produtos: [
      p('Refrigerante lata', 550),
      p('Refrigerante 2 L', 1190),
      p('Suco natural 500 ml', 890),
      p('Água mineral', 350),
    ],
  },
];

export const CARDAPIO_PETSHOP: SecaoDemo[] = [
  {
    nome: 'Rações para cães',
    produtos: [
      p('Ração cães adultos 15 kg', 15990),
      p('Ração cães adultos 3 kg', 4290),
      p('Ração cães filhotes 3 kg', 4990),
      p('Ração cães porte pequeno 1 kg', 2290),
      p('Ração premium cães adultos 10,1 kg', 21990),
      p('Sachê para cães 100 g', 390),
    ],
  },
  {
    nome: 'Rações para gatos',
    produtos: [
      p('Ração gatos adultos 10 kg', 13990),
      p('Ração gatos adultos 1 kg', 2490),
      p('Ração gatos castrados 3 kg', 6990),
      p('Sachê para gatos 85 g', 350),
      p('Areia higiênica 4 kg', 1990),
      p('Areia de sílica 1,6 kg', 3490),
    ],
  },
  {
    nome: 'Petiscos',
    produtos: [
      p('Bifinho de carne 60 g', 890),
      p('Osso de couro', 690),
      p('Petisco dental', 1290),
      p('Snack para gatos 40 g', 790),
    ],
  },
  {
    nome: 'Higiene e saúde',
    produtos: [
      p('Tapete higiênico (30 unidades)', 5990),
      p('Shampoo neutro para cães 500 ml', 2290),
      p('Antipulgas para cães 10–20 kg', 5990),
      p('Vermífugo para cães (4 comprimidos)', 3290),
    ],
  },
  {
    nome: 'Acessórios',
    produtos: [
      p('Coleira ajustável', 2490),
      p('Guia de passeio', 2990),
      p('Comedouro inox', 2190),
      p('Bolinha de borracha', 1190),
      p('Arranhador para gatos', 5990),
    ],
  },
];

export const CARDAPIO_AGUA_GAS: SecaoDemo[] = [
  {
    nome: 'Gás',
    produtos: [
      p('Botijão de gás P13 (troca)', 11500, 'Entrega com o botijão vazio na troca'),
      p('Botijão de gás P13 (com vasilhame)', 29900, 'Para quem não tem botijão'),
      p('Botijão P45 (troca)', 42000, 'Para comércio'),
    ],
  },
  {
    nome: 'Água',
    produtos: [
      p('Galão de água mineral 20 L (troca)', 1500),
      p('Galão de água 20 L com vasilhame', 3900),
      p('Fardo de água 500 ml (12 unidades)', 1890),
      p('Fardo de água 1,5 L (6 unidades)', 1590),
    ],
  },
  {
    nome: 'Acessórios',
    produtos: [p('Registro de gás com mangueira', 4990), p('Bomba para galão', 2490)],
  },
];

// ---------------------------------------------------------------------------
// Complementos
// ---------------------------------------------------------------------------

export interface GrupoDemo {
  nome: string;
  obrigatorio: boolean;
  min: number;
  max: number;
  opcoes: [string, number][];
  /** Nome das seções do cardápio cujos produtos recebem o grupo. */
  secoes: string[];
}

export const COMPLEMENTOS: Record<string, GrupoDemo[]> = {
  hamburgueria: [
    {
      nome: 'Ponto da carne',
      obrigatorio: true,
      min: 1,
      max: 1,
      opcoes: [
        ['Mal passado', 0],
        ['Ao ponto', 0],
        ['Bem passado', 0],
      ],
      secoes: ['Hambúrgueres', 'Combos'],
    },
    {
      nome: 'Adicionais',
      obrigatorio: false,
      min: 0,
      max: 6,
      opcoes: [
        ['Bacon extra', 500],
        ['Queijo extra', 400],
        ['Ovo', 300],
        ['Hambúrguer extra', 900],
        ['Cebola caramelizada', 300],
        ['Molho especial', 200],
      ],
      secoes: ['Hambúrgueres'],
    },
  ],
  'acai-e-sorvetes': [
    {
      nome: 'Complementos',
      obrigatorio: false,
      min: 0,
      max: 5,
      opcoes: [
        ['Granola', 200],
        ['Leite condensado', 200],
        ['Leite em pó', 300],
        ['Banana', 200],
        ['Morango', 400],
        ['Kiwi', 400],
        ['Paçoca', 200],
        ['Confete', 300],
        ['Nutella', 600],
        ['Bis picado', 400],
      ],
      secoes: ['Açaí'],
    },
  ],
  restaurante: [
    {
      nome: 'Escolha a carne',
      obrigatorio: true,
      min: 1,
      max: 1,
      opcoes: [
        ['Frango grelhado', 0],
        ['Bife acebolado', 0],
        ['Linguiça', 0],
        ['Carne de panela', 0],
        ['Filé de tilápia', 300],
      ],
      secoes: ['Marmitas'],
    },
    {
      nome: 'Acompanhamento extra',
      obrigatorio: false,
      min: 0,
      max: 3,
      opcoes: [
        ['Ovo frito', 250],
        ['Batata frita', 500],
        ['Maionese caseira', 300],
        ['Farofa', 200],
      ],
      secoes: ['Marmitas', 'Pratos executivos'],
    },
  ],
  lanchonete: [
    {
      nome: 'Molho',
      obrigatorio: false,
      min: 0,
      max: 2,
      opcoes: [
        ['Ketchup', 0],
        ['Maionese', 0],
        ['Mostarda', 0],
        ['Pimenta', 0],
      ],
      secoes: ['Salgados', 'Lanches'],
    },
  ],
};

// ---------------------------------------------------------------------------
// Lojas
// ---------------------------------------------------------------------------

export type Catalogo =
  | 'supermercado'
  | 'mercearia'
  | 'acougue'
  | 'farmacia'
  | 'pizzaria'
  | 'hamburgueria'
  | 'lanchonete'
  | 'acai'
  | 'restaurante'
  | 'petshop'
  | 'agua-e-gas';

export type Horario =
  'comercial' | 'mercado' | 'farmacia' | 'jantar' | 'almoco' | 'lanches' | 'tarde';

export interface LojaDemo {
  nome: string;
  categoria: string;
  segmento: 'MARKET' | 'PHARMACY' | 'RESTAURANT' | 'OTHER';
  catalogo: Catalogo;
  descricao: string;
  rua: string;
  numero: string;
  bairro: string;
  referencia?: string;
  frete: 'FIXED' | 'BY_ZONE' | 'FREE';
  freteCents: number;
  minimoCents: number;
  preparoMin: number;
  plano: 'gratis' | 'essencial' | 'mercado';
  horario: Horario;
  /** Popularidade relativa: pesa na quantidade de pedidos gerados. */
  peso: number;
  /** Variação de preço em relação ao catálogo base (1 = igual). */
  fatorPreco: number;
  aceitaRetirada?: boolean;
  /** Loja cadastrada aguardando aprovação: aparece só no painel. */
  pendente?: boolean;
}

export const LOJAS: LojaDemo[] = [
  // --- Supermercados -------------------------------------------------------
  {
    nome: 'Supermercado Estrela do Oeste',
    categoria: 'supermercado',
    segmento: 'MARKET',
    catalogo: 'supermercado',
    descricao: 'Tudo para a sua casa, com hortifrúti fresco toda manhã e açougue próprio.',
    rua: 'Avenida Brasil',
    numero: '1450',
    bairro: 'Centro',
    referencia: 'Ao lado do posto de combustível',
    frete: 'BY_ZONE',
    freteCents: 700,
    minimoCents: 4000,
    preparoMin: 45,
    plano: 'mercado',
    horario: 'mercado',
    peso: 9,
    fatorPreco: 1,
  },
  {
    nome: 'Super Econômico Palmital',
    categoria: 'supermercado',
    segmento: 'MARKET',
    catalogo: 'supermercado',
    descricao: 'Preço baixo todo dia. Ofertas de hortifrúti às quartas.',
    rua: 'Rua Marechal Floriano Peixoto',
    numero: '312',
    bairro: 'Centro',
    frete: 'FIXED',
    freteCents: 800,
    minimoCents: 5000,
    preparoMin: 50,
    plano: 'mercado',
    horario: 'mercado',
    peso: 7,
    fatorPreco: 0.94,
  },
  {
    nome: 'Mercado Vila Nova',
    categoria: 'supermercado',
    segmento: 'MARKET',
    catalogo: 'supermercado',
    descricao: 'O mercado do bairro, com entrega rápida na Vila Nova e redondezas.',
    rua: 'Rua das Acácias',
    numero: '88',
    bairro: 'Vila Nova',
    frete: 'BY_ZONE',
    freteCents: 600,
    minimoCents: 3000,
    preparoMin: 40,
    plano: 'essencial',
    horario: 'mercado',
    peso: 5,
    fatorPreco: 1.03,
  },
  // --- Mercearias ----------------------------------------------------------
  {
    nome: 'Mercearia Dona Cida',
    categoria: 'mercearia',
    segmento: 'MARKET',
    catalogo: 'mercearia',
    descricao: 'Mercearia de família desde 1998. Pão quentinho de manhã e de tarde.',
    rua: 'Rua Santos Dumont',
    numero: '540',
    bairro: 'Jardim Panorama',
    referencia: 'Esquina com a Rua Paraná',
    frete: 'FIXED',
    freteCents: 500,
    minimoCents: 2000,
    preparoMin: 25,
    plano: 'essencial',
    horario: 'comercial',
    peso: 4,
    fatorPreco: 1.06,
  },
  {
    nome: 'Empório São Cristóvão',
    categoria: 'mercearia',
    segmento: 'MARKET',
    catalogo: 'mercearia',
    descricao: 'Mercearia, frios fatiados na hora e bebidas geladas.',
    rua: 'Rua São Cristóvão',
    numero: '1021',
    bairro: 'São Cristóvão',
    frete: 'FIXED',
    freteCents: 600,
    minimoCents: 2500,
    preparoMin: 25,
    plano: 'gratis',
    horario: 'comercial',
    peso: 3,
    fatorPreco: 1.08,
  },
  {
    nome: 'Mercearia Cohapar',
    categoria: 'mercearia',
    segmento: 'MARKET',
    catalogo: 'mercearia',
    descricao: 'Pertinho de você na Cohapar. Aceitamos Pix e cartão na entrega.',
    rua: 'Rua Ipê Amarelo',
    numero: '77',
    bairro: 'Cohapar',
    frete: 'FIXED',
    freteCents: 400,
    minimoCents: 1500,
    preparoMin: 20,
    plano: 'gratis',
    horario: 'comercial',
    peso: 3,
    fatorPreco: 1.05,
  },
  {
    nome: 'Armazém do Sítio',
    categoria: 'mercearia',
    segmento: 'MARKET',
    catalogo: 'mercearia',
    descricao: 'Produtos coloniais, ovos caipira e queijo da roça.',
    rua: 'Estrada da Vila Rural',
    numero: 's/n',
    bairro: 'Vila Rural',
    referencia: 'Entrada da Vila Rural, casa azul',
    frete: 'FIXED',
    freteCents: 900,
    minimoCents: 3000,
    preparoMin: 35,
    plano: 'gratis',
    horario: 'comercial',
    peso: 2,
    fatorPreco: 1.1,
  },
  // --- Açougues ------------------------------------------------------------
  {
    nome: 'Casa de Carnes Boi Gordo',
    categoria: 'acougue',
    segmento: 'MARKET',
    catalogo: 'acougue',
    descricao: 'Carnes selecionadas, cortes especiais e kits para o churrasco de domingo.',
    rua: 'Avenida Getúlio Vargas',
    numero: '905',
    bairro: 'Centro',
    frete: 'FIXED',
    freteCents: 600,
    minimoCents: 4000,
    preparoMin: 30,
    plano: 'essencial',
    horario: 'comercial',
    peso: 5,
    fatorPreco: 1,
  },
  {
    nome: 'Açougue Panorama',
    categoria: 'acougue',
    segmento: 'MARKET',
    catalogo: 'acougue',
    descricao: 'Linguiça caseira feita aqui. Frango resfriado todo dia.',
    rua: 'Rua Paraná',
    numero: '233',
    bairro: 'Jardim Panorama',
    frete: 'FIXED',
    freteCents: 500,
    minimoCents: 3000,
    preparoMin: 25,
    plano: 'gratis',
    horario: 'comercial',
    peso: 3,
    fatorPreco: 0.97,
  },
  // --- Farmácias -----------------------------------------------------------
  {
    nome: 'Farmácia Bem-Estar',
    categoria: 'farmacia',
    segmento: 'PHARMACY',
    catalogo: 'farmacia',
    descricao: 'Medicamentos, perfumaria e atendimento farmacêutico. Plantão aos domingos.',
    rua: 'Avenida Brasil',
    numero: '980',
    bairro: 'Centro',
    frete: 'FIXED',
    freteCents: 500,
    minimoCents: 1500,
    preparoMin: 15,
    plano: 'essencial',
    horario: 'farmacia',
    peso: 6,
    fatorPreco: 1,
  },
  {
    nome: 'Drogaria Popular do Paraná',
    categoria: 'farmacia',
    segmento: 'PHARMACY',
    catalogo: 'farmacia',
    descricao: 'Genéricos com desconto e entrega em até 40 minutos.',
    rua: 'Rua Marechal Floriano Peixoto',
    numero: '645',
    bairro: 'Centro',
    frete: 'FREE',
    freteCents: 0,
    minimoCents: 3000,
    preparoMin: 15,
    plano: 'mercado',
    horario: 'farmacia',
    peso: 5,
    fatorPreco: 0.93,
  },
  {
    nome: 'Farmácia Vida Nova',
    categoria: 'farmacia',
    segmento: 'PHARMACY',
    catalogo: 'farmacia',
    descricao: 'A farmácia do bairro Vila Nova. Aferição de pressão grátis.',
    rua: 'Rua das Palmeiras',
    numero: '410',
    bairro: 'Vila Nova',
    frete: 'FIXED',
    freteCents: 400,
    minimoCents: 1000,
    preparoMin: 15,
    plano: 'gratis',
    horario: 'comercial',
    peso: 3,
    fatorPreco: 1.04,
  },
  // --- Pizzarias -----------------------------------------------------------
  {
    nome: 'Pizzaria Forno a Lenha',
    categoria: 'pizzaria',
    segmento: 'RESTAURANT',
    catalogo: 'pizzaria',
    descricao: 'Pizza assada no forno a lenha, massa de fermentação natural.',
    rua: 'Rua Santos Dumont',
    numero: '118',
    bairro: 'Centro',
    frete: 'BY_ZONE',
    freteCents: 600,
    minimoCents: 3000,
    preparoMin: 40,
    plano: 'essencial',
    horario: 'jantar',
    peso: 9,
    fatorPreco: 1.05,
  },
  {
    nome: 'Pizza Mania',
    categoria: 'pizzaria',
    segmento: 'RESTAURANT',
    catalogo: 'pizzaria',
    descricao: 'Pizzas gigantes com até 4 sabores. Promoção de terça: grande pelo preço da média.',
    rua: 'Rua São Cristóvão',
    numero: '560',
    bairro: 'São Cristóvão',
    frete: 'FIXED',
    freteCents: 500,
    minimoCents: 3000,
    preparoMin: 45,
    plano: 'essencial',
    horario: 'jantar',
    peso: 7,
    fatorPreco: 0.95,
  },
  {
    nome: 'Pizzaria Bella Napoli',
    categoria: 'pizzaria',
    segmento: 'RESTAURANT',
    catalogo: 'pizzaria',
    descricao: 'Receitas italianas tradicionais e sabores especiais da casa.',
    rua: 'Avenida Getúlio Vargas',
    numero: '1210',
    bairro: 'Jardim Independência',
    frete: 'FIXED',
    freteCents: 700,
    minimoCents: 3500,
    preparoMin: 45,
    plano: 'gratis',
    horario: 'jantar',
    peso: 5,
    fatorPreco: 1.1,
  },
  // --- Hamburguerias -------------------------------------------------------
  {
    nome: 'Brasa Burger',
    categoria: 'hamburgueria',
    segmento: 'RESTAURANT',
    catalogo: 'hamburgueria',
    descricao: 'Hambúrguer artesanal na brasa, blend da casa e batata rústica.',
    rua: 'Rua Marechal Floriano Peixoto',
    numero: '98',
    bairro: 'Centro',
    frete: 'FIXED',
    freteCents: 600,
    minimoCents: 2500,
    preparoMin: 35,
    plano: 'essencial',
    horario: 'jantar',
    peso: 8,
    fatorPreco: 1.08,
  },
  {
    nome: 'Smash House',
    categoria: 'hamburgueria',
    segmento: 'RESTAURANT',
    catalogo: 'hamburgueria',
    descricao: 'Smash burgers crocantes e milk-shakes cremosos.',
    rua: 'Rua Paraná',
    numero: '712',
    bairro: 'Jardim Panorama',
    frete: 'FIXED',
    freteCents: 500,
    minimoCents: 2000,
    preparoMin: 30,
    plano: 'essencial',
    horario: 'jantar',
    peso: 6,
    fatorPreco: 1,
  },
  {
    nome: 'Lanches do Tio Beto',
    categoria: 'hamburgueria',
    segmento: 'RESTAURANT',
    catalogo: 'hamburgueria',
    descricao: 'O X-Tudo mais famoso de Palmital, desde 2005.',
    rua: 'Rua Ipê Amarelo',
    numero: '15',
    bairro: 'Cohapar',
    frete: 'FIXED',
    freteCents: 400,
    minimoCents: 1500,
    preparoMin: 35,
    plano: 'gratis',
    horario: 'jantar',
    peso: 7,
    fatorPreco: 0.9,
  },
  // --- Lanchonetes ---------------------------------------------------------
  {
    nome: 'Pastelaria e Lanchonete Rodoviária',
    categoria: 'lanchonete',
    segmento: 'RESTAURANT',
    catalogo: 'lanchonete',
    descricao: 'Pastel na hora, salgados fritos e caldo de cana.',
    rua: 'Avenida Brasil',
    numero: '1702',
    bairro: 'Centro',
    referencia: 'Dentro da rodoviária',
    frete: 'FIXED',
    freteCents: 500,
    minimoCents: 1500,
    preparoMin: 20,
    plano: 'gratis',
    horario: 'lanches',
    peso: 5,
    fatorPreco: 1,
  },
  {
    nome: 'Café & Cia',
    categoria: 'lanchonete',
    segmento: 'RESTAURANT',
    catalogo: 'lanchonete',
    descricao: 'Cafeteria com bolos caseiros, lanches naturais e café especial.',
    rua: 'Rua Santos Dumont',
    numero: '402',
    bairro: 'Centro',
    frete: 'FIXED',
    freteCents: 500,
    minimoCents: 1500,
    preparoMin: 20,
    plano: 'essencial',
    horario: 'tarde',
    peso: 4,
    fatorPreco: 1.12,
  },
  {
    nome: 'Salgados da Neide',
    categoria: 'lanchonete',
    segmento: 'RESTAURANT',
    catalogo: 'lanchonete',
    descricao: 'Salgados fritos e assados. Encomendas para festas com 24 h de antecedência.',
    rua: 'Rua das Palmeiras',
    numero: '1180',
    bairro: 'Vila Nova',
    frete: 'FIXED',
    freteCents: 400,
    minimoCents: 1000,
    preparoMin: 25,
    plano: 'gratis',
    horario: 'lanches',
    peso: 4,
    fatorPreco: 0.92,
  },
  // --- Açaí e sorvetes -----------------------------------------------------
  {
    nome: 'Açaí da Praça',
    categoria: 'acai-e-sorvetes',
    segmento: 'RESTAURANT',
    catalogo: 'acai',
    descricao: 'Açaí cremoso, montado do seu jeito, e sorvetes artesanais.',
    rua: 'Rua Marechal Floriano Peixoto',
    numero: '15',
    bairro: 'Centro',
    referencia: 'Em frente à praça da matriz',
    frete: 'FIXED',
    freteCents: 500,
    minimoCents: 1500,
    preparoMin: 15,
    plano: 'essencial',
    horario: 'tarde',
    peso: 6,
    fatorPreco: 1,
  },
  {
    nome: 'Gelato & Açaí Panorama',
    categoria: 'acai-e-sorvetes',
    segmento: 'RESTAURANT',
    catalogo: 'acai',
    descricao: 'Sorveteria com mais de 30 sabores e açaí no copo ou na barca.',
    rua: 'Rua Paraná',
    numero: '1040',
    bairro: 'Jardim Panorama',
    frete: 'FIXED',
    freteCents: 500,
    minimoCents: 1500,
    preparoMin: 15,
    plano: 'gratis',
    horario: 'tarde',
    peso: 4,
    fatorPreco: 0.96,
  },
  // --- Restaurantes --------------------------------------------------------
  {
    nome: 'Restaurante Tempero Mineiro',
    categoria: 'restaurante',
    segmento: 'RESTAURANT',
    catalogo: 'restaurante',
    descricao: 'Comida caseira no fogão a lenha. Marmitas de segunda a sábado.',
    rua: 'Avenida Getúlio Vargas',
    numero: '455',
    bairro: 'Centro',
    frete: 'FIXED',
    freteCents: 400,
    minimoCents: 1800,
    preparoMin: 25,
    plano: 'essencial',
    horario: 'almoco',
    peso: 8,
    fatorPreco: 1,
  },
  {
    nome: 'Cantina da Nona',
    categoria: 'restaurante',
    segmento: 'RESTAURANT',
    catalogo: 'restaurante',
    descricao: 'Massas frescas, pratos executivos e feijoada aos sábados.',
    rua: 'Rua Santos Dumont',
    numero: '780',
    bairro: 'Jardim Independência',
    frete: 'FIXED',
    freteCents: 500,
    minimoCents: 2000,
    preparoMin: 30,
    plano: 'essencial',
    horario: 'almoco',
    peso: 5,
    fatorPreco: 1.08,
  },
  {
    nome: 'Marmitaria Sabor do Campo',
    categoria: 'restaurante',
    segmento: 'RESTAURANT',
    catalogo: 'restaurante',
    descricao: 'Marmitas fartas com preço justo. Entregamos na Vila Rural.',
    rua: 'Rua São Cristóvão',
    numero: '233',
    bairro: 'São Cristóvão',
    frete: 'FIXED',
    freteCents: 300,
    minimoCents: 1800,
    preparoMin: 20,
    plano: 'gratis',
    horario: 'almoco',
    peso: 6,
    fatorPreco: 0.9,
  },
  {
    nome: 'Peixaria e Restaurante Rio Piquiri',
    categoria: 'restaurante',
    segmento: 'RESTAURANT',
    catalogo: 'restaurante',
    descricao: 'Tilápia fresca, porções e pratos para dividir no fim de semana.',
    rua: 'Rodovia PR-456',
    numero: 'km 2',
    bairro: 'Jardim Independência',
    frete: 'FIXED',
    freteCents: 800,
    minimoCents: 3000,
    preparoMin: 40,
    plano: 'gratis',
    horario: 'almoco',
    peso: 3,
    fatorPreco: 1.15,
  },
  // --- Petshop -------------------------------------------------------------
  {
    nome: 'Pet Shop Amigo Fiel',
    categoria: 'petshop',
    segmento: 'OTHER',
    catalogo: 'petshop',
    descricao: 'Rações, acessórios e farmácia veterinária. Banho e tosa com agendamento.',
    rua: 'Avenida Brasil',
    numero: '620',
    bairro: 'Centro',
    frete: 'FIXED',
    freteCents: 600,
    minimoCents: 3000,
    preparoMin: 30,
    plano: 'essencial',
    horario: 'comercial',
    peso: 4,
    fatorPreco: 1,
  },
  {
    nome: 'Casa do Criador Agropet',
    categoria: 'petshop',
    segmento: 'OTHER',
    catalogo: 'petshop',
    descricao: 'Agropecuária e pet: ração a granel, sementes e ferramentas.',
    rua: 'Rua Marechal Floriano Peixoto',
    numero: '1502',
    bairro: 'São Cristóvão',
    frete: 'FIXED',
    freteCents: 800,
    minimoCents: 5000,
    preparoMin: 40,
    plano: 'gratis',
    horario: 'comercial',
    peso: 2,
    fatorPreco: 0.95,
  },
  // --- Água e gás ----------------------------------------------------------
  {
    nome: 'Gás e Água Chama Azul',
    categoria: 'agua-e-gas',
    segmento: 'OTHER',
    catalogo: 'agua-e-gas',
    descricao: 'Botijão e galão entregues em até 30 minutos. Todos os dias.',
    rua: 'Rua Ipê Amarelo',
    numero: '402',
    bairro: 'Cohapar',
    frete: 'FREE',
    freteCents: 0,
    minimoCents: 0,
    preparoMin: 10,
    plano: 'essencial',
    horario: 'comercial',
    peso: 5,
    fatorPreco: 1,
  },
  {
    nome: 'Distribuidora Palmigás',
    categoria: 'agua-e-gas',
    segmento: 'OTHER',
    catalogo: 'agua-e-gas',
    descricao: 'Distribuidora autorizada. Aceitamos Pix, cartão e dinheiro.',
    rua: 'Avenida Getúlio Vargas',
    numero: '2100',
    bairro: 'Jardim Independência',
    frete: 'FREE',
    freteCents: 0,
    minimoCents: 0,
    preparoMin: 15,
    plano: 'gratis',
    horario: 'comercial',
    peso: 3,
    fatorPreco: 0.97,
  },
  // --- Aguardando aprovação (só aparecem no painel) ------------------------
  {
    nome: 'Doceria Açúcar Mascavo',
    categoria: 'lanchonete',
    segmento: 'RESTAURANT',
    catalogo: 'lanchonete',
    descricao: 'Bolos, tortas e doces finos por encomenda.',
    rua: 'Rua das Acácias',
    numero: '930',
    bairro: 'Vila Nova',
    frete: 'FIXED',
    freteCents: 600,
    minimoCents: 3000,
    preparoMin: 60,
    plano: 'gratis',
    horario: 'tarde',
    peso: 0,
    fatorPreco: 1,
    pendente: true,
  },
  {
    nome: 'Hortifrúti Colheita Boa',
    categoria: 'mercearia',
    segmento: 'MARKET',
    catalogo: 'mercearia',
    descricao: 'Frutas, verduras e legumes direto do produtor.',
    rua: 'Rua Paraná',
    numero: '1502',
    bairro: 'Jardim Panorama',
    frete: 'FIXED',
    freteCents: 500,
    minimoCents: 2000,
    preparoMin: 30,
    plano: 'gratis',
    horario: 'comercial',
    peso: 0,
    fatorPreco: 1,
    pendente: true,
  },
];

// ---------------------------------------------------------------------------
// Pessoas e endereços
// ---------------------------------------------------------------------------

export const NOMES = [
  'Ana',
  'Maria',
  'Juliana',
  'Fernanda',
  'Patrícia',
  'Aline',
  'Camila',
  'Bruna',
  'Letícia',
  'Gabriela',
  'Larissa',
  'Mariana',
  'Vanessa',
  'Daniela',
  'Tatiane',
  'Luciana',
  'Simone',
  'Rosângela',
  'Cleide',
  'Sueli',
  'Jéssica',
  'Natália',
  'Beatriz',
  'Isabela',
  'Eduarda',
  'João',
  'José',
  'Carlos',
  'Paulo',
  'Lucas',
  'Marcos',
  'Rafael',
  'Gustavo',
  'Felipe',
  'Rodrigo',
  'Diego',
  'Anderson',
  'Leandro',
  'Fábio',
  'Marcelo',
  'Ricardo',
  'Adriano',
  'Sérgio',
  'Luiz',
  'Antônio',
  'Gabriel',
  'Mateus',
  'Vinícius',
  'Thiago',
  'Eduardo',
];

export const SOBRENOMES = [
  'Silva',
  'Santos',
  'Oliveira',
  'Souza',
  'Rodrigues',
  'Ferreira',
  'Alves',
  'Pereira',
  'Lima',
  'Gomes',
  'Costa',
  'Ribeiro',
  'Martins',
  'Carvalho',
  'Almeida',
  'Lopes',
  'Soares',
  'Fernandes',
  'Vieira',
  'Barbosa',
  'Rocha',
  'Dias',
  'Nascimento',
  'Andrade',
  'Moreira',
  'Nunes',
  'Marques',
  'Machado',
  'Mendes',
  'Freitas',
  'Cardoso',
  'Ramos',
  'Teixeira',
  'Kowalski',
  'Schmidt',
  'Muller',
  'Bortolini',
  'Zanella',
  'Pagliosa',
  'Wisniewski',
];

/** Ruas por bairro, com o centro aproximado de cada bairro (lat, lng). */
export const RUAS_POR_BAIRRO: Record<string, { ruas: string[]; lat: number; lng: number }> = {
  Centro: {
    ruas: [
      'Avenida Brasil',
      'Rua Marechal Floriano Peixoto',
      'Rua Santos Dumont',
      'Avenida Getúlio Vargas',
      'Rua Rui Barbosa',
      'Rua Tiradentes',
      'Rua Sete de Setembro',
    ],
    lat: -24.8886,
    lng: -52.2094,
  },
  'Jardim Panorama': {
    ruas: ['Rua Paraná', 'Rua Santa Catarina', 'Rua Rio Grande do Sul', 'Rua Goiás'],
    lat: -24.8832,
    lng: -52.2021,
  },
  'Vila Nova': {
    ruas: ['Rua das Acácias', 'Rua das Palmeiras', 'Rua dos Ipês', 'Rua das Hortênsias'],
    lat: -24.8848,
    lng: -52.2144,
  },
  'Jardim Independência': {
    ruas: ['Rua Dom Pedro I', 'Rua José Bonifácio', 'Rua Princesa Isabel', 'Rua Duque de Caxias'],
    lat: -24.8935,
    lng: -52.2051,
  },
  'São Cristóvão': {
    ruas: ['Rua São Cristóvão', 'Rua São José', 'Rua Santo Antônio', 'Rua São Pedro'],
    lat: -24.8921,
    lng: -52.2152,
  },
  Cohapar: {
    ruas: ['Rua Ipê Amarelo', 'Rua Ipê Roxo', 'Rua Jacarandá', 'Rua Cerejeira'],
    lat: -24.8797,
    lng: -52.2109,
  },
  'Vila Rural': {
    ruas: ['Estrada da Vila Rural', 'Linha Palmeirinha', 'Estrada do Barreiro'],
    lat: -24.8712,
    lng: -52.2263,
  },
};

export const PONTOS_DE_REFERENCIA = [
  'Casa de portão verde',
  'Ao lado da igreja',
  'Em frente ao campo de futebol',
  'Casa de esquina com muro branco',
  'Fundos da borracharia',
  'Perto da escola municipal',
  'Sobrado amarelo',
  'Depois da padaria',
  'Casa com pé de manga na frente',
  'Portão de madeira, tocar a campainha',
  'Em frente ao posto de saúde',
  'Kitnet dos fundos',
];

// ---------------------------------------------------------------------------
// Textos de pedido e avaliação
// ---------------------------------------------------------------------------

export const OBSERVACOES = [
  'Sem cebola, por favor',
  'Caprichar no molho',
  'Trazer troco',
  'Tocar a campainha, o interfone não funciona',
  'Deixar com o porteiro',
  'Pode chamar no WhatsApp quando chegar',
  'Cuidado com o cachorro no portão',
  'Mandar guardanapos extras',
  'Bem passado',
  'Separar em sacolas diferentes',
  'Se não tiver, pode substituir por similar',
];

export const MOTIVOS_DE_CANCELAMENTO = [
  'Cliente desistiu do pedido',
  'Produto em falta no estoque',
  'Endereço fora da área de entrega',
  'Cliente não atendeu na entrega',
  'Pedido duplicado',
  'Loja fechou mais cedo',
];

export const MOTIVOS_DE_RECUSA = [
  'Loja sem entregador disponível no momento',
  'Muitos pedidos em andamento',
  'Item indisponível',
];

export const COMENTARIOS: Record<number, string[]> = {
  5: [
    'Chegou rapidinho e bem quentinho. Recomendo!',
    'Tudo certinho, entregador muito educado.',
    'Melhor da cidade, sempre peço aqui.',
    'Produtos fresquinhos e bem embalados.',
    'Atendimento nota 10, chegou antes do previsto.',
    'Muito bom! Já virou rotina aqui em casa.',
    'Lanche caprichado e saboroso.',
    'Separaram tudo direitinho, até substituíram o que faltou com a mesma marca.',
  ],
  4: [
    'Muito bom, só demorou um pouco mais que o previsto.',
    'Gostei, mas a batata chegou meio mole.',
    'Bom custo-benefício.',
    'Tudo certo, só faltou o guardanapo.',
    'Comida boa, embalagem poderia ser melhor.',
  ],
  3: [
    'Razoável. Demorou bastante.',
    'Veio faltando um item, mas resolveram.',
    'Esperava mais pelo preço.',
  ],
  2: ['Chegou frio.', 'Demorou mais de uma hora.', 'Pedido veio trocado.'],
  1: ['Muito atrasado e veio errado.', 'Não recomendo, ninguém atendeu no telefone.'],
};

export const RESPOSTAS_DA_LOJA = [
  'Obrigado pela preferência! Volte sempre.',
  'Que bom que gostou! Estamos sempre à disposição.',
  'Pedimos desculpas pelo atraso, já estamos ajustando nossa equipe de entrega.',
  'Obrigado pelo retorno, vamos melhorar a embalagem.',
  'Sentimos muito pelo ocorrido. Entre em contato pelo WhatsApp que vamos resolver.',
];
