# =============================================================================
# Processo de trabalho em segundo plano (BullMQ).
#
# Separado dos apps Next: job pesado no mesmo processo que atende requisição
# rouba CPU de quem está esperando a página carregar.
# =============================================================================

FROM node:22-alpine AS base
# openssl para o Prisma; libc6-compat para os binários pré-compilados do sharp.
RUN apk add --no-cache libc6-compat openssl
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
WORKDIR /app

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/config/package.json ./packages/config/
COPY packages/database/package.json ./packages/database/
COPY packages/shared/package.json ./packages/shared/
COPY packages/services/package.json ./packages/services/
COPY apps/worker/package.json ./apps/worker/
RUN pnpm install --frozen-lockfile --filter @rapidinho/worker...

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY --from=deps /app/apps ./apps
COPY package.json pnpm-workspace.yaml ./
COPY packages ./packages
COPY apps/worker ./apps/worker
# O `build` do serviço chama o empacotador da raiz; sem ele o build falha
# com MODULE_NOT_FOUND.
COPY scripts/empacotar-servico.mjs ./scripts/
RUN pnpm --filter @rapidinho/database exec prisma generate
RUN pnpm --filter @rapidinho/worker build

# Árvore só de produção: sem typescript, eslint nem tsx.
RUN pnpm --filter @rapidinho/worker deploy --prod --legacy /pronto

FROM base AS runner
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 worker

# `dist/` já traz o cliente do Prisma em `dist/prisma-client/`, copiado pelo
# empacotador: ele não pode ser empacotado porque localiza os engines com
# `__dirname`.
COPY --from=builder --chown=worker:nodejs /app/apps/worker/dist ./dist
COPY --from=builder --chown=worker:nodejs /pronto/node_modules ./node_modules
# O `pnpm deploy` copia o pacote respeitando o .gitignore, e `generated/`
# (o cliente do Prisma) está ignorado lá. Sem esta linha o worker morre na
# partida com ERR_MODULE_NOT_FOUND em @rapidinho/database/generated/client.
COPY --from=builder --chown=worker:nodejs /app/packages/database/generated ./node_modules/@rapidinho/database/generated

USER worker

CMD ["node", "dist/main.js"]
