import path from 'node:path';
import { config as loadEnv } from 'dotenv';
import { PrismaClient, type Prisma } from '@prisma/client';
import { normalizePhoneBR, slugify } from '@rapidinho/shared';
import {
  BOOST_PACKAGES,
  COMPLEMENT_GROUPS,
  NEIGHBORHOODS,
  PALMITAL,
  PLANS,
  STORE_CATEGORIES,
  STORES,
} from './data/catalog';

loadEnv({ path: path.resolve(__dirname, '../../../../.env'), quiet: true });

const prisma = new PrismaClient();

/**
 * Seed de desenvolvimento.
 *
 * Idempotente: pode rodar quantas vezes quiser sem duplicar. Usa `upsert` em
 * tudo que tem chave natural, porque durante o desenvolvimento a base é
 * recriada o tempo todo e ninguém quer 40 lojas repetidas.
 */

/**
 * Normaliza pelo mesmo caminho do login por OTP.
 *
 * O seed precisa gravar o telefone no formato EXATO que `normalizePhoneBR`
 * produz; qualquer divergência faz o login criar um usuário novo em vez de
 * reconhecer o do seed. Falhar aqui é melhor que descobrir isso testando.
 */
function seedPhone(raw: string): string {
  const normalized = normalizePhoneBR(raw);
  if (!normalized) {
    throw new Error(`Telefone inválido no seed: ${raw}`);
  }
  return normalized;
}

/** Horário comercial padrão: seg-sáb 8h-20h, domingo 8h-13h. */
function defaultHours(storeId: string): Prisma.StoreHourCreateManyInput[] {
  const hours: Prisma.StoreHourCreateManyInput[] = [];

  for (let weekday = 1; weekday <= 6; weekday += 1) {
    hours.push({ storeId, weekday, opensAt: 8 * 60, closesAt: 20 * 60, isActive: true });
  }
  hours.push({ storeId, weekday: 0, opensAt: 8 * 60, closesAt: 13 * 60, isActive: true });

  return hours;
}

/** Restaurante abre à noite e fecha depois da meia-noite no fim de semana. */
function dinnerHours(storeId: string): Prisma.StoreHourCreateManyInput[] {
  const hours: Prisma.StoreHourCreateManyInput[] = [];

  for (let weekday = 2; weekday <= 4; weekday += 1) {
    hours.push({ storeId, weekday, opensAt: 18 * 60, closesAt: 23 * 60, isActive: true });
  }
  // Sexta e sábado viram o dia: fecham às 2h (1560 = 26h).
  hours.push({ storeId, weekday: 5, opensAt: 18 * 60, closesAt: 26 * 60, isActive: true });
  hours.push({ storeId, weekday: 6, opensAt: 18 * 60, closesAt: 26 * 60, isActive: true });
  hours.push({ storeId, weekday: 0, opensAt: 18 * 60, closesAt: 23 * 60, isActive: true });

  return hours;
}

async function seedCity() {
  const city = await prisma.city.upsert({
    where: { slug: PALMITAL.slug },
    update: { isActive: true },
    create: {
      name: PALMITAL.name,
      slug: PALMITAL.slug,
      state: PALMITAL.state,
      ibgeCode: PALMITAL.ibgeCode,
      isActive: true,
      latitude: PALMITAL.latitude,
      longitude: PALMITAL.longitude,
      serviceRadiusMeters: PALMITAL.serviceRadiusMeters,
      defaultCommissionRate: PALMITAL.defaultCommissionRate,
      defaultDeliveryFeeCents: PALMITAL.defaultDeliveryFeeCents,
      defaultPricePerKmCents: PALMITAL.defaultPricePerKmCents,
      launchedAt: new Date(),
    },
  });

  for (const name of NEIGHBORHOODS) {
    await prisma.neighborhood.upsert({
      where: { cityId_slug: { cityId: city.id, slug: slugify(name) } },
      update: {},
      create: { cityId: city.id, name, slug: slugify(name) },
    });
  }

  return city;
}

