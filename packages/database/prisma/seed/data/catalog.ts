/**
 * Dados de seed. São representativos do comércio de uma cidade de ~15 mil
 * habitantes: pouca loja, catálogo pequeno em restaurante e catálogo grande em
 * mercado. Preços em centavos.
 */

export const PALMITAL = {
  name: 'Palmital',
  slug: 'palmital-pr',
  state: 'PR',
  ibgeCode: '4118006',
  latitude: -24.8886,
  longitude: -52.2094,
  serviceRadiusMeters: 12000,
  defaultCommissionRate: 10,
  defaultDeliveryFeeCents: 500,
  defaultPricePerKmCents: 150,
};

export const NEIGHBORHOODS = [
  'Centro',
  'Jardim Panorama',
  'Vila Nova',
  'Jardim Independência',
  'São Cristóvão',
  'Cohapar',
  'Vila Rural',
];

export const STORE_CATEGORIES = [
  {
    name: 'Supermercado',
    slug: 'supermercado',
    segment: 'MARKET',
    iconName: 'shopping-cart',
    sortOrder: 1,
  },
  { name: 'Mercearia', slug: 'mercearia', segment: 'MARKET', iconName: 'store', sortOrder: 2 },
  { name: 'Açougue', slug: 'acougue', segment: 'MARKET', iconName: 'beef', sortOrder: 3 },
  { name: 'Farmácia', slug: 'farmacia', segment: 'PHARMACY', iconName: 'pill', sortOrder: 4 },
  { name: 'Pizzaria', slug: 'pizzaria', segment: 'RESTAURANT', iconName: 'pizza', sortOrder: 5 },
  {
    name: 'Hamburgueria',
    slug: 'hamburgueria',
    segment: 'RESTAURANT',
    iconName: 'sandwich',
    sortOrder: 6,
  },
  {
    name: 'Lanchonete',
    slug: 'lanchonete',
    segment: 'RESTAURANT',
    iconName: 'coffee',
    sortOrder: 7,
  },
  {
    name: 'Açaí e sorvetes',
    slug: 'acai-e-sorvetes',
    segment: 'RESTAURANT',
    iconName: 'ice-cream',
    sortOrder: 8,
  },
  {
    name: 'Restaurante',
    slug: 'restaurante',
    segment: 'RESTAURANT',
    iconName: 'utensils',
    sortOrder: 9,
  },
  // Já cadastradas para provar que categoria é dado, não código.
  { name: 'Petshop', slug: 'petshop', segment: 'OTHER', iconName: 'dog', sortOrder: 10 },
  { name: 'Água e gás', slug: 'agua-e-gas', segment: 'OTHER', iconName: 'flame', sortOrder: 11 },
];

export const PLANS = [
  {
    name: 'Grátis',
    slug: 'gratis',
    description: 'Para começar a vender online sem custo fixo.',
    monthlyPriceCents: 0,
    commissionRate: 12,
    maxProducts: 30,
    maxPhotos: 30,
    maxStaff: 1,
    features: {
      reports: false,
      coupons: false,
      boost: false,
      csvImport: false,
      ownCouriers: false,
    },
    trialDays: 0,
    isDefault: true,
    sortOrder: 1,
  },
  {
    name: 'Essencial',
    slug: 'essencial',
    description: 'Cardápio completo, cupons e relatórios.',
    monthlyPriceCents: 4990,
    commissionRate: 8,
    maxProducts: 300,
    maxPhotos: 300,
    maxStaff: 3,
    features: { reports: true, coupons: true, boost: true, csvImport: true, ownCouriers: false },
    trialDays: 14,
    sortOrder: 2,
  },
  {
    name: 'Mercado',
    slug: 'mercado',
    description: 'Catálogo ilimitado, importação de planilha e entregadores próprios.',
    monthlyPriceCents: 12990,
    commissionRate: 5,
    maxProducts: null,
    maxPhotos: null,
    maxStaff: null,
    features: { reports: true, coupons: true, boost: true, csvImport: true, ownCouriers: true },
    trialDays: 14,
    sortOrder: 3,
  },
];

