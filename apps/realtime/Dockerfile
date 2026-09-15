# =============================================================================
# Servidor de tempo real (Socket.io sobre Redis).
#
# Processo separado do Next: em modo standalone o Next não expõe o servidor
# HTTP para anexar um WebSocket. Não fala com o Postgres — a autorização de
# canal é um token assinado pelo app, conferido por HMAC.
# =============================================================================

FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
WORKDIR /app

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/config/package.json ./packages/config/
COPY packages/shared/package.json ./packages/shared/
COPY apps/realtime/package.json ./apps/realtime/
RUN pnpm install --frozen-lockfile --filter @rapidinho/realtime...

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY --from=deps /app/apps ./apps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/config ./packages/config
COPY packages/shared ./packages/shared
COPY apps/realtime ./apps/realtime
RUN pnpm --filter @rapidinho/realtime build

# Árvore só de produção. `pnpm deploy` resolve as dependências declaradas e
# deixa de fora typescript, eslint e tsx, que nada executam em runtime.
RUN pnpm --filter @rapidinho/realtime deploy --prod --legacy /pronto

FROM base AS runner
ENV NODE_ENV=production REALTIME_PORT=3002

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 realtime

# O build empacota o código do workspace num arquivo só, então `packages/` não
# vai mais para a imagem: não há mais nada lá para resolver em runtime.
COPY --from=builder --chown=realtime:nodejs /app/apps/realtime/dist ./dist
COPY --from=builder --chown=realtime:nodejs /pronto/node_modules ./node_modules

USER realtime
EXPOSE 3002

CMD ["node", "dist/server.js"]