async function seedCategories() {
  const categories = new Map<string, string>();

  for (const category of STORE_CATEGORIES) {
    const record = await prisma.storeCategory.upsert({
      where: { slug: category.slug },
      update: { name: category.name, iconName: category.iconName, sortOrder: category.sortOrder },
      create: {
        name: category.name,
        slug: category.slug,
        segment: category.segment as never,
        iconName: category.iconName,
        sortOrder: category.sortOrder,
      },
    });
    categories.set(category.slug, record.id);
  }

  return categories;
}

async function seedPlans() {
  const plans = new Map<string, string>();

  for (const plan of PLANS) {
    const record = await prisma.plan.upsert({
      where: { slug: plan.slug },
      update: {
        monthlyPriceCents: plan.monthlyPriceCents,
        commissionRate: plan.commissionRate,
        features: plan.features,
      },
      create: {
        name: plan.name,
        slug: plan.slug,
        description: plan.description,
        monthlyPriceCents: plan.monthlyPriceCents,
        commissionRate: plan.commissionRate,
        maxProducts: plan.maxProducts,
        maxPhotos: plan.maxPhotos,
        maxStaff: plan.maxStaff,
        features: plan.features,
        trialDays: plan.trialDays,
        isDefault: plan.isDefault ?? false,
        sortOrder: plan.sortOrder,
      },
    });
    plans.set(plan.slug, record.id);
  }

  for (const boost of BOOST_PACKAGES) {
    const existing = await prisma.boostPackage.findFirst({ where: { name: boost.name } });
    if (!existing) {
      await prisma.boostPackage.create({
        data: {
          name: boost.name,
          description: boost.description,
          placement: boost.placement as never,
          priceCents: boost.priceCents,
          durationDays: boost.durationDays,
          priority: boost.priority,
        },
      });
    }
  }

  return plans;
}

async function seedPlatformUsers() {
  const superAdmin = await prisma.user.upsert({
    where: { phone: seedPhone('44 99999-0001') },
    update: { role: 'SUPER_ADMIN' },
    create: {
      phone: seedPhone('44 99999-0001'),
      phoneVerified: new Date(),
      email: 'admin@rapidinhoentrega.com.br',
      name: 'Administrador da Plataforma',
      role: 'SUPER_ADMIN',
      acceptedTermsAt: new Date(),
      acceptedPrivacyAt: new Date(),
    },
  });

  const customer = await prisma.user.upsert({
    where: { phone: seedPhone('44 99999-0002') },
    update: {},
    create: {
      phone: seedPhone('44 99999-0002'),
      phoneVerified: new Date(),
      name: 'Maria da Silva',
      role: 'CUSTOMER',
      acceptedTermsAt: new Date(),
      acceptedPrivacyAt: new Date(),
    },
  });

  return { superAdmin, customer };
}

async function seedCustomerAddress(customerId: string, cityId: string) {
  const existing = await prisma.address.findFirst({ where: { userId: customerId } });
  if (existing) return existing;

  const neighborhood = await prisma.neighborhood.findFirst({
    where: { cityId, slug: 'vila-nova' },
  });

  // Endereço sem CEP e sem número, com ponto de referência: o caso comum aqui.
  return prisma.address.create({
    data: {
      userId: customerId,
      cityId,
      label: 'Casa',
      street: 'Rua das Acácias',
      neighborhood: 'Vila Nova',
      neighborhoodId: neighborhood?.id ?? null,
      referencePoint: 'Casa de portão verde, depois da padaria',
      isDefault: true,
      latitude: -24.8848,
      longitude: -52.2144,
    },
  });
}