export const BOOST_PACKAGES = [
  {
    name: 'Destaque na home — 7 dias',
    description: 'Sua loja entre as primeiras da página inicial.',
    placement: 'HOME_HIGHLIGHT',
    priceCents: 3990,
    durationDays: 7,
    priority: 100,
  },
  {
    name: 'Banner de topo — 7 dias',
    description: 'Banner no topo da home, acima das categorias.',
    placement: 'TOP_BANNER',
    priceCents: 8990,
    durationDays: 7,
    priority: 200,
  },
  {
    name: 'Destaque na categoria — 15 dias',
    description: 'Primeira posição dentro da sua categoria.',
    placement: 'CATEGORY_HIGHLIGHT',
    priceCents: 5990,
    durationDays: 15,
    priority: 80,
  },
];

interface SeedProduct {
  name: string;
  priceCents: number;
  description?: string;
  sellingUnit?: 'UNIT' | 'WEIGHT_KG';
  category: string;
}

export interface SeedStore {
  name: string;
  categorySlug: string;
  segment: 'MARKET' | 'PHARMACY' | 'RESTAURANT' | 'OTHER';
  description: string;
  documentType: 'CPF' | 'CNPJ';
  document: string;
  phone: string;
  street: string;
  number?: string;
  neighborhood: string;
  referencePoint?: string;
  latitude: number;
  longitude: number;
  deliveryFeeMode: 'FIXED' | 'BY_DISTANCE' | 'BY_ZONE' | 'FREE';
  deliveryFeeCents: number;
  minOrderCents: number;
  avgPrepTimeMinutes: number;
  planSlug: string;
  menu: { name: string; products: SeedProduct[] }[];
  pizza?: {
    sizes: { name: string; maxFlavors: number; slices: number }[];
    flavors: { name: string; description: string; prices: number[] }[];
    extras: { name: string; kind: 'CRUST' | 'EDGE'; priceCents: number }[];
  };
}

const marketMenu = [
  {
    name: 'Hortifrúti',
    products: [
      {
        name: 'Banana prata',
        priceCents: 599,
        sellingUnit: 'WEIGHT_KG' as const,
        category: 'Hortifrúti',
      },
      {
        name: 'Tomate',
        priceCents: 899,
        sellingUnit: 'WEIGHT_KG' as const,
        category: 'Hortifrúti',
      },
      {
        name: 'Batata inglesa',
        priceCents: 649,
        sellingUnit: 'WEIGHT_KG' as const,
        category: 'Hortifrúti',
      },
      {
        name: 'Cebola',
        priceCents: 549,
        sellingUnit: 'WEIGHT_KG' as const,
        category: 'Hortifrúti',
      },
      { name: 'Alface crespa (unidade)', priceCents: 399, category: 'Hortifrúti' },
    ],
  },
  {
    name: 'Açougue',
    products: [
      {
        name: 'Picanha bovina',
        priceCents: 8990,
        sellingUnit: 'WEIGHT_KG' as const,
        category: 'Açougue',
      },
      {
        name: 'Coxa e sobrecoxa de frango',
        priceCents: 1490,
        sellingUnit: 'WEIGHT_KG' as const,
        category: 'Açougue',
      },
      {
        name: 'Linguiça toscana',
        priceCents: 2490,
        sellingUnit: 'WEIGHT_KG' as const,
        category: 'Açougue',
      },
      {
        name: 'Carne moída de segunda',
        priceCents: 3290,
        sellingUnit: 'WEIGHT_KG' as const,
        category: 'Açougue',
      },
    ],
  },
  {
    name: 'Mercearia',
    products: [
      { name: 'Arroz branco 5 kg', priceCents: 2790, category: 'Mercearia' },
      { name: 'Feijão carioca 1 kg', priceCents: 899, category: 'Mercearia' },
      { name: 'Açúcar refinado 1 kg', priceCents: 449, category: 'Mercearia' },
      { name: 'Óleo de soja 900 ml', priceCents: 719, category: 'Mercearia' },
      { name: 'Café torrado e moído 500 g', priceCents: 1890, category: 'Mercearia' },
      { name: 'Macarrão espaguete 500 g', priceCents: 429, category: 'Mercearia' },
      { name: 'Sal refinado 1 kg', priceCents: 299, category: 'Mercearia' },
    ],
  },
  {
    name: 'Bebidas',
    products: [
      { name: 'Refrigerante cola 2 L', priceCents: 899, category: 'Bebidas' },
      { name: 'Cerveja lata 350 ml', priceCents: 419, category: 'Bebidas' },
      { name: 'Água mineral 1,5 L', priceCents: 349, category: 'Bebidas' },
      { name: 'Suco de uva integral 1 L', priceCents: 1690, category: 'Bebidas' },
    ],
  },
  {
    name: 'Limpeza e higiene',
    products: [
      { name: 'Detergente neutro 500 ml', priceCents: 279, category: 'Limpeza e higiene' },
      { name: 'Sabão em pó 1 kg', priceCents: 1490, category: 'Limpeza e higiene' },
      { name: 'Papel higiênico 12 rolos', priceCents: 1990, category: 'Limpeza e higiene' },
      { name: 'Água sanitária 1 L', priceCents: 549, category: 'Limpeza e higiene' },
    ],
  },
];

