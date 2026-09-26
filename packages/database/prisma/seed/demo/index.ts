import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { config as loadEnv } from 'dotenv';
import { PrismaClient, type Prisma } from '../../../generated/client';
import { slugify } from '@rapidinho/shared';
import {
  CARDAPIO_ACAI,
  CARDAPIO_AGUA_GAS,
  CARDAPIO_HAMBURGUERIA,
  CARDAPIO_LANCHONETE,
  CARDAPIO_PETSHOP,
  CARDAPIO_PIZZARIA,
  CARDAPIO_RESTAURANTE,
  CATALOGO_ACOUGUE,
  CATALOGO_FARMACIA,
  CATALOGO_MERCEARIA,
  CATALOGO_SUPERMERCADO,
  COMENTARIOS,
  COMPLEMENTOS,
  LOJAS,
  MOTIVOS_DE_CANCELAMENTO,
  MOTIVOS_DE_RECUSA,
  NOMES,
  OBSERVACOES,
  PIZZA,
  PONTOS_DE_REFERENCIA,
  RESPOSTAS_DA_LOJA,
  RUAS_POR_BAIRRO,
  SOBRENOMES,
  type Catalogo,
  type Horario,
  type LojaDemo,
  type SecaoDemo,
} from './dados';

loadEnv({ path: path.resolve(__dirname, '../../../../../.env'), quiet: true });

/**
 * Seed de DEMONSTRAÇÃO para Palmital/PR.
 *
 *   pnpm db:seed:demo            → remove a demonstração anterior e cria de novo
 *   pnpm db:seed:demo --remover  → só remove
 *
 * Gera lojas, cardápios, clientes, entregadores e ~6 mil pedidos em 120 dias
 * com histórico, pagamentos, entregas e avaliações — volume para testar
 * vitrine, busca, painel do lojista, relatórios e painel da plataforma.
 *
 * Tudo é fictício e MARCADO: usuários e lojas têm e-mail em
 * `@demo.rapidinho.invalid`. É por essa marca que a remoção acha o que apagar,
 * sem tocar em nenhum dado real.
 *
 * Telefones na faixa (44) 90xxx-xxxx: passam na validação do app, mas a Anatel
 * não atribui números começando em 9-0 a celulares. Assim nenhum número da
 * demonstração é de uma pessoa real — que, se fosse, entraria na conta falsa
 * ao fazer login com o próprio telefone.
 *
 * Determinístico: a mesma semente gera os mesmos dados (exceto as datas, que
 * andam com o dia de hoje).
 */

const prisma = new PrismaClient();

const DOMINIO = 'demo.rapidinho.invalid';
const DIAS_DE_HISTORICO = 120;
const TOTAL_DE_PEDIDOS = 6000;
const TOTAL_DE_CLIENTES = 480;
const TOTAL_DE_ENTREGADORES = 14;
/** Brasília não tem horário de verão desde 2019: UTC-3 o ano inteiro. */
const FUSO_MS = 3 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Aleatoriedade reproduzível
// ---------------------------------------------------------------------------