async function seedCouriers(cityId: string) {
  const couriers = [
    {
      phone: '44 99991-1001',
      name: 'João Entregador',
      document: '39053344705',
      vehicle: 'MOTORCYCLE',
    },
    {
      phone: '44 99991-1002',
      name: 'Pedro Motoboy',
      document: '01234567890',
      vehicle: 'MOTORCYCLE',
    },
  ] as const;

  for (const courier of couriers) {
    const user = await prisma.user.upsert({
      where: { phone: seedPhone(courier.phone) },
      update: { role: 'COURIER' },
      create: {
        phone: seedPhone(courier.phone),
        phoneVerified: new Date(),
        name: courier.name,
        role: 'COURIER',
        acceptedTermsAt: new Date(),
        acceptedPrivacyAt: new Date(),
      },
    });

    await prisma.courier.upsert({
      where: { userId: user.id },
      update: { status: 'ACTIVE' },
      create: {
        userId: user.id,
        cityId,
        type: 'PLATFORM',
        status: 'ACTIVE',
        document: courier.document,
        vehicleType: courier.vehicle,
        approvedAt: new Date(),
      },
    });
  }
}

async function seedComplementGroups(storeId: string, categorySlug: string) {
  const groups: { key: keyof typeof COMPLEMENT_GROUPS; appliesTo: string[] }[] = [];

  if (categorySlug === 'hamburgueria') {
    groups.push({ key: 'burgerPoint', appliesTo: ['Hambúrgueres'] });
    groups.push({ key: 'burger', appliesTo: ['Hambúrgueres'] });
  }
  if (categorySlug === 'acai-e-sorvetes') {
    groups.push({ key: 'acai', appliesTo: ['Açaí'] });
  }
  if (categorySlug === 'restaurante') {
    groups.push({ key: 'marmita', appliesTo: ['Marmitas'] });
  }

  const created: { groupId: string; appliesTo: string[] }[] = [];

  for (const { key, appliesTo } of groups) {
    const definition = COMPLEMENT_GROUPS[key];

    const existing = await prisma.complementGroup.findFirst({
      where: { storeId, name: definition.name },
    });

    const group =
      existing ??
      (await prisma.complementGroup.create({
        data: {
          storeId,
          name: definition.name,
          isRequired: definition.isRequired,
          minChoices: definition.minChoices,
          maxChoices: definition.maxChoices,
          options: {
            create: definition.options.map((option, index) => ({
              name: option.name,
              priceCents: option.priceCents,
              sortOrder: index,
            })),
          },
        },
      }));

    created.push({ groupId: group.id, appliesTo });
  }

  return created;
}

