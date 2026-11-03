import { vi, type Mock } from 'vitest';

/**
 * Prisma falso: `prisma.order.findFirst` existe sem declarar, e cada teste só
 * configura o que a regra lê. Nada aqui fala com banco, fila ou provedor.
 */
type Modelo = Record<string, Mock>;

const modelos = new Map<string, Modelo>();

function modelo(nome: string): Modelo {
  if (!modelos.has(nome)) {
    modelos.set(
      nome,
      new Proxy({} as Modelo, {
        get(alvo, metodo: string) {
          alvo[metodo] ??= vi.fn();
          return alvo[metodo];
        },
      }),
    );
  }
  return modelos.get(nome)!;
}

export const prismaFalso = new Proxy({} as Record<string, Modelo>, {
  get(_alvo, nome: string) {
    // Consultas cruas (busca, ranking) voltam vazias: o teste não depende delas.
    if (nome === '$queryRaw') return async () => [];
    if (nome === '$transaction') {
      return (entrada: unknown) =>
        typeof entrada === 'function' ? entrada(prismaFalso) : Promise.all(entrada as unknown[]);
    }
    return modelo(nome);
  },
});

class PrismaClientKnownRequestError extends Error {
  code: string;
  meta?: { target?: unknown };

  constructor(code: string, meta?: { target?: unknown }) {
    super(code);
    this.code = code;
    this.meta = meta;
  }
}

export const databaseFalso = {
  prisma: prismaFalso,
  Prisma: { PrismaClientKnownRequestError, JsonNull: 'JsonNull' },
  desfazerReservasDoPedido: vi.fn(),
};

export const erroDoPrisma = (code: string, target?: unknown) =>
  new PrismaClientKnownRequestError(code, { target });

/** Limpa os mocks e as respostas configuradas, para um teste não vazar no outro. */
export function zerarPrisma(): void {
  modelos.clear();
}
