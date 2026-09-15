# =============================================================================
# Painel do lojista e do super admin. Build multi-stage: a imagem final leva só o servidor
# standalone do Next, sem código-fonte nem dependências de build.
# =============================================================================

FROM node:22-alpine AS base
# openssl é exigido pelo Prisma; libc6-compat cobre os binários pré-compilados.
RUN apk add --no-cache libc6-compat openssl
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
WORKDIR /app

# --- Dependências -----------------------------------------------------------
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/config/package.json ./packages/config/
COPY packages/database/package.json ./packages/database/
COPY packages/shared/package.json ./packages/shared/
COPY packages/ui/package.json ./packages/ui/
COPY packages/auth/package.json ./packages/auth/
COPY packages/services/package.json ./packages/services/
COPY apps/admin/package.json ./apps/admin/
RUN pnpm install --frozen-lockfile

# --- Build ------------------------------------------------------------------
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY --from=deps /app/apps ./apps
COPY . .
RUN pnpm --filter @rapidinho/database exec prisma generate

# As URLs públicas precisam existir no BUILD, não só no runtime: o middleware
# roda no runtime edge, onde o Next substitui `process.env` pelo valor no
# momento do build. Sem isto a CSP sairia sem a origem do socket e o tempo real
# seria bloqueado pelo navegador — com a página carregando normalmente, o que
# esconde a causa.
ARG NEXT_PUBLIC_WEB_URL=http://localhost:3000
ARG NEXT_PUBLIC_ADMIN_URL=http://localhost:3001
ARG NEXT_PUBLIC_SOCKET_URL=http://localhost:3002
ARG S3_PUBLIC_URL=http://localhost:9000/rapidinho
ENV NEXT_TELEMETRY_DISABLED=1 \
    NEXT_PUBLIC_WEB_URL=$NEXT_PUBLIC_WEB_URL \
    NEXT_PUBLIC_ADMIN_URL=$NEXT_PUBLIC_ADMIN_URL \
    NEXT_PUBLIC_SOCKET_URL=$NEXT_PUBLIC_SOCKET_URL \
    S3_PUBLIC_URL=$S3_PUBLIC_URL
RUN pnpm --filter @rapidinho/admin build

# --- Runtime ----------------------------------------------------------------
FROM base AS runner
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3001 \
    HOSTNAME=0.0.0.0

# Rodar como root em container é risco desnecessário.
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/apps/admin/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/admin/.next/static ./apps/admin/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/admin/public ./apps/admin/public

# O rastreador do Next não leva o binário do engine para o standalone. Sem
# esta cópia o container sobe e falha na primeira query.
COPY --from=builder --chown=nextjs:nodejs /app/packages/database/generated ./packages/database/generated

USER nextjs
EXPOSE 3001

CMD ["node", "apps/admin/server.js"]