async function seedStores(
  cityId: string,
  categories: Map<string, string>,
  plans: Map<string, string>,
) {
  for (const [index, seed] of STORES.entries()) {
    const slug = slugify(seed.name);

    const store = await prisma.store.upsert({
      where: { slug },
      update: { status: 'ACTIVE' },
      create: {
        name: seed.name,
        slug,
        description: seed.description,
        segment: seed.segment,
        status: 'ACTIVE',
        cityId,
        categoryId: categories.get(seed.categorySlug) ?? null,
        document: seed.document,
        documentType: seed.documentType,
        phone: seedPhone(seed.phone),
        whatsapp: seedPhone(seed.phone),
        street: seed.street,
        number: seed.number ?? null,
        neighborhood: seed.neighborhood,
        referencePoint: seed.referencePoint ?? null,
        latitude: seed.latitude,
        longitude: seed.longitude,
        deliveryFeeMode: seed.deliveryFeeMode,
        deliveryFeeCents: seed.deliveryFeeCents,
        minOrderCents: seed.minOrderCents,
        avgPrepTimeMinutes: seed.avgPrepTimeMinutes,
        acceptsPix: true,
        acceptsCashOnDelivery: true,
        acceptsCardOnDelivery: true,
        pizzaPricingRule: 'HIGHEST_PRICE',
        approvedAt: new Date(),
      },
    });

    // --- Dono da loja -----------------------------------------------------
    const ownerPhone = seedPhone(`44 99000-${String(index).padStart(4, '0')}`);
    const owner = await prisma.user.upsert({
      where: { phone: ownerPhone },
      update: { role: 'STORE_OWNER' },
      create: {
        phone: ownerPhone,
        phoneVerified: new Date(),
        name: `Dono da ${seed.name}`,
        role: 'STORE_OWNER',
        acceptedTermsAt: new Date(),
        acceptedPrivacyAt: new Date(),
      },
    });

    await prisma.storeStaff.upsert({
      where: { storeId_userId: { storeId: store.id, userId: owner.id } },
      update: { role: 'OWNER', isActive: true },
      create: { storeId: store.id, userId: owner.id, role: 'OWNER' },
    });

    // --- Assinatura -------------------------------------------------------
    const planId = plans.get(seed.planSlug);
    if (planId) {
      const periodEnd = new Date();
      periodEnd.setMonth(periodEnd.getMonth() + 1);

      await prisma.storeSubscription.upsert({
        where: { storeId: store.id },
        update: { planId },
        create: { storeId: store.id, planId, currentPeriodEnd: periodEnd },
      });
    }

    // --- Horários ---------------------------------------------------------
    const existingHours = await prisma.storeHour.count({ where: { storeId: store.id } });
    if (existingHours === 0) {
      await prisma.storeHour.createMany({
        data:
          seed.segment === 'RESTAURANT' && seed.categorySlug !== 'lanchonete'
            ? dinnerHours(store.id)
            : defaultHours(store.id),
      });
    }

    // --- Zonas de entrega -------------------------------------------------
    if (seed.deliveryFeeMode === 'BY_ZONE') {
      const neighborhoods = await prisma.neighborhood.findMany({ where: { cityId } });

      for (const [zoneIndex, neighborhood] of neighborhoods.entries()) {
        const existingZone = await prisma.deliveryZone.findFirst({
          where: { storeId: store.id, neighborhoodId: neighborhood.id },
        });
        if (existingZone) continue;

        await prisma.deliveryZone.create({
          data: {
            storeId: store.id,
            neighborhoodId: neighborhood.id,
            name: neighborhood.name,
            // Centro mais barato; bairro mais afastado, mais caro.
            feeCents: 500 + zoneIndex * 100,
            estimatedMinutes: 20 + zoneIndex * 5,
          },
        });
      }
    }

    // --- Complementos -----------------------------------------------------
    const complementGroups = await seedComplementGroups(store.id, seed.categorySlug);

    // --- Cardápio ---------------------------------------------------------
    for (const [categoryIndex, menuCategory] of seed.menu.entries()) {
      const category = await prisma.menuCategory.upsert({
        where: { storeId_name: { storeId: store.id, name: menuCategory.name } },
        update: { sortOrder: categoryIndex },
        create: { storeId: store.id, name: menuCategory.name, sortOrder: categoryIndex },
      });

      for (const [productIndex, product] of menuCategory.products.entries()) {
        const existingProduct = await prisma.product.findFirst({
          where: { storeId: store.id, name: product.name },
        });
        if (existingProduct) continue;

        const created = await prisma.product.create({
          data: {
            storeId: store.id,
            categoryId: category.id,
            name: product.name,
            description: product.description ?? null,
            priceCents: product.priceCents,
            sellingUnit: product.sellingUnit ?? 'UNIT',
            weightStepGrams: product.sellingUnit === 'WEIGHT_KG' ? 100 : null,
            minWeightGrams: product.sellingUnit === 'WEIGHT_KG' ? 200 : null,
            sortOrder: productIndex,
          },
        });

        const applicable = complementGroups.filter((group) =>
          group.appliesTo.includes(menuCategory.name),
        );

        for (const [groupIndex, group] of applicable.entries()) {
          await prisma.productComplementGroup.create({
            data: { productId: created.id, groupId: group.groupId, sortOrder: groupIndex },
          });
        }
      }
    }

    // --- Pizza ------------------------------------------------------------
    if (seed.pizza) {
      const sizeIds: string[] = [];

      for (const [sizeIndex, size] of seed.pizza.sizes.entries()) {
        const record = await prisma.pizzaSize.upsert({
          where: { storeId_name: { storeId: store.id, name: size.name } },
          update: { maxFlavors: size.maxFlavors, sortOrder: sizeIndex },
          create: {
            storeId: store.id,
            name: size.name,
            maxFlavors: size.maxFlavors,
            slices: size.slices,
            sortOrder: sizeIndex,
          },
        });
        sizeIds.push(record.id);
      }

      for (const [flavorIndex, flavor] of seed.pizza.flavors.entries()) {
        const record = await prisma.pizzaFlavor.upsert({
          where: { storeId_name: { storeId: store.id, name: flavor.name } },
          update: { description: flavor.description, sortOrder: flavorIndex },
          create: {
            storeId: store.id,
            name: flavor.name,
            description: flavor.description,
            sortOrder: flavorIndex,
          },
        });

        for (const [priceIndex, priceCents] of flavor.prices.entries()) {
          const sizeId = sizeIds[priceIndex];
          if (!sizeId) continue;

          await prisma.pizzaFlavorPrice.upsert({
            where: { flavorId_sizeId: { flavorId: record.id, sizeId } },
            update: { priceCents },
            create: { flavorId: record.id, sizeId, priceCents },
          });
        }
      }

      for (const [extraIndex, extra] of seed.pizza.extras.entries()) {
        const existingExtra = await prisma.pizzaExtra.findFirst({
          where: { storeId: store.id, name: extra.name },
        });
        if (existingExtra) continue;

        await prisma.pizzaExtra.create({
          data: {
            storeId: store.id,
            name: extra.name,
            kind: extra.kind,
            priceCents: extra.priceCents,
            sortOrder: extraIndex,
          },
        });
      }
    }
  }
}

