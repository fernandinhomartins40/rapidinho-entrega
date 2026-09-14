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
COPY package.json pnpm-workspace.yaml ./
COPY packages/config ./packages/config
COPY packages/shared ./packages/shared
COPY apps/realtime ./apps/realtime
RUN pnpm --filter @rapidinho/realtime build

FROM base AS runner
ENV NODE_ENV=production REALTIME_PORT=3002

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 realtime

# Só o que o processo executa: build + dependências de produção.
COPY --from=builder --chown=realtime:nodejs /app/apps/realtime/dist ./dist
COPY --from=builder --chown=realtime:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=realtime:nodejs /app/apps/realtime/node_modules ./apps/realtime/node_modules
COPY --from=builder --chown=realtime:nodejs /app/packages ./packages

USER realtime
EXPOSE 3002

CMD ["node", "dist/server.js"]