const pharmacyMenu = [
  {
    name: 'Medicamentos sem receita',
    products: [
      {
        name: 'Dipirona 500 mg (10 comprimidos)',
        priceCents: 890,
        category: 'Medicamentos sem receita',
      },
      {
        name: 'Paracetamol 750 mg (20 comprimidos)',
        priceCents: 1290,
        category: 'Medicamentos sem receita',
      },
      {
        name: 'Ibuprofeno 400 mg (10 comprimidos)',
        priceCents: 1490,
        category: 'Medicamentos sem receita',
      },
      { name: 'Antiácido efervescente', priceCents: 990, category: 'Medicamentos sem receita' },
    ],
  },
  {
    name: 'Higiene pessoal',
    products: [
      { name: 'Creme dental 90 g', priceCents: 699, category: 'Higiene pessoal' },
      { name: 'Sabonete 90 g', priceCents: 349, category: 'Higiene pessoal' },
      { name: 'Shampoo 350 ml', priceCents: 1890, category: 'Higiene pessoal' },
      { name: 'Álcool em gel 500 ml', priceCents: 1290, category: 'Higiene pessoal' },
    ],
  },
  {
    name: 'Bebê',
    products: [
      { name: 'Fralda descartável M (30 unidades)', priceCents: 3990, category: 'Bebê' },
      { name: 'Lenço umedecido (48 unidades)', priceCents: 1190, category: 'Bebê' },
      { name: 'Pomada para assadura 45 g', priceCents: 2290, category: 'Bebê' },
    ],
  },
];