async function seedCoupons(cityId: string) {
  const existing = await prisma.coupon.findFirst({ where: { code: 'BEMVINDO' } });
  if (existing) return;

  await prisma.coupon.create({
    data: {
      code: 'BEMVINDO',
      description: 'R$ 10 de desconto no primeiro pedido',
      scope: 'PLATFORM',
      cityId,
      discountType: 'FIXED_AMOUNT',
      discountValue: 1000,
      minOrderCents: 3000,
      usagePerUser: 1,
      firstOrderOnly: true,
    },
  });

  await prisma.coupon.create({
    data: {
      code: 'FRETEGRATIS',
      description: 'Frete grátis acima de R$ 50',
      scope: 'PLATFORM',
      cityId,
      discountType: 'FREE_DELIVERY',
      discountValue: 0,
      minOrderCents: 5000,
      usagePerUser: 3,
    },
  });
}

async function main() {
  console.warn('› Semeando cidade e bairros…');
  const city = await seedCity();

  console.warn('› Semeando categorias de loja…');
  const categories = await seedCategories();

  console.warn('› Semeando planos e pacotes de impulsionamento…');
  const plans = await seedPlans();

  console.warn('› Semeando usuários da plataforma…');
  const { customer } = await seedPlatformUsers();
  await seedCustomerAddress(customer.id, city.id);

  console.warn('› Semeando entregadores…');
  await seedCouriers(city.id);

  console.warn('› Semeando lojas, cardápios e pizzas…');
  await seedStores(city.id, categories, plans);

  console.warn('› Semeando cupons…');
  await seedCoupons(city.id);

  const [stores, products, flavors] = await Promise.all([
    prisma.store.count(),
    prisma.product.count(),
    prisma.pizzaFlavor.count(),
  ]);

  console.warn(
    `\n✔ Seed concluído: ${stores} lojas, ${products} produtos e ${flavors} sabores de pizza em ${city.name}/${city.state}.`,
  );
  console.warn('  Super admin: (44) 99999-0001 | Cliente: (44) 99999-0002');
  console.warn('  Em desenvolvimento o código OTP aparece no log do servidor.\n');
}

main()
  .catch((error) => {
    console.error('Falha no seed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
