import { z } from 'zod';
import { centsSchema, cuidSchema } from './common';

export const sellingUnitSchema = z.enum(['UNIT', 'WEIGHT_KG']);
export const productTypeSchema = z.enum(['SIMPLE', 'PIZZA']);

/**
 * Cadastro rápido: o dono do mercadinho precisa cadastrar em menos de 30
 * segundos. Só nome e preço são obrigatórios — todo o resto é opcional.
 */
export const quickProductSchema = z.object({
  name: z.string().min(2, 'Informe o nome do produto').max(140),
  priceCents: centsSchema.min(1, 'Informe o preço'),
  categoryId: cuidSchema.optional(),
  imageId: cuidSchema.optional(),
  description: z.string().max(1000).optional(),
});

export const productSchema = quickProductSchema.extend({
  compareAtPriceCents: centsSchema.nullable().optional(),
  productType: productTypeSchema.default('SIMPLE'),
  sellingUnit: sellingUnitSchema.default('UNIT'),
  weightStepGrams: z.number().int().min(10).max(5000).nullable().optional(),
  minWeightGrams: z.number().int().min(10).max(50000).nullable().optional(),
  sku: z.string().max(60).optional(),
  barcode: z.string().max(60).optional(),
  isAvailable: z.boolean().default(true),
  stockQuantity: z.number().int().min(0).nullable().optional(),
  isFeatured: z.boolean().default(false),
  sortOrder: z.number().int().min(0).default(0),
  complementGroupIds: z.array(cuidSchema).max(30).default([]),
});

export const updateProductSchema = productSchema.partial().extend({
  id: cuidSchema,
});

/** Pausar/despausar produto com um clique. */
export const toggleProductSchema = z.object({
  id: cuidSchema,
  isAvailable: z.boolean(),
  /// Pausa temporária: volta sozinho depois de N minutos.
  pauseMinutes: z.number().int().min(5).max(10080).nullable().optional(),
});

export const menuCategorySchema = z.object({
  name: z.string().min(2, 'Informe o nome da categoria').max(80),
  description: z.string().max(300).optional(),
  imageId: cuidSchema.nullable().optional(),
  isActive: z.boolean().default(true),
});

/** Reordenação por arrastar: lista de ids na ordem final. */
export const reorderSchema = z.object({
  ids: z.array(cuidSchema).min(1),
});

export const complementGroupSchema = z
  .object({
    name: z.string().min(2, 'Informe o nome do grupo').max(80),
    description: z.string().max(300).optional(),
    isRequired: z.boolean().default(false),
    minChoices: z.number().int().min(0).max(50).default(0),
    maxChoices: z.number().int().min(1).max(50).default(1),
    allowRepeat: z.boolean().default(false),
    isActive: z.boolean().default(true),
    options: z
      .array(
        z.object({
          id: cuidSchema.optional(),
          name: z.string().min(1, 'Informe a opção').max(80),
          description: z.string().max(200).optional(),
          priceCents: centsSchema.default(0),
          isAvailable: z.boolean().default(true),
        }),
      )
      .min(1, 'Adicione pelo menos uma opção')
      .max(100),
  })
  .refine((data) => data.maxChoices >= data.minChoices, {
    message: 'O máximo deve ser maior ou igual ao mínimo',
    path: ['maxChoices'],
  })
  .refine((data) => !data.isRequired || data.minChoices >= 1, {
    message: 'Grupo obrigatório exige no mínimo 1 escolha',
    path: ['minChoices'],
  });

// --- Pizza -----------------------------------------------------------------

export const pizzaSizeSchema = z.object({
  name: z.string().min(1, 'Informe o tamanho').max(40),
  description: z.string().max(200).optional(),
  maxFlavors: z.number().int().min(1).max(8),
  slices: z.number().int().min(1).max(24).nullable().optional(),
  isActive: z.boolean().default(true),
});

export const pizzaFlavorSchema = z.object({
  name: z.string().min(2, 'Informe o sabor').max(80),
  description: z.string().max(500).optional(),
  imageId: cuidSchema.nullable().optional(),
  groupName: z.string().max(60).optional(),
  isAvailable: z.boolean().default(true),
  /// Preço do sabor em cada tamanho.
  prices: z
    .array(z.object({ sizeId: cuidSchema, priceCents: centsSchema.min(1) }))
    .min(1, 'Defina o preço em pelo menos um tamanho'),
});

export const pizzaExtraSchema = z.object({
  name: z.string().min(2).max(60),
  kind: z.enum(['CRUST', 'EDGE']).default('EDGE'),
  priceCents: centsSchema.default(0),
  isAvailable: z.boolean().default(true),
});

// --- Importação em massa ---------------------------------------------------

/**
 * Uma linha da planilha de importação. Supermercado com centenas de itens não
 * cadastra na mão — o preço vem como texto porque a planilha traz "12,90".
 */
export const productImportRowSchema = z.object({
  nome: z.string().min(2, 'Nome obrigatório'),
  preco: z.union([z.string(), z.number()]),
  categoria: z.string().optional(),
  descricao: z.string().optional(),
  codigo: z.string().optional(),
  codigo_barras: z.string().optional(),
  disponivel: z.union([z.string(), z.boolean()]).optional(),
  unidade: z.string().optional(),
});

export type QuickProductInput = z.infer<typeof quickProductSchema>;
export type ProductInput = z.infer<typeof productSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type MenuCategoryInput = z.infer<typeof menuCategorySchema>;
export type ComplementGroupInput = z.infer<typeof complementGroupSchema>;
export type PizzaSizeInput = z.infer<typeof pizzaSizeSchema>;
export type PizzaFlavorInput = z.infer<typeof pizzaFlavorSchema>;
export type ProductImportRow = z.infer<typeof productImportRowSchema>;