export const STORES: SeedStore[] = [
  // --- Mercados ------------------------------------------------------------
  {
    name: 'Supermercado Palmital',
    categorySlug: 'supermercado',
    segment: 'MARKET',
    description: 'O supermercado da família palmitalense há mais de 20 anos.',
    documentType: 'CNPJ',
    document: '11222333000181',
    phone: '+554442331001',
    street: 'Avenida Brasil',
    number: '820',
    neighborhood: 'Centro',
    referencePoint: 'Em frente à praça central',
    latitude: -24.8881,
    longitude: -52.2087,
    deliveryFeeMode: 'BY_ZONE',
    deliveryFeeCents: 600,
    minOrderCents: 3000,
    avgPrepTimeMinutes: 40,
    planSlug: 'mercado',
    menu: marketMenu,
  },
  {
    name: 'Mercado Bom Preço',
    categorySlug: 'supermercado',
    segment: 'MARKET',
    description: 'Preço baixo todo dia, do arroz ao material de limpeza.',
    documentType: 'CNPJ',
    document: '19131243000197',
    phone: '+554442331002',
    street: 'Rua Sete de Setembro',
    number: '145',
    neighborhood: 'Jardim Panorama',
    referencePoint: 'Ao lado do posto de saúde',
    latitude: -24.8925,
    longitude: -52.2131,
    deliveryFeeMode: 'FIXED',
    deliveryFeeCents: 500,
    minOrderCents: 2500,
    avgPrepTimeMinutes: 35,
    planSlug: 'essencial',
    menu: marketMenu.slice(0, 4),
  },
  {
    name: 'Mercearia da Esquina',
    categorySlug: 'mercearia',
    segment: 'MARKET',
    description: 'Aquele mercadinho de bairro que resolve o dia.',
    documentType: 'CPF',
    document: '52998224725',
    phone: '+554499812001',
    street: 'Rua das Flores',
    neighborhood: 'Vila Nova',
    referencePoint: 'Casa da esquina, perto da igreja',
    latitude: -24.8842,
    longitude: -52.2158,
    deliveryFeeMode: 'FIXED',
    deliveryFeeCents: 400,
    minOrderCents: 1500,
    avgPrepTimeMinutes: 20,
    planSlug: 'gratis',
    menu: [
      marketMenu[2] as (typeof marketMenu)[number],
      marketMenu[3] as (typeof marketMenu)[number],
    ],
  },

  // --- Farmácias -----------------------------------------------------------
  {
    name: 'Farmácia Saúde',
    categorySlug: 'farmacia',
    segment: 'PHARMACY',
    description: 'Medicamentos, higiene e atendimento farmacêutico.',
    documentType: 'CNPJ',
    document: '34028316000103',
    phone: '+554442332001',
    street: 'Avenida Brasil',
    number: '410',
    neighborhood: 'Centro',
    referencePoint: 'Esquina com a Rua XV',
    latitude: -24.8873,
    longitude: -52.2101,
    deliveryFeeMode: 'FIXED',
    deliveryFeeCents: 400,
    minOrderCents: 0,
    avgPrepTimeMinutes: 15,
    planSlug: 'essencial',
    menu: pharmacyMenu,
  },
  {
    name: 'Drogaria Vida',
    categorySlug: 'farmacia',
    segment: 'PHARMACY',
    description: 'Entrega rápida de medicamentos em toda a cidade.',
    documentType: 'CNPJ',
    document: '45997418000153',
    phone: '+554442332002',
    street: 'Rua Marechal Deodoro',
    number: '77',
    neighborhood: 'Centro',
    latitude: -24.8895,
    longitude: -52.2072,
    deliveryFeeMode: 'BY_DISTANCE',
    deliveryFeeCents: 400,
    minOrderCents: 0,
    avgPrepTimeMinutes: 15,
    planSlug: 'gratis',
    menu: pharmacyMenu.slice(0, 2),
  },

  // --- Restaurantes --------------------------------------------------------
  {
    name: 'Pizzaria Dois Irmãos',
    categorySlug: 'pizzaria',
    segment: 'RESTAURANT',
    description: 'Pizza em forno a lenha, massa fina e recheio generoso.',
    documentType: 'CNPJ',
    document: '27865757000102',
    phone: '+554499812002',
    street: 'Rua XV de Novembro',
    number: '256',
    neighborhood: 'Centro',
    referencePoint: 'Perto do mercado municipal',
    latitude: -24.8869,
    longitude: -52.2115,
    deliveryFeeMode: 'FIXED',
    deliveryFeeCents: 700,
    minOrderCents: 3000,
    avgPrepTimeMinutes: 45,
    planSlug: 'essencial',
    menu: [
      {
        name: 'Bebidas',
        products: [
          { name: 'Refrigerante 2 L', priceCents: 1200, category: 'Bebidas' },
          { name: 'Refrigerante lata', priceCents: 600, category: 'Bebidas' },
          { name: 'Suco natural de laranja 500 ml', priceCents: 900, category: 'Bebidas' },
        ],
      },
    ],
    pizza: {
      sizes: [
        { name: 'Broto', maxFlavors: 1, slices: 4 },
        { name: 'Média', maxFlavors: 2, slices: 6 },
        { name: 'Grande', maxFlavors: 3, slices: 8 },
        { name: 'Família', maxFlavors: 4, slices: 12 },
      ],
      flavors: [
        {
          name: 'Calabresa',
          description: 'Molho, mussarela, calabresa e cebola',
          prices: [2500, 3800, 4500, 5500],
        },
        {
          name: 'Mussarela',
          description: 'Molho, mussarela e orégano',
          prices: [2300, 3500, 4200, 5200],
        },
        {
          name: 'Portuguesa',
          description: 'Presunto, ovo, cebola, azeitona e mussarela',
          prices: [2800, 4200, 4900, 5900],
        },
        {
          name: 'Frango com catupiry',
          description: 'Frango desfiado e catupiry',
          prices: [2900, 4400, 5200, 6200],
        },
        {
          name: 'Quatro queijos',
          description: 'Mussarela, provolone, gorgonzola e parmesão',
          prices: [3100, 4600, 5400, 6400],
        },
        {
          name: 'Chocolate com morango',
          description: 'Chocolate ao leite e morango fatiado',
          prices: [2900, 4300, 5000, 6000],
        },
      ],
      extras: [
        { name: 'Sem borda', kind: 'EDGE', priceCents: 0 },
        { name: 'Borda de catupiry', kind: 'EDGE', priceCents: 800 },
        { name: 'Borda de cheddar', kind: 'EDGE', priceCents: 800 },
      ],
    },
  },
  {
    name: 'Burger do Zé',
    categorySlug: 'hamburgueria',
    segment: 'RESTAURANT',
    description: 'Hambúrguer artesanal, pão brioche e batata rústica.',
    documentType: 'CPF',
    document: '15350946056',
    phone: '+554499812003',
    street: 'Rua Rio Grande do Sul',
    number: '90',
    neighborhood: 'Jardim Independência',
    referencePoint: 'Depois da lombada, portão azul',
    latitude: -24.8912,
    longitude: -52.2054,
    deliveryFeeMode: 'FIXED',
    deliveryFeeCents: 600,
    minOrderCents: 2000,
    avgPrepTimeMinutes: 35,
    planSlug: 'essencial',
    menu: [
      {
        name: 'Hambúrgueres',
        products: [
          {
            name: 'X-Salada',
            priceCents: 2200,
            description: 'Pão, blend 150 g, queijo, alface e tomate',
            category: 'Hambúrgueres',
          },
          {
            name: 'X-Bacon',
            priceCents: 2600,
            description: 'Pão, blend 150 g, queijo e bacon crocante',
            category: 'Hambúrgueres',
          },
          {
            name: 'X-Tudo',
            priceCents: 3200,
            description: 'Blend, ovo, bacon, presunto, queijo e salada',
            category: 'Hambúrgueres',
          },
          {
            name: 'Smash duplo',
            priceCents: 2900,
            description: 'Dois smash de 90 g com cheddar',
            category: 'Hambúrgueres',
          },
        ],
      },
      {
        name: 'Acompanhamentos',
        products: [
          { name: 'Batata frita 300 g', priceCents: 1600, category: 'Acompanhamentos' },
          { name: 'Batata com cheddar e bacon', priceCents: 2400, category: 'Acompanhamentos' },
          { name: 'Onion rings', priceCents: 1800, category: 'Acompanhamentos' },
        ],
      },
      {
        name: 'Bebidas',
        products: [
          { name: 'Refrigerante lata', priceCents: 600, category: 'Bebidas' },
          { name: 'Água com gás', priceCents: 500, category: 'Bebidas' },
        ],
      },
    ],
  },
  {
    name: 'Lanchonete Central',
    categorySlug: 'lanchonete',
    segment: 'RESTAURANT',
    description: 'Salgados fresquinhos, café e o melhor pastel da cidade.',
    documentType: 'CPF',
    document: '11144477735',
    phone: '+554499812004',
    street: 'Praça da Matriz',
    number: '12',
    neighborhood: 'Centro',
    latitude: -24.8884,
    longitude: -52.2096,
    deliveryFeeMode: 'FIXED',
    deliveryFeeCents: 500,
    minOrderCents: 1500,
    avgPrepTimeMinutes: 25,
    planSlug: 'gratis',
    menu: [
      {
        name: 'Salgados',
        products: [
          { name: 'Coxinha de frango', priceCents: 700, category: 'Salgados' },
          { name: 'Pastel de carne', priceCents: 900, category: 'Salgados' },
          { name: 'Empada de palmito', priceCents: 800, category: 'Salgados' },
          { name: 'Enroladinho de salsicha', priceCents: 700, category: 'Salgados' },
        ],
      },
      {
        name: 'Bebidas quentes',
        products: [
          { name: 'Café expresso', priceCents: 500, category: 'Bebidas quentes' },
          { name: 'Pingado', priceCents: 600, category: 'Bebidas quentes' },
        ],
      },
    ],
  },
  {
    name: 'Açaí do Parque',
    categorySlug: 'acai-e-sorvetes',
    segment: 'RESTAURANT',
    description: 'Açaí cremoso com complementos à sua escolha.',
    documentType: 'CPF',
    document: '12345678909',
    phone: '+554499812005',
    street: 'Rua Paraná',
    number: '333',
    neighborhood: 'São Cristóvão',
    referencePoint: 'Em frente ao campo de futebol',
    latitude: -24.8931,
    longitude: -52.2108,
    deliveryFeeMode: 'FIXED',
    deliveryFeeCents: 500,
    minOrderCents: 1500,
    avgPrepTimeMinutes: 20,
    planSlug: 'essencial',
    menu: [
      {
        name: 'Açaí',
        products: [
          { name: 'Açaí 300 ml', priceCents: 1500, category: 'Açaí' },
          { name: 'Açaí 500 ml', priceCents: 2000, category: 'Açaí' },
          { name: 'Açaí 700 ml', priceCents: 2600, category: 'Açaí' },
        ],
      },
      {
        name: 'Sorvetes',
        products: [
          { name: 'Sorvete de massa (pote 1 L)', priceCents: 2400, category: 'Sorvetes' },
          { name: 'Milk-shake 400 ml', priceCents: 1800, category: 'Sorvetes' },
        ],
      },
    ],
  },
  {
    name: 'Restaurante Sabor Caseiro',
    categorySlug: 'restaurante',
    segment: 'RESTAURANT',
    description: 'Comida caseira, marmita e prato feito no capricho.',
    documentType: 'CNPJ',
    document: '07526557000100',
    phone: '+554442333001',
    street: 'Avenida Brasil',
    number: '1210',
    neighborhood: 'Centro',
    latitude: -24.8858,
    longitude: -52.2079,
    deliveryFeeMode: 'BY_DISTANCE',
    deliveryFeeCents: 500,
    minOrderCents: 2000,
    avgPrepTimeMinutes: 30,
    planSlug: 'essencial',
    menu: [
      {
        name: 'Marmitas',
        products: [
          {
            name: 'Marmita pequena',
            priceCents: 1800,
            description: 'Arroz, feijão, uma carne e salada',
            category: 'Marmitas',
          },
          {
            name: 'Marmita média',
            priceCents: 2200,
            description: 'Arroz, feijão, duas carnes, salada e farofa',
            category: 'Marmitas',
          },
          {
            name: 'Marmita grande',
            priceCents: 2600,
            description: 'Porção reforçada com acompanhamentos',
            category: 'Marmitas',
          },
        ],
      },
      {
        name: 'Pratos executivos',
        products: [
          { name: 'Filé de frango grelhado', priceCents: 2900, category: 'Pratos executivos' },
          { name: 'Bife acebolado', priceCents: 3200, category: 'Pratos executivos' },
          { name: 'Tilápia grelhada', priceCents: 3500, category: 'Pratos executivos' },
        ],
      },
    ],
  },
];

