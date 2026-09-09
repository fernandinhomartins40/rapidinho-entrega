# ARCHITECTURE.md — Rapidinho Entrega

Este documento registra as decisões técnicas do projeto **Rapidinho Entrega**, uma
plataforma de delivery multi-cidade (marketplace) com foco inicial em
Palmital/PR. Serve como referência viva: deve ser atualizado sempre que uma
decisão estrutural mudar.

## 1. Visão geral

Monorepo pnpm + Turborepo com dois apps Next.js (App Router) e quatro pacotes
compartilhados, tudo containerizado atrás de um único Nginx.

```
/apps
  /web          PWA do cliente final
  /admin        Painel do lojista (/loja) + Painel do super admin (/admin)
/packages
  /database     Prisma schema, client, migrations, seeds
  /ui           Design system (shadcn/ui + Tailwind) + <ImageUploader />
  /shared       Zod schemas, tipos de domínio, constantes, utils
  /config       eslint, tsconfig, tailwind config compartilhados
/docker
  /nginx        reverse proxy
```

## 2. Multi-cidade e multi-tenant desde o primeiro commit

- `City` é uma entidade de primeira classe. Toda `Store`, todo `Order` e todo
  endereço pertence a uma `City`. Nenhuma regra de negócio assume uma cidade
  fixa; Palmital é dado de seed, não constante de código.
- `StoreCategory` é uma tabela (dado), não um enum fechado de categorias de
  loja — permite adicionar petshop, distribuidora, papelaria etc. sem
  migração estrutural. Um enum `StoreSegment` menor (`MARKET`, `PHARMACY`,
  `RESTAURANT`, `OTHER`) existe apenas para diferenças reais de UI/regra
  (ex.: venda por peso é comum em mercado), mas o cadastro de categorias de
  cardápio dentro da loja é sempre dinâmico.
- Isolamento multi-tenant é garantido na camada de query (todo repositório/
  service em `packages/database` recebe `storeId`/`cityId` explícito e todo
  endpoint de loja valida que o usuário logado tem vínculo com aquela loja
  via `StoreStaff`), nunca só escondido na UI.

## 3. Stack

| Camada | Escolha | Justificativa |
|---|---|---|
| Linguagem | TypeScript strict em tudo | consistência, segurança de tipos ponta a ponta |
| Framework web | Next.js 14+ App Router | SSR/PWA/rotas de API no mesmo app |
| ORM | Prisma | schema único versionado em `packages/database` |
| Banco | PostgreSQL 16 | full-text search nativo, JSON, extensões |
| Cache/fila/realtime transport | Redis 7 | BullMQ + adapter do Socket.io |
| Storage de imagens | MinIO (S3-compatible) | sem dependência de serviço pago no início |
| Auth | Auth.js (NextAuth) v5, sessão em banco (Prisma adapter) | suporta múltiplos papéis e provedores (OTP + social) |
| Realtime | **Socket.io self-hosted sobre Redis adapter** | mantém a filosofia "sem serviço pago obrigatório" já usada com MinIO; evita lock-in em Pusher/Ably. Interface abstrata em `packages/shared/realtime` permite trocar por Ably depois sem tocar nos consumidores. |
| Filas/jobs | BullMQ sobre Redis | processamento de imagem, notificações, cobrança de planos, expiração de boost |
| Pagamento — Pix/cartão online | **Mercado Pago** como implementação default do gateway | maior adoção e melhor suporte a Pix + cartão no Brasil. Todo acesso passa por uma interface `PaymentGateway` em `packages/shared`, então Asaas (ou outro) pode ser plugado como segunda implementação sem tocar em checkout/pedido. |
| WhatsApp | **Evolution API (self-hosted)** como implementação default | evita depender de aprovação/custo da Cloud API da Meta na fase inicial; fica atrás de uma interface `WhatsAppProvider`, trocável por Cloud API depois. |
| E-mail transacional | Resend | API simples, bom free tier |
| Erros/observabilidade | Sentry + logs estruturados (Pino) | |
| Testes | Vitest (unidade) + Playwright (E2E dos fluxos críticos) | |
| CI | GitHub Actions | lint, typecheck, test, build |