function mulberry32(semente: number) {
  let estado = semente;
  return () => {
    estado = (estado + 0x6d2b79f5) | 0;
    let t = estado;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const aleatorio = mulberry32(20260926);
const entre = (min: number, max: number) => Math.floor(aleatorio() * (max - min + 1)) + min;
const chance = (probabilidade: number) => aleatorio() < probabilidade;
function um<T>(lista: readonly T[]): T {
  const item = lista[Math.floor(aleatorio() * lista.length)];
  if (item === undefined) throw new Error('lista vazia');
  return item;
}
function ponderado<T>(itens: readonly T[], peso: (item: T) => number): T {
  const total = itens.reduce((soma, item) => soma + peso(item), 0);
  let sorteio = aleatorio() * total;
  for (const item of itens) {
    sorteio -= peso(item);
    if (sorteio <= 0) return item;
  }
  return itens[itens.length - 1] as T;
}
/** Soma de dois uniformes: concentra no meio, como o pico de um horário. */
const triangular = (min: number, max: number) =>
  min + ((aleatorio() + aleatorio()) / 2) * (max - min);

const minutos = (ms: number) => ms * 60_000;

// ---------------------------------------------------------------------------
// Horários
// ---------------------------------------------------------------------------

/** Janelas por dia da semana (0 = domingo), em minutos desde a meia-noite local. */
type Janelas = Record<number, [number, number][]>;

const h = (hora: number, minuto = 0) => hora * 60 + minuto;
const todosOsDias = (janelas: [number, number][]): Janelas =>
  Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((dia) => [dia, janelas]));

const HORARIOS: Record<Horario, Janelas> = {
  comercial: { ...todosOsDias([[h(8), h(19)]]), 0: [[h(8), h(12)]] },
  mercado: { ...todosOsDias([[h(7, 30), h(21)]]), 0: [[h(8), h(13)]] },
  farmacia: { ...todosOsDias([[h(7, 30), h(22)]]), 0: [[h(8), h(20)]] },
  jantar: {
    0: [[h(18), h(23, 30)]],
    1: [],
    2: [[h(18), h(23, 30)]],
    3: [[h(18), h(23, 30)]],
    4: [[h(18), h(23, 30)]],
    // Sexta e sábado viram o dia: fecham 0h30 (1470 minutos).
    5: [[h(18), h(24, 30)]],
    6: [[h(18), h(24, 30)]],
  },
  almoco: { ...todosOsDias([[h(10, 30), h(14, 30)]]), 0: [[h(11), h(14)]] },
  lanches: { ...todosOsDias([[h(7), h(19)]]), 0: [] },
  tarde: todosOsDias([[h(13), h(22)]]),
};

/** Minuto local de um pedido, puxado para os horários de pico de cada tipo. */
function minutoDoPedido(horario: Horario, janela: [number, number]): number {
  const [abre, fecha] = janela;
  const picos: Partial<Record<Horario, [number, number]>> = {
    jantar: [h(19), h(21, 30)],
    almoco: [h(11), h(13)],
    tarde: [h(15), h(21)],
  };
  const pico = picos[horario];
  if (pico && chance(0.75)) return Math.round(triangular(pico[0], pico[1]));
  return Math.round(abre + aleatorio() * (fecha - abre - 20));
}

// ---------------------------------------------------------------------------
// Catálogos
// ---------------------------------------------------------------------------

const CATALOGOS: Record<Catalogo, SecaoDemo[]> = {
  supermercado: CATALOGO_SUPERMERCADO,
  mercearia: CATALOGO_MERCEARIA,
  acougue: CATALOGO_ACOUGUE,
  farmacia: CATALOGO_FARMACIA,
  pizzaria: CARDAPIO_PIZZARIA,
  hamburgueria: CARDAPIO_HAMBURGUERIA,
  lanchonete: CARDAPIO_LANCHONETE,
  acai: CARDAPIO_ACAI,
  restaurante: CARDAPIO_RESTAURANTE,
  petshop: CARDAPIO_PETSHOP,
  'agua-e-gas': CARDAPIO_AGUA_GAS,
};

/** Preço "de gôndola": ajustado pelo fator da loja e terminado em 90/99. */
function precoDaLoja(base: number, fator: number): number {
  const bruto = Math.round((base * fator) / 10) * 10;
  return Math.max(100, bruto - (bruto % 100) + (bruto >= 1000 ? 90 : 99));
}

// ---------------------------------------------------------------------------
// Tipos internos
// ---------------------------------------------------------------------------

interface ProdutoCriado {
  id: string;
  nome: string;
  precoCents: number;
  porKg: boolean;
  secao: string;
  grupos: GrupoCriado[];
}

interface GrupoCriado {
  nome: string;
  obrigatorio: boolean;
  max: number;
  opcoes: { id: string; nome: string; precoCents: number }[];
}

interface PizzaCriada {
  tamanhos: { id: string; nome: string; maxSabores: number; indice: number }[];
  sabores: { id: string; nome: string; precos: number[] }[];
  bordas: { id: string; nome: string; precoCents: number }[];
}

interface LojaCriada {
  id: string;
  demo: LojaDemo;
  janelas: Janelas;
  produtos: ProdutoCriado[];
  pizza?: PizzaCriada;
  comissao: number;
  zonas: Map<string, number>;
  cupom?: { id: string; tipo: 'PERCENTAGE' | 'FIXED_AMOUNT'; valor: number; minimo: number };
  /** Qualidade da loja, de 3,6 a 4,9: puxa as notas das avaliações. */
  qualidade: number;
  entraEm: Date;
}

interface ClienteCriado {
  id: string;
  nome: string;
  telefone: string;
  frequencia: number;
  criadoEm: Date;
  enderecos: {
    id: string;
    rua: string;
    numero: string;
    bairro: string;
    referencia: string;
  }[];
}

// ---------------------------------------------------------------------------
// Remoção
// ---------------------------------------------------------------------------

async function removerDemonstracao() {
  const marca = { endsWith: `@${DOMINIO}` };

  const lojas = await prisma.store.findMany({ where: { email: marca }, select: { id: true } });
  const idsDasLojas = lojas.map((loja) => loja.id);

  // Pedido não cai em cascata com a loja: sai primeiro, levando itens,
  // histórico, pagamento, entrega, avaliações e resgates de cupom.
  const pedidos = await prisma.order.deleteMany({ where: { storeId: { in: idsDasLojas } } });
  const removidas = await prisma.store.deleteMany({ where: { id: { in: idsDasLojas } } });
  const usuarios = await prisma.user.deleteMany({ where: { email: marca } });

  console.warn(
    `› Demonstração removida: ${removidas.count} lojas, ${pedidos.count} pedidos e ${usuarios.count} usuários.`,
  );
}

// ---------------------------------------------------------------------------
// Criação
// ---------------------------------------------------------------------------

function telefone(faixa: number, indice: number): string {
  // +55 44 9 0FFF-NNNN: faixa em 3 dígitos, índice em 4.
  return `+55449${String(faixa).padStart(4, '0')}${String(indice).padStart(4, '0')}`;
}

function nomeCompleto(): string {
  const sobrenomes = chance(0.6) ? `${um(SOBRENOMES)} ${um(SOBRENOMES)}` : um(SOBRENOMES);
  return `${um(NOMES)} ${sobrenomes}`;
}

async function criarLojas(
  cityId: string,
  categorias: Map<string, string>,
  planos: Map<string, { id: string; comissao: number }>,
  bairros: { id: string; nome: string }[],
  inicio: Date,
): Promise<LojaCriada[]> {
  const criadas: LojaCriada[] = [];

  for (const [indice, demo] of LOJAS.entries()) {
    const slug = slugify(demo.nome);
    const existente = await prisma.store.findUnique({ where: { slug }, select: { id: true } });
    if (existente) {
      console.warn(`  ! "${demo.nome}" já existe fora da demonstração; pulando.`);
      continue;
    }

    const coordenadas = RUAS_POR_BAIRRO[demo.bairro] ?? RUAS_POR_BAIRRO.Centro!;
    const plano = planos.get(demo.plano) ?? planos.get('gratis')!;
    // Quatro lojas entraram há pouco: a vitrine tem gente nova, e os
    // relatórios mostram crescimento em vez de uma linha reta.
    const recente = indice % 8 === 7 && !demo.pendente;
    const entraEm = new Date(
      inicio.getTime() +
        (recente ? (DIAS_DE_HISTORICO - entre(15, 35)) * 86_400_000 : -entre(5, 40) * 86_400_000),
    );

    const dono = await prisma.user.create({
      data: {
        phone: telefone(100, indice + 1),
        phoneVerified: entraEm,
        email: `dono.${slug}@${DOMINIO}`,
        name: nomeCompleto(),
        role: 'STORE_OWNER',
        acceptedTermsAt: entraEm,
        acceptedPrivacyAt: entraEm,
        createdAt: entraEm,
      },
    });

    const loja = await prisma.store.create({
      data: {
        name: demo.nome,
        slug,
        description: demo.descricao,
        segment: demo.segmento,
        status: demo.pendente ? 'PENDING_APPROVAL' : 'ACTIVE',
        cityId,
        categoryId: categorias.get(demo.categoria) ?? null,
        // CNPJ fictício, só com formato válido.
        document: `9${String(indice + 1).padStart(7, '0')}000100`,
        documentType: 'CNPJ',
        legalName: `${demo.nome} Ltda.`,
        phone: telefone(110, indice + 1),
        whatsapp: telefone(110, indice + 1),
        email: `${slug}@${DOMINIO}`,
        street: demo.rua,
        number: demo.numero,
        neighborhood: demo.bairro,
        referencePoint: demo.referencia ?? null,
        latitude: coordenadas.lat + (aleatorio() - 0.5) * 0.004,
        longitude: coordenadas.lng + (aleatorio() - 0.5) * 0.004,
        deliveryFeeMode: demo.frete,
        deliveryFeeCents: demo.freteCents,
        freeDeliveryAboveCents: demo.segmento === 'MARKET' && chance(0.5) ? 15000 : null,
        minOrderCents: demo.minimoCents,
        avgPrepTimeMinutes: demo.preparoMin,
        avgDeliveryTimeMinutes: entre(15, 25),
        acceptsPickup: demo.catalogo !== 'agua-e-gas',
        acceptsPix: true,
        acceptsCashOnDelivery: true,
        acceptsCardOnDelivery: true,
        pixKey: `${slug}@${DOMINIO}`,
        pizzaPricingRule: 'HIGHEST_PRICE',
        autoAcceptOrders: demo.catalogo === 'agua-e-gas',
        approvedAt: demo.pendente ? null : entraEm,
        createdAt: entraEm,
        staff: { create: { userId: dono.id, role: 'OWNER' } },
        subscription: {
          create: {
            planId: plano.id,
            currentPeriodStart: new Date(Date.now() - entre(1, 25) * 86_400_000),
            currentPeriodEnd: new Date(Date.now() + entre(5, 29) * 86_400_000),
          },
        },
      },
    });

    // --- Horários ---------------------------------------------------------
    const janelas = HORARIOS[demo.horario];
    await prisma.storeHour.createMany({
      data: Object.entries(janelas).flatMap(([dia, faixas]) =>
        faixas.map(([abre, fecha]) => ({
          storeId: loja.id,
          weekday: Number(dia),
          opensAt: abre,
          closesAt: fecha,
        })),
      ),
    });

    // --- Zonas de entrega (frete por bairro) ------------------------------
    const zonas = new Map<string, number>();
    if (demo.frete === 'BY_ZONE') {
      const dados = bairros.map((bairro, posicao) => {
        const taxa =
          bairro.nome === demo.bairro ? demo.freteCents - 200 : demo.freteCents + posicao * 100;
        zonas.set(bairro.nome, taxa);
        return {
          storeId: loja.id,
          neighborhoodId: bairro.id,
          name: bairro.nome,
          feeCents: taxa,
          estimatedMinutes: 20 + posicao * 5,
        };
      });
      await prisma.deliveryZone.createMany({ data: dados });
    }

    // --- Complementos -----------------------------------------------------
    const grupos: (GrupoCriado & { secoes: string[] })[] = [];
    for (const [ordem, grupo] of (COMPLEMENTOS[demo.categoria] ?? []).entries()) {
      const criado = await prisma.complementGroup.create({
        data: {
          storeId: loja.id,
          name: grupo.nome,
          isRequired: grupo.obrigatorio,
          minChoices: grupo.min,
          maxChoices: grupo.max,
          options: {
            create: grupo.opcoes.map(([nome, preco], posicao) => ({
              name: nome,
              priceCents: preco,
              sortOrder: posicao + ordem * 100,
            })),
          },
        },
        include: { options: { orderBy: { sortOrder: 'asc' } } },
      });
      grupos.push({
        nome: grupo.nome,
        obrigatorio: grupo.obrigatorio,
        max: grupo.max,
        secoes: grupo.secoes,
        opcoes: criado.options.map((opcao) => ({
          id: opcao.id,
          nome: opcao.name,
          precoCents: opcao.priceCents,
        })),
      });
    }

    // --- Cardápio ---------------------------------------------------------
    // Cada loja da mesma categoria tem um sortimento um pouco diferente.
    const produtos: ProdutoCriado[] = [];
    const linhasDeProduto: Prisma.ProductCreateManyInput[] = [];
    const vinculos: Prisma.ProductComplementGroupCreateManyInput[] = [];

    for (const [ordemSecao, secao] of CATALOGOS[demo.catalogo].entries()) {
      const categoria = await prisma.menuCategory.create({
        data: { storeId: loja.id, name: secao.nome, sortOrder: ordemSecao },
      });
      const gruposDaSecao = grupos.filter((grupo) => grupo.secoes.includes(secao.nome));
      const idsDosGrupos = await prisma.complementGroup.findMany({
        where: { storeId: loja.id, name: { in: gruposDaSecao.map((grupo) => grupo.nome) } },
        select: { id: true, name: true },
      });

      for (const [ordem, produto] of secao.produtos.entries()) {
        if (secao.produtos.length > 6 && chance(0.12)) continue;

        const id = randomUUID();
        const preco = precoDaLoja(produto.precoCents, demo.fatorPreco);
        linhasDeProduto.push({
          id,
          storeId: loja.id,
          categoryId: categoria.id,
          name: produto.nome,
          description: produto.descricao ?? null,
          priceCents: preco,
          // Promoção em alguns itens: "de R$ X por R$ Y".
          compareAtPriceCents: chance(0.07) ? Math.round(preco * 1.2) : null,
          sellingUnit: produto.porKg ? 'WEIGHT_KG' : 'UNIT',
          weightStepGrams: produto.porKg ? 100 : null,
          minWeightGrams: produto.porKg ? 200 : null,
          // Um ou outro item esgotado, como na vida real.
          isAvailable: !chance(0.03),
          isFeatured: chance(0.08),
          sortOrder: ordem,
          createdAt: entraEm,
        });

        for (const [posicao, grupo] of idsDosGrupos.entries()) {
          vinculos.push({ productId: id, groupId: grupo.id, sortOrder: posicao });
        }

        produtos.push({
          id,
          nome: produto.nome,
          precoCents: preco,
          porKg: Boolean(produto.porKg),
          secao: secao.nome,
          grupos: gruposDaSecao,
        });
      }
    }

    await prisma.product.createMany({ data: linhasDeProduto });
    if (vinculos.length > 0) await prisma.productComplementGroup.createMany({ data: vinculos });

    // --- Pizza ------------------------------------------------------------
    let pizza: PizzaCriada | undefined;
    if (demo.catalogo === 'pizzaria') {
      pizza = { tamanhos: [], sabores: [], bordas: [] };

      for (const [ordem, tamanho] of PIZZA.tamanhos.entries()) {
        const criado = await prisma.pizzaSize.create({
          data: {
            storeId: loja.id,
            name: tamanho.nome,
            maxFlavors: tamanho.maxSabores,
            slices: tamanho.fatias,
            sortOrder: ordem,
          },
        });
        pizza.tamanhos.push({
          id: criado.id,
          nome: tamanho.nome,
          maxSabores: tamanho.maxSabores,
          indice: ordem,
        });
      }

      for (const [ordem, sabor] of PIZZA.sabores.entries()) {
        const precos = sabor.precos.map((preco) => precoDaLoja(preco, demo.fatorPreco));
        const criado = await prisma.pizzaFlavor.create({
          data: {
            storeId: loja.id,
            name: sabor.nome,
            description: sabor.descricao,
            groupName: sabor.grupo,
            sortOrder: ordem,
            prices: {
              create: pizza.tamanhos.map((tamanho) => ({
                sizeId: tamanho.id,
                priceCents: precos[tamanho.indice] ?? precos[0]!,
              })),
            },
          },
        });
        pizza.sabores.push({ id: criado.id, nome: sabor.nome, precos });
      }

      for (const [ordem, borda] of PIZZA.bordas.entries()) {
        const criada = await prisma.pizzaExtra.create({
          data: {
            storeId: loja.id,
            name: borda.nome,
            kind: borda.tipo,
            priceCents: borda.precoCents,
            sortOrder: ordem,
          },
        });
        pizza.bordas.push({ id: criada.id, nome: borda.nome, precoCents: borda.precoCents });
      }
    }

    // --- Cupom da loja ----------------------------------------------------
    let cupom: LojaCriada['cupom'];
    if (!demo.pendente && demo.plano !== 'gratis' && chance(0.7)) {
      const percentual = chance(0.5);
      const valor = percentual ? um([10, 15]) : um([500, 1000]);
      const minimo = percentual ? 4000 : 5000;
      const criado = await prisma.coupon.create({
        data: {
          code:
            slug.replace(/-/g, '').slice(0, 8).toUpperCase() + (percentual ? valor : valor / 100),
          description: percentual ? `${valor}% de desconto` : `R$ ${valor / 100} de desconto`,
          scope: 'STORE',
          storeId: loja.id,
          discountType: percentual ? 'PERCENTAGE' : 'FIXED_AMOUNT',
          discountValue: valor,
          maxDiscountCents: percentual ? 2000 : null,
          minOrderCents: minimo,
          usagePerUser: 2,
          startsAt: entraEm,
        },
      });
      cupom = { id: criado.id, tipo: percentual ? 'PERCENTAGE' : 'FIXED_AMOUNT', valor, minimo };
    }

    criadas.push({
      id: loja.id,
      demo,
      janelas,
      produtos,
      ...(pizza ? { pizza } : {}),
      comissao: plano.comissao,
      zonas,
      ...(cupom ? { cupom } : {}),
      qualidade: 3.6 + aleatorio() * 1.3,
      entraEm,
    });
  }

  return criadas;
}

async function criarClientes(
  cityId: string,
  bairros: { id: string; nome: string }[],
  inicio: Date,
) {
  const clientes: ClienteCriado[] = [];
  const usuarios: Prisma.UserCreateManyInput[] = [];
  const enderecos: Prisma.AddressCreateManyInput[] = [];

  for (let indice = 1; indice <= TOTAL_DE_CLIENTES; indice += 1) {
    const id = randomUUID();
    const nome = indice === 1 ? 'Cliente Demonstração' : nomeCompleto();
    const criadoEm = new Date(
      inicio.getTime() + (aleatorio() * 0.85 - 0.1) * DIAS_DE_HISTORICO * 86_400_000,
    );
    const tel = telefone(200, indice);

    usuarios.push({
      id,
      phone: tel,
      phoneVerified: criadoEm,
      email: `cliente${indice}@${DOMINIO}`,
      name: nome,
      role: 'CUSTOMER',
      acceptedTermsAt: criadoEm,
      acceptedPrivacyAt: criadoEm,
      marketingOptIn: chance(0.4),
      lastLoginAt: new Date(Date.now() - entre(0, 20) * 86_400_000),
      createdAt: criadoEm,
    });

    const quantos = chance(0.25) ? 2 : 1;
    const doCliente: ClienteCriado['enderecos'] = [];
    for (let e = 0; e < quantos; e += 1) {
      // A maioria mora nos bairros populosos; a Vila Rural pesa pouco.
      const bairro = ponderado(bairros, (b) =>
        b.nome === 'Vila Rural' ? 1 : b.nome === 'Centro' ? 5 : 3,
      );
      const referencias = RUAS_POR_BAIRRO[bairro.nome] ?? RUAS_POR_BAIRRO.Centro!;
      const endereco = {
        id: randomUUID(),
        rua: um(referencias.ruas),
        numero: bairro.nome === 'Vila Rural' ? 's/n' : String(entre(10, 1900)),
        bairro: bairro.nome,
        referencia: um(PONTOS_DE_REFERENCIA),
      };
      doCliente.push(endereco);
      enderecos.push({
        id: endereco.id,
        userId: id,
        cityId,
        label: e === 0 ? 'Casa' : um(['Trabalho', 'Casa da mãe', 'Sítio']),
        street: endereco.rua,
        number: endereco.numero === 's/n' ? null : endereco.numero,
        neighborhood: bairro.nome,
        neighborhoodId: bairro.id,
        referencePoint: endereco.referencia,
        latitude: referencias.lat + (aleatorio() - 0.5) * 0.008,
        longitude: referencias.lng + (aleatorio() - 0.5) * 0.008,
        isDefault: e === 0,
        createdAt: criadoEm,
      });
    }

    // Poucos clientes fazem muitos pedidos; muitos fazem poucos.
    const frequencia = indice === 1 ? 40 : Math.pow(aleatorio(), 2.2) * 12 + 0.3;
    clientes.push({ id, nome, telefone: tel, frequencia, criadoEm, enderecos: doCliente });
  }

  await prisma.user.createMany({ data: usuarios });
  await prisma.address.createMany({ data: enderecos });
  return clientes;
}

async function criarEntregadores(cityId: string, inicio: Date) {
  const entregadores: { id: string; userId: string }[] = [];

  for (let indice = 1; indice <= TOTAL_DE_ENTREGADORES; indice += 1) {
    const criadoEm = new Date(inicio.getTime() - entre(1, 30) * 86_400_000);
    const usuario = await prisma.user.create({
      data: {
        phone: telefone(300, indice),
        phoneVerified: criadoEm,
        email: `entregador${indice}@${DOMINIO}`,
        name: indice === 1 ? 'Entregador Demonstração' : nomeCompleto(),
        role: 'COURIER',
        acceptedTermsAt: criadoEm,
        acceptedPrivacyAt: criadoEm,
        createdAt: criadoEm,
      },
    });
    const pendente = indice > TOTAL_DE_ENTREGADORES - 2;
    const entregador = await prisma.courier.create({
      data: {
        userId: usuario.id,
        cityId,
        type: 'PLATFORM',
        status: pendente ? 'PENDING_APPROVAL' : 'ACTIVE',
        document: `900${String(indice).padStart(8, '0')}`,
        vehicleType: indice % 5 === 0 ? 'BICYCLE' : 'MOTORCYCLE',
        vehiclePlate: indice % 5 === 0 ? null : `DMO${indice}A${String(indice).padStart(2, '0')}`,
        pixKey: `entregador${indice}@${DOMINIO}`,
        isOnline: !pendente && chance(0.5),
        approvedAt: pendente ? null : criadoEm,
        createdAt: criadoEm,
      },
    });
    if (!pendente) entregadores.push({ id: entregador.id, userId: usuario.id });
  }

  return entregadores;
}

// ---------------------------------------------------------------------------
// Pedidos
// ---------------------------------------------------------------------------

type StatusDoPedido = Prisma.OrderCreateManyInput['status'];

interface Lotes {
  pedidos: Prisma.OrderCreateManyInput[];
  itens: Prisma.OrderItemCreateManyInput[];
  complementos: Prisma.OrderItemComplementCreateManyInput[];
  sabores: Prisma.OrderItemPizzaFlavorCreateManyInput[];
  historico: Prisma.OrderStatusHistoryCreateManyInput[];
  pagamentos: Prisma.PaymentCreateManyInput[];
  entregas: Prisma.DeliveryCreateManyInput[];
  avaliacoes: Prisma.ReviewCreateManyInput[];
  resgates: Prisma.CouponRedemptionCreateManyInput[];
}

function montarItens(loja: LojaCriada, pedidoId: string, lotes: Lotes) {
  let subtotal = 0;
  const disponiveis = loja.produtos;
  const segmento = loja.demo.segmento;
  const gas = loja.demo.catalogo === 'agua-e-gas';
  // Itens distintos por pedido, pela experiência de cada tipo de loja.
  const linhasPorCatalogo: Partial<Record<Catalogo, [number, number]>> = {
    supermercado: [3, 10],
    mercearia: [2, 6],
    acougue: [1, 3],
    farmacia: [1, 4],
    petshop: [1, 3],
  };
  const [minimoDeLinhas, maximoDeLinhas] = linhasPorCatalogo[loja.demo.catalogo] ?? [1, 3];
  const quantidadeDeLinhas = gas ? (chance(0.85) ? 1 : 2) : entre(minimoDeLinhas, maximoDeLinhas);

  // Pizzaria: primeiro as pizzas, depois bebida e porção.
  if (loja.pizza) {
    const pizzas = chance(0.3) ? 2 : 1;
    for (let n = 0; n < pizzas; n += 1) {
      const tamanho = ponderado(loja.pizza.tamanhos, (t) => [1, 3, 5, 2][t.indice] ?? 1);
      const quantosSabores = entre(1, tamanho.maxSabores);
      const escolhidos = Array.from({ length: quantosSabores }, () =>
        ponderado(loja.pizza!.sabores, (s) =>
          ['Calabresa', 'Mussarela', 'Frango com catupiry', 'Portuguesa'].includes(s.nome) ? 4 : 1,
        ),
      );
      const precos = escolhidos.map((sabor) => sabor.precos[tamanho.indice] ?? sabor.precos[0]!);
      const borda = chance(0.35) ? um(loja.pizza.bordas) : null;
      const unitario = Math.max(...precos) + (borda?.precoCents ?? 0);
      const itemId = randomUUID();
      lotes.itens.push({
        id: itemId,
        orderId: pedidoId,
        productName: `Pizza ${tamanho.nome}`,
        productType: 'PIZZA',
        quantity: 1,
        unitPriceCents: unitario,
        totalCents: unitario,
        pizzaSizeId: tamanho.id,
        pizzaSizeName: tamanho.nome,
        pizzaExtraId: borda?.id ?? null,
        pizzaExtraName: borda?.nome ?? null,
        pizzaExtraPriceCents: borda?.precoCents ?? null,
      });
      escolhidos.forEach((sabor, posicao) =>
        lotes.sabores.push({
          orderItemId: itemId,
          flavorId: sabor.id,
          flavorName: sabor.nome,
          priceCents: precos[posicao]!,
        }),
      );
      subtotal += unitario;
    }
  }

  const linhas = loja.pizza ? (chance(0.7) ? 1 : 0) : quantidadeDeLinhas;
  const usados = new Set<string>();

  for (let n = 0; n < linhas; n += 1) {
    const produto = loja.pizza
      ? um(disponiveis.filter((p) => p.secao === 'Bebidas'))
      : gas
        ? // Quase todo pedido é um P13 ou um galão na troca; o P45 é de comércio.
          ponderado(disponiveis, (p) =>
            p.nome.includes('P13 (troca)')
              ? 8
              : p.nome.includes('20 L (troca)')
                ? 6
                : p.nome.includes('P45')
                  ? 0.2
                  : 1,
          )
        : um(disponiveis);
    if (!produto || usados.has(produto.id)) continue;
    usados.add(produto.id);

    const itemId = randomUUID();
    let quantidade = 1;
    let gramas: number | null = null;
    let unitario = produto.precoCents;

    if (produto.porKg) {
      gramas = entre(3, 12) * 100;
      unitario = Math.round((produto.precoCents * gramas) / 1000);
    } else {
      quantidade =
        segmento === 'MARKET'
          ? ponderado([1, 2, 3, 4, 6], (q) => [8, 5, 2, 1, 1][[1, 2, 3, 4, 6].indexOf(q)]!)
          : chance(0.25)
            ? 2
            : 1;
    }

    // Complementos: o obrigatório sempre, os opcionais às vezes.
    let adicional = 0;
    for (const grupo of produto.grupos) {
      const escolhas = grupo.obrigatorio ? 1 : chance(0.45) ? entre(1, Math.min(3, grupo.max)) : 0;
      const opcoes = [...grupo.opcoes].sort(() => aleatorio() - 0.5).slice(0, escolhas);
      for (const opcao of opcoes) {
        adicional += opcao.precoCents;
        lotes.complementos.push({
          orderItemId: itemId,
          optionId: opcao.id,
          groupName: grupo.nome,
          optionName: opcao.nome,
          priceCents: opcao.precoCents,
        });
      }
    }

    unitario += adicional;
    const total = unitario * quantidade;
    lotes.itens.push({
      id: itemId,
      orderId: pedidoId,
      productId: produto.id,
      productName: produto.nome,
      quantity: quantidade,
      weightGrams: gramas,
      unitPriceCents: unitario,
      totalCents: total,
      notes: chance(0.06) ? um(OBSERVACOES) : null,
    });
    subtotal += total;
  }

  return subtotal;
}

/** Linha do tempo de um pedido a partir do status final. */
function linhaDoTempo(
  criadoEm: Date,
  statusFinal: NonNullable<StatusDoPedido>,
  loja: LojaCriada,
  entrega: boolean,
) {
  const t = criadoEm.getTime();
  const aceito = new Date(t + minutos(entre(1, 6)));
  const preparando = new Date(aceito.getTime() + minutos(entre(1, 4)));
  const pronto = new Date(
    preparando.getTime() + minutos(Math.max(5, loja.demo.preparoMin + entre(-10, 15))),
  );
  const saiu = new Date(pronto.getTime() + minutos(entre(2, 12)));
  const entregue = new Date(
    (entrega ? saiu : pronto).getTime() + minutos(entrega ? entre(8, 30) : entre(5, 25)),
  );

  const passos: { status: NonNullable<StatusDoPedido>; em: Date }[] = [
    { status: 'RECEIVED', em: criadoEm },
  ];
  const ordem: NonNullable<StatusDoPedido>[] = entrega
    ? ['ACCEPTED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED']
    : ['ACCEPTED', 'PREPARING', 'READY', 'DELIVERED'];
  const datas: Record<string, Date> = {
    ACCEPTED: aceito,
    PREPARING: preparando,
    READY: pronto,
    OUT_FOR_DELIVERY: saiu,
    DELIVERED: entregue,
  };

  if (statusFinal === 'REJECTED') {
    passos.push({ status: 'REJECTED', em: aceito });
    return { passos, datas };
  }
  if (statusFinal === 'CANCELLED') {
    const ate = entre(0, 2);
    for (const status of ordem.slice(0, ate)) passos.push({ status, em: datas[status]! });
    passos.push({
      status: 'CANCELLED',
      em: new Date((datas[ordem[ate]!] ?? aceito).getTime() + minutos(entre(1, 8))),
    });
    return { passos, datas };
  }

  for (const status of ordem) {
    passos.push({ status, em: datas[status]! });
    if (status === statusFinal) break;
  }
  return { passos, datas };
}

async function criarPedidos(
  cityId: string,
  lojas: LojaCriada[],
  clientes: ClienteCriado[],
  entregadores: { id: string; userId: string }[],
  inicio: Date,
) {
  const lotes: Lotes = {
    pedidos: [],
    itens: [],
    complementos: [],
    sabores: [],
    historico: [],
    pagamentos: [],
    entregas: [],
    avaliacoes: [],
    resgates: [],
  };

  const ativas = lojas.filter((loja) => !loja.demo.pendente && loja.demo.peso > 0);
  const numerosEmUso = new Set(
    (await prisma.order.findMany({ select: { number: true } })).map((pedido) => pedido.number),
  );
  const agora = Date.now();
  let emAndamento = 0;

  const gerarNumero = (data: Date) => {
    const local = new Date(data.getTime() - FUSO_MS);
    const prefixo = `${String(local.getUTCDate()).padStart(2, '0')}${String(local.getUTCMonth() + 1).padStart(2, '0')}`;
    for (;;) {
      const numero = `${prefixo}${String(entre(0, 9999)).padStart(4, '0')}`;
      if (!numerosEmUso.has(numero)) {
        numerosEmUso.add(numero);
        return numero;
      }
    }
  };

  let gerados = 0;
  let tentativas = 0;
  while (gerados < TOTAL_DE_PEDIDOS && tentativas < TOTAL_DE_PEDIDOS * 20) {
    tentativas += 1;
    const loja = ponderado(ativas, (l) => l.demo.peso);

    // Dia: a plataforma cresce, então os dias recentes pesam mais.
    const fracao = Math.pow(aleatorio(), 0.65);
    const dia = Math.floor(fracao * DIAS_DE_HISTORICO);
    const diaLocal = new Date(inicio.getTime() - FUSO_MS + dia * 86_400_000);
    diaLocal.setUTCHours(0, 0, 0, 0);
    const semana = diaLocal.getUTCDay();
    // Fim de semana mais movimentado para comida.
    if (loja.demo.segmento === 'RESTAURANT' && (semana === 1 || semana === 2) && chance(0.35))
      continue;

    const janelas = loja.janelas[semana] ?? [];
    if (janelas.length === 0) continue;
    const minuto = minutoDoPedido(loja.demo.horario, um(janelas));
    const criadoEm = new Date(diaLocal.getTime() + minutos(minuto) + FUSO_MS);
    if (criadoEm.getTime() > agora - minutos(90) || criadoEm < loja.entraEm) continue;

    const cliente = ponderado(clientes, (c) => (c.criadoEm <= criadoEm ? c.frequencia : 0));
    if (cliente.criadoEm > criadoEm) continue;

    const status: NonNullable<StatusDoPedido> = chance(0.9)
      ? 'DELIVERED'
      : chance(0.75)
        ? 'CANCELLED'
        : 'REJECTED';
    registrarPedido({ loja, cliente, criadoEm, status });
    gerados += 1;
  }

  // Alguns pedidos acontecendo AGORA, para a tela de pedidos do lojista e o
  // app do entregador terem o que mostrar.
  const emCurso: NonNullable<StatusDoPedido>[] = [
    'RECEIVED',
    'RECEIVED',
    'ACCEPTED',
    'PREPARING',
    'PREPARING',
    'READY',
    'OUT_FOR_DELIVERY',
    'OUT_FOR_DELIVERY',
  ];
  for (const [posicao, status] of [...emCurso, ...emCurso].entries()) {
    const loja = ativas[posicao % ativas.length]!;
    const cliente = posicao === 0 ? clientes[0]! : um(clientes);
    registrarPedido({
      loja,
      cliente,
      criadoEm: new Date(agora - minutos(entre(3, 55))),
      status,
    });
    emAndamento += 1;
  }

  function registrarPedido({
    loja,
    cliente,
    criadoEm,
    status,
  }: {
    loja: LojaCriada;
    cliente: ClienteCriado;
    criadoEm: Date;
    status: NonNullable<StatusDoPedido>;
  }) {
    const pedidoId = randomUUID();
    // "Saiu para entrega" não existe na retirada no balcão.
    const retirada =
      loja.demo.catalogo !== 'agua-e-gas' && status !== 'OUT_FOR_DELIVERY' && chance(0.08);
    const endereco = um(cliente.enderecos);
    const subtotal = montarItens(loja, pedidoId, lotes);

    let frete = 0;
    if (!retirada) {
      if (loja.demo.frete === 'FIXED') frete = loja.demo.freteCents;
      if (loja.demo.frete === 'BY_ZONE')
        frete = loja.zonas.get(endereco.bairro) ?? loja.demo.freteCents;
    }

    let desconto = 0;
    let cupomId: string | null = null;
    if (loja.cupom && subtotal >= loja.cupom.minimo && chance(0.12)) {
      desconto =
        loja.cupom.tipo === 'PERCENTAGE'
          ? Math.min(2000, Math.round((subtotal * loja.cupom.valor) / 100))
          : loja.cupom.valor;
      cupomId = loja.cupom.id;
    }

    const total = subtotal + frete - desconto;
    const comissao = Math.round(((subtotal - desconto) * loja.comissao) / 100);
    const { passos, datas } = linhaDoTempo(criadoEm, status, loja, !retirada);
    // Pedido de poucos minutos atrás: as etapas previstas cairiam no futuro.
    // Comprime-as até agora, mantendo a ordem.
    passos.forEach((passo, posicao) => {
      const teto = agora - minutos(passos.length - posicao);
      if (passo.em.getTime() > teto) {
        passo.em = new Date(Math.max(criadoEm.getTime(), teto));
        datas[passo.status] = passo.em;
      }
    });
    const final = passos[passos.length - 1]!;
    const chegou = status === 'DELIVERED';
    const cancelado = status === 'CANCELLED' || status === 'REJECTED';
    const atingiu = (etapa: NonNullable<StatusDoPedido>) =>
      passos.some((passo) => passo.status === etapa);

    lotes.pedidos.push({
      id: pedidoId,
      number: gerarNumero(criadoEm),
      cityId,
      storeId: loja.id,
      userId: cliente.id,
      type: retirada ? 'PICKUP' : 'DELIVERY',
      status,
      customerName: cliente.nome,
      customerPhone: cliente.telefone,
      addressId: retirada ? null : endereco.id,
      addressSnapshot: retirada
        ? undefined
        : {
            street: endereco.rua,
            number: endereco.numero === 's/n' ? null : endereco.numero,
            complement: null,
            neighborhood: endereco.bairro,
            referencePoint: endereco.referencia,
            zipCode: null,
          },
      subtotalCents: subtotal,
      deliveryFeeCents: frete,
      discountCents: desconto,
      totalCents: total,
      commissionCents: comissao,
      commissionRate: loja.comissao,
      couponId: cupomId,
      notes: chance(0.15) ? um(OBSERVACOES) : null,
      estimatedPrepMinutes: loja.demo.preparoMin,
      estimatedReadyAt: new Date(criadoEm.getTime() + minutos(loja.demo.preparoMin)),
      acceptedAt: atingiu('ACCEPTED') ? datas.ACCEPTED! : null,
      preparingAt: atingiu('PREPARING') ? datas.PREPARING! : null,
      readyAt: atingiu('READY') ? datas.READY! : null,
      dispatchedAt: atingiu('OUT_FOR_DELIVERY') ? datas.OUT_FOR_DELIVERY! : null,
      deliveredAt: chegou ? datas.DELIVERED! : null,
      cancelledAt: cancelado ? final.em : null,
      cancelReason:
        status === 'CANCELLED'
          ? um(MOTIVOS_DE_CANCELAMENTO)
          : status === 'REJECTED'
            ? um(MOTIVOS_DE_RECUSA)
            : null,
      cancelledBy:
        status === 'CANCELLED' ? um(['CUSTOMER', 'STORE']) : status === 'REJECTED' ? 'STORE' : null,
      createdAt: criadoEm,
      updatedAt: final.em,
    });

    for (const passo of passos) {
      lotes.historico.push({ orderId: pedidoId, status: passo.status, createdAt: passo.em });
    }

    // --- Pagamento --------------------------------------------------------
    const metodo = ponderado(
      ['PIX', 'CARD_ON_DELIVERY', 'CASH_ON_DELIVERY'] as const,
      (m) => ({ PIX: 48, CARD_ON_DELIVERY: 32, CASH_ON_DELIVERY: 20 })[m],
    );
    const online = metodo === 'PIX';
    lotes.pagamentos.push({
      orderId: pedidoId,
      method: metodo,
      status: chegou
        ? 'PAID'
        : cancelado
          ? online
            ? 'REFUNDED'
            : 'CANCELLED'
          : online
            ? 'PAID'
            : 'ON_DELIVERY',
      provider: online ? 'FAKE' : 'OFFLINE',
      amountCents: total,
      changeForCents:
        metodo === 'CASH_ON_DELIVERY' && chance(0.6) ? Math.ceil(total / 5000) * 5000 : null,
      externalId: online ? `demo-${pedidoId.slice(0, 8)}` : null,
      platformFeeCents: comissao,
      paidAt: online ? new Date(criadoEm.getTime() + minutos(1)) : chegou ? datas.DELIVERED! : null,
      refundedAt: cancelado && online ? final.em : null,
      createdAt: criadoEm,
      updatedAt: final.em,
    });

    if (cupomId) {
      lotes.resgates.push({
        couponId: cupomId,
        userId: cliente.id,
        orderId: pedidoId,
        discountCents: desconto,
        createdAt: criadoEm,
      });
    }

    // --- Entrega ----------------------------------------------------------
    let entregadorId: string | null = null;
    if (!retirada && atingiu('READY') && entregadores.length > 0) {
      entregadorId = um(entregadores).id;
      lotes.entregas.push({
        orderId: pedidoId,
        courierId: entregadorId,
        status: chegou
          ? 'DELIVERED'
          : atingiu('OUT_FOR_DELIVERY')
            ? 'PICKED_UP'
            : cancelado
              ? 'CANCELLED'
              : 'ASSIGNED',
        earningCents: Math.max(500, Math.round(frete * 0.8)),
        distanceMeters: entre(400, endereco.bairro === 'Vila Rural' ? 7000 : 3500),
        assignedAt: datas.READY!,
        acceptedAt: new Date(datas.READY!.getTime() + minutos(1)),
        pickedUpAt: atingiu('OUT_FOR_DELIVERY') ? datas.OUT_FOR_DELIVERY! : null,
        deliveredAt: chegou ? datas.DELIVERED! : null,
        cancelledAt: cancelado ? final.em : null,
        createdAt: datas.READY!,
      });
    }

    // --- Avaliações -------------------------------------------------------
    if (chegou && chance(0.42)) {
      const nota = Math.max(1, Math.min(5, Math.round(loja.qualidade + (aleatorio() - 0.5) * 2.2)));
      const avaliadoEm = new Date(datas.DELIVERED!.getTime() + minutos(entre(10, 600)));
      const responde = chance(nota <= 3 ? 0.7 : 0.25);
      lotes.avaliacoes.push({
        orderId: pedidoId,
        userId: cliente.id,
        storeId: loja.id,
        rating: nota,
        comment: chance(0.6) ? um(COMENTARIOS[nota] ?? COMENTARIOS[5]!) : null,
        replyText: responde ? um(RESPOSTAS_DA_LOJA) : null,
        repliedAt: responde ? new Date(avaliadoEm.getTime() + minutos(entre(30, 1440))) : null,
        createdAt: avaliadoEm,
      });

      if (entregadorId && chance(0.4)) {
        lotes.avaliacoes.push({
          orderId: pedidoId,
          userId: cliente.id,
          courierId: entregadorId,
          rating: chance(0.85) ? 5 : entre(3, 4),
          createdAt: avaliadoEm,
        });
      }
    }
  }

  // --- Gravação em lotes ----------------------------------------------------
  const gravar = async <T>(nome: string, linhas: T[], fn: (lote: T[]) => Promise<unknown>) => {
    for (let i = 0; i < linhas.length; i += 1000) await fn(linhas.slice(i, i + 1000));
    console.warn(`    ${nome}: ${linhas.length}`);
  };

  lotes.pedidos.sort((a, b) => (a.createdAt as Date).getTime() - (b.createdAt as Date).getTime());
  await gravar('pedidos', lotes.pedidos, (lote) => prisma.order.createMany({ data: lote }));
  await gravar('itens', lotes.itens, (lote) => prisma.orderItem.createMany({ data: lote }));
  await gravar('complementos', lotes.complementos, (lote) =>
    prisma.orderItemComplement.createMany({ data: lote }),
  );
  await gravar('sabores de pizza', lotes.sabores, (lote) =>
    prisma.orderItemPizzaFlavor.createMany({ data: lote }),
  );
  await gravar('histórico de status', lotes.historico, (lote) =>
    prisma.orderStatusHistory.createMany({ data: lote }),
  );
  await gravar('pagamentos', lotes.pagamentos, (lote) => prisma.payment.createMany({ data: lote }));
  await gravar('entregas', lotes.entregas, (lote) => prisma.delivery.createMany({ data: lote }));
  await gravar('avaliações', lotes.avaliacoes, (lote) => prisma.review.createMany({ data: lote }));
  await gravar('cupons usados', lotes.resgates, (lote) =>
    prisma.couponRedemption.createMany({ data: lote }),
  );

  return { pedidos: lotes.pedidos.length, emAndamento };
}

// ---------------------------------------------------------------------------
// Métricas e destaques
// ---------------------------------------------------------------------------

/** Recalcula as métricas cacheadas, como o job de produção faria. */
async function atualizarMetricas(idsDasLojas: string[]) {
  await prisma.$executeRaw`
    UPDATE stores s SET
      "orderCount" = COALESCE((SELECT COUNT(*) FROM orders o WHERE o."storeId" = s.id AND o.status = 'DELIVERED'), 0),
      "ratingCount" = COALESCE((SELECT COUNT(*) FROM reviews r WHERE r."storeId" = s.id), 0),
      "ratingAverage" = COALESCE((SELECT ROUND(AVG(r.rating)::numeric, 2) FROM reviews r WHERE r."storeId" = s.id), 0)
    WHERE s.id = ANY(${idsDasLojas})`;

  await prisma.$executeRaw`
    UPDATE products p SET "soldCount" = COALESCE((
      SELECT SUM(i.quantity) FROM order_items i JOIN orders o ON o.id = i."orderId"
      WHERE i."productId" = p.id AND o.status = 'DELIVERED'), 0)
    WHERE p."storeId" = ANY(${idsDasLojas})`;

  await prisma.$executeRaw`
    UPDATE couriers c SET
      "deliveryCount" = COALESCE((SELECT COUNT(*) FROM deliveries d WHERE d."courierId" = c.id AND d.status = 'DELIVERED'), 0),
      "ratingCount" = COALESCE((SELECT COUNT(*) FROM reviews r WHERE r."courierId" = c.id), 0),
      "ratingAverage" = COALESCE((SELECT ROUND(AVG(r.rating)::numeric, 2) FROM reviews r WHERE r."courierId" = c.id), 0)
    WHERE c."userId" IN (SELECT id FROM users WHERE email LIKE ${`%@${DOMINIO}`})`;

  await prisma.$executeRaw`
    UPDATE coupons c SET "usageCount" = (SELECT COUNT(*) FROM coupon_redemptions r WHERE r."couponId" = c.id)
    WHERE c."storeId" = ANY(${idsDasLojas})`;
}

/** Três lojas com destaque pago ativo, para a vitrine mostrar "patrocinado". */
async function criarDestaques(lojas: LojaCriada[]) {
  const pacote = await prisma.boostPackage.findFirst({ where: { placement: 'HOME_HIGHLIGHT' } });
  if (!pacote) return 0;

  const escolhidas = lojas
    .filter((loja) => !loja.demo.pendente && loja.demo.plano !== 'gratis')
    .slice(0, 3);
  const agora = Date.now();
  await prisma.storeBoost.createMany({
    data: escolhidas.map((loja) => ({
      storeId: loja.id,
      packageId: pacote.id,
      status: 'ACTIVE' as const,
      startsAt: new Date(agora - 2 * 86_400_000),
      endsAt: new Date(agora + 5 * 86_400_000),
      paidCents: pacote.priceCents,
      impressions: entre(800, 3000),
      clicks: entre(60, 250),
      conversions: entre(8, 40),
    })),
  });
  return escolhidas.length;
}

// ---------------------------------------------------------------------------

async function main() {
  const soRemover = process.argv.includes('--remover');

  if (process.env.NODE_ENV === 'production' && process.env.DEMO_CONFIRMAR !== 'sim') {
    throw new Error(
      'Em produção a demonstração publica lojas fictícias no site. ' +
        'Para rodar mesmo assim, defina DEMO_CONFIRMAR=sim.',
    );
  }

  await removerDemonstracao();
  if (soRemover) return;

  const cidade = await prisma.city.findUnique({ where: { slug: 'palmital-pr' } });
  if (!cidade) throw new Error('Palmital não existe na base. Rode antes o seed essencial.');

  const categorias = new Map(
    (await prisma.storeCategory.findMany({ select: { id: true, slug: true } })).map((c) => [
      c.slug,
      c.id,
    ]),
  );
  const planos = new Map(
    (await prisma.plan.findMany({ select: { id: true, slug: true, commissionRate: true } })).map(
      (plano) => [plano.slug, { id: plano.id, comissao: Number(plano.commissionRate) }],
    ),
  );
  const bairros = (
    await prisma.neighborhood.findMany({ where: { cityId: cidade.id }, orderBy: { name: 'asc' } })
  ).map((bairro) => ({ id: bairro.id, nome: bairro.name }));

  const inicio = new Date(Date.now() - DIAS_DE_HISTORICO * 86_400_000);

  console.warn('› Criando lojas, cardápios e horários…');
  const lojas = await criarLojas(cidade.id, categorias, planos, bairros, inicio);

  console.warn('› Criando clientes e endereços…');
  const clientes = await criarClientes(cidade.id, bairros, inicio);

  console.warn('› Criando entregadores…');
  const entregadores = await criarEntregadores(cidade.id, inicio);

  console.warn(`› Gerando pedidos dos últimos ${DIAS_DE_HISTORICO} dias…`);
  const { pedidos, emAndamento } = await criarPedidos(
    cidade.id,
    lojas,
    clientes,
    entregadores,
    inicio,
  );

  console.warn('› Recalculando notas, vendas e destaques…');
  await atualizarMetricas(lojas.map((loja) => loja.id));
  const destaques = await criarDestaques(lojas);

  const produtos = lojas.reduce((soma, loja) => soma + loja.produtos.length, 0);
  console.warn(
    `\n✔ Demonstração criada em ${cidade.name}/${cidade.state}: ${lojas.length} lojas, ` +
      `${produtos} produtos, ${clientes.length} clientes, ${entregadores.length} entregadores ativos, ` +
      `${pedidos} pedidos (${emAndamento} em andamento agora) e ${destaques} lojas em destaque.`,
  );
  console.warn('\n  Contas de teste (todas fictícias):');
  console.warn('    Cliente com histórico:   (44) 90200-0001');
  console.warn(`    Lojista (1ª loja):       (44) 90100-0001 — ${LOJAS[0]?.nome}`);
  console.warn('    Entregador:              (44) 90300-0001');
  console.warn('  Para remover tudo: pnpm db:seed:demo --remover\n');
}

main()
  .catch((erro) => {
    console.error('Falha no seed de demonstração:', erro);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