/** Grupos de complementos aplicados por segmento de loja. */
export const COMPLEMENT_GROUPS = {
  burger: {
    name: 'Adicionais',
    isRequired: false,
    minChoices: 0,
    maxChoices: 6,
    options: [
      { name: 'Bacon extra', priceCents: 500 },
      { name: 'Queijo extra', priceCents: 400 },
      { name: 'Ovo', priceCents: 300 },
      { name: 'Cebola caramelizada', priceCents: 300 },
      { name: 'Molho especial', priceCents: 200 },
    ],
  },
  burgerPoint: {
    name: 'Ponto da carne',
    isRequired: true,
    minChoices: 1,
    maxChoices: 1,
    options: [
      { name: 'Ao ponto', priceCents: 0 },
      { name: 'Bem passado', priceCents: 0 },
      { name: 'Mal passado', priceCents: 0 },
    ],
  },
  acai: {
    name: 'Complementos do açaí',
    isRequired: false,
    minChoices: 0,
    maxChoices: 5,
    options: [
      { name: 'Granola', priceCents: 200 },
      { name: 'Leite condensado', priceCents: 200 },
      { name: 'Banana', priceCents: 200 },
      { name: 'Morango', priceCents: 400 },
      { name: 'Paçoca', priceCents: 200 },
      { name: 'Leite em pó', priceCents: 300 },
    ],
  },
  marmita: {
    name: 'Escolha a carne',
    isRequired: true,
    minChoices: 1,
    maxChoices: 1,
    options: [
      { name: 'Frango grelhado', priceCents: 0 },
      { name: 'Bife acebolado', priceCents: 200 },
      { name: 'Carne de panela', priceCents: 200 },
      { name: 'Linguiça', priceCents: 0 },
    ],
  },
} as const;