Todas as integrações externas (gateway de pagamento, WhatsApp, SMS/OTP,
e-mail, storage) são acessadas por trás de uma interface definida em
`packages/shared`, nunca chamadas diretamente dos apps — isso é o que torna
o gateway "trocável" como o plano pede.

## 4. Papéis e autorização

Enum `UserRole`: `CUSTOMER`, `STORE_OWNER`, `STORE_STAFF`, `COURIER`,
`ADMIN`, `SUPER_ADMIN`.

- Sessão via Auth.js, papel embutido no token/sessão.
- Middleware por rota protegida em `apps/admin` (namespaces `/loja/*` exigem
  `STORE_OWNER`/`STORE_STAFF` com vínculo ativo à loja; `/admin/*` exige
  `ADMIN`/`SUPER_ADMIN`).
- Toda query de dados de loja no lado do servidor recebe o `storeId` do
  vínculo autenticado, nunca de um parâmetro de URL não validado.

## 5. Onboarding do cliente (OTP)

Login por telefone com código OTP. Provedor de envio (SMS/WhatsApp) fica
atrás de uma interface `OtpSender`; implementação default usa a mesma
Evolution API para WhatsApp e um provedor de SMS simples via variável de
ambiente (fallback "console" em desenvolvimento, sem custo). Rate limiting
e proteção de força bruta no endpoint de verificação desde a Fase 1.

## 6. Upload e processamento de imagem

Componente único `<ImageUploader />` em `packages/ui`:
cliente (crop com aspect ratio fixo → compressão → conversão WebP/AVIF) →
API route dedicada → fila BullMQ (`image-processing`) → `sharp` gera
thumbnail/médio/grande + placeholder blur → grava no MinIO com nome
hash → persiste as variantes e o placeholder no banco. Nenhum outro lugar do
código deve subir imagem diretamente.

## 7. Endereços sem CEP/número

`Address` não tem `zipCode` nem `number` como obrigatórios. Campos:
`street`, `number?`, `neighborhood`, `referencePoint` (obrigatório na UI,
opcional no schema para não quebrar dados legados), `zipCode?`,
`cityId`, `lat/lng?` opcionais para geolocalização quando disponível.

## 8. Roteamento Nginx

- Produção: `rapidinhoentrega.com.br` → `web:3000`; `painel.rapidinhoentrega.com.br`
  → `admin:3001`, via `server_name`.
- Dev local (sem DNS wildcard): path-based, `/` → web, `/painel` → admin,
  usando `X-Forwarded-Prefix` e `basePath` do Next onde necessário.
- WebSocket upgrade habilitado nas rotas de realtime, `client_max_body_size`
  alto para upload de imagem, gzip habilitado.

## 9. Fases de entrega

Fase 0 (este documento) → Fase 1 (monorepo/Docker/Prisma/auth) → Fase 2
(super admin) → Fase 3 (lojista) → Fase 4 (PWA cliente) → Fase 5
(entregadores/impulsionamento/relatórios) → Fase 6 (testes/perf/hardening).

Dado o pedido de implementar o plano completo, as fases serão executadas em
sequência dentro desta mesma iniciativa, com commits atômicos por
funcionalidade e um checkpoint de progresso comunicado ao final de blocos
grandes de trabalho (não obrigatoriamente uma pausa bloqueante a cada fase).

## 10. Decisões em aberto (assumidas com default, revisáveis)

- Gateway de pagamento inicial: Mercado Pago (Asaas fica como segunda
  implementação da mesma interface).
- Provedor de WhatsApp: Evolution API self-hosted.
- Domínios `rapidinhoentrega.com.br` / `painel.rapidinhoentrega.com.br` são
  placeholders de configuração — ajustáveis via env var sem mudança de
  código.
