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
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @rapidinho/admin build

# --- Migrações ---------------------------------------------------------------
# A imagem final é o standalone do Next e não carrega o CLI do Prisma, que é
# devDependency. Este estágio existe só para o deploy rodar `migrate deploy`
# com exatamente a mesma versão do Prisma que a aplicação usa.
FROM builder AS migrator
WORKDIR /app
CMD ["pnpm", "--filter", "@rapidinho/database", "exec", "prisma", "migrate", "deploy"]

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
