# Escopo e inventário-base da auditoria PIE

Documento entregue igual aos cinco revisores (R1–R5) antes de qualquer parecer.
Não contém conclusões. Data: 2026-11-01. Commit auditado: `d65c0e5` (main).

## Modo

AUDITORIA + CORREÇÃO (padrão do protocolo). Os revisores **não alteram código**:
só escrevem o próprio parecer em `docs/pie/BANCA_R*.md`. As correções são
feitas depois pelo Auditor-Chefe, a partir dos achados consolidados.

## Produto

Rapidinho Entrega: marketplace de delivery para cidades do interior (PR).
Clientes pedem em lojas; lojistas e funcionários operam pelo painel; entregadores
fazem corridas; a plataforma (admin / super admin) aprova lojas, cobra planos e
impulsionamentos, envia campanhas.

## Stack

- Monorepo pnpm + turbo, Node ≥ 20, TypeScript.
- `apps/web` — Next.js 15, site do cliente (rapidinhoentrega.com.br).
- `apps/admin` — Next.js 15, painel (painel.rapidinhoentrega.com.br): `/admin` (plataforma), `/loja` (lojista/funcionário), `/entregador`.
- `apps/worker` — BullMQ (jobs em `apps/worker/src/jobs`).
- `apps/realtime` — servidor de tempo real (`apps/realtime/src/server.ts`).
- `apps/cliente-android` — app nativo Android (WebView), APK servido em `/baixar/rapidinho.apk`.
- `apps/sms-gateway` — app Android que recebe SMS (login por SMS reverso).
- `packages/auth` (Auth.js, sessões no banco, OTP, senha), `packages/database` (Prisma, 64 models, PostgreSQL), `packages/services` (fila, Redis, rate limit, storage S3/MinIO, mensagens, pagamentos, push), `packages/shared` (env, schemas, utilitários), `packages/ui`.
- Infra: Docker Compose (`docker-compose.yml` + `docker-compose.prod.yml`), Nginx (`docker/nginx`), GitHub Actions (`.github/workflows/ci.yml`, `deploy.yml`), VPS compartilhada com outros projetos (`72.60.10.108`, ver `DEPLOY.md`, `docs/PADRAO-VPS-MULTI-APPS.md`).

## Regras de login vigentes (decisão do dono, 2026-11-01)

- Cliente: código por SMS (SMSDev), **somente dentro do app nativo** (user-agent com `RapidinhoApp/`). Sessão de 400 dias com renovação deslizante.
- Entregador: SMS, somente no app, e só se for COURIER ativo.
- Lojista, funcionário, admin, super admin: e-mail e senha no painel. Senha esquecida: super admin gera provisória.

## Rotas principais

- web: `/`, `/[cidade]`, `/[cidade]/[loja]`, `/[cidade]/busca`, `/[cidade]/fome`, `/[cidade]/pedir`, `/[cidade]/pizza/[loja]`, `/[cidade]/produto/[id]`, `/carrinho`, `/checkout/[storeId]`, `/pedidos`, `/pedidos/[id]`, `/pedidos/[id]/avaliar`, `/conta`, `/conta/dados`, `/enderecos`, `/favoritos`, `/entrar`, `/cadastro-loja`, `/entregador`, `/minha-cidade`, `/privacidade`, `/termos`, `/offline`, `/app`.
- web API: `/api/auth/*`, `/api/auth/otp/{request,verify}`, `/api/health`, `/api/push`, `/api/sms/{app/entrar,recebido,sinal}`, `/api/uploads`, `/api/webhooks/pagamento`.
- admin `/admin/*`: auditoria, banners, cidades, cupons, entregadores, financeiro, impulsionamento, lojas, lojas/[id], notificacoes, pedidos, pedidos/[id], planos, senha, sms, usuarios.
- admin `/loja/*`: avaliacoes, categorias, complementos, configuracoes, corridas, cupons, entrega, entregadores, financeiro, horarios, impulsionar, pedidos, pizzas, produtos, produtos/[id], produtos/importar, senha.
- admin: `/entrar`, `/entregador`, `/api/health`, `/api/uploads`, `/api/auth/*`.

## Histórico relevante

- `docs/revisao/` — rodada 3 anterior (PROTOCOLO, JORNADAS, MATRIZ-DE-PERMISSOES, LGPD, REGISTRO). Achados R3-001…R3-013, a maioria **aberta**. Não reutilizar como prova atual: reconfirmar.
- Docs de VPS: `docs/AUDITORIA-OTIMIZACAO-VPS.md`, `docs/PLANO-OTIMIZACAO-VPS.md`, `Otmização VPS.md`.

## Ambiente de teste autorizado (local)

- Postgres, Redis e MinIO em Docker local (`rapidinho-postgres`, `rapidinho-redis`, `rapidinho-s3-revisao`).
- **Use somente** web em `http://localhost:3200` e painel em `http://localhost:3201`. Foram iniciados com `OTP_PROVIDER=console` e sem chave da SMSDev, então nenhum SMS real é enviado. Em desenvolvimento, a tela de login mostra o código.
- **Não use** as portas 3000/3001 nem 3100/3101: são servidores antigos, com código desatualizado e possivelmente com SMS real.
- Para o login no site, envie o user-agent com ` RapidinhoApp/teste`. Sem ele, o login é recusado de propósito.
- No localhost, os cookies não separam por porta: uma sessão do site e uma do painel podem se sobrescrever. Use contextos de navegador separados.
- Contas de teste do seed e2e (`packages/database/prisma/seed/e2e.ts`): lojista@e2e.rapidinho.test e superadmin@e2e.rapidinho.test, ambas com a senha `E2e@senha123`.
- Playwright: o Chromium baixado trava nesta máquina, use o Edge (`channel: 'msedge'`).

## Produção

- Somente leitura e sondas HTTP públicas (GET), sem carga e sem criar dados.
- O acesso SSH à VPS foi **negado** pelo modo de permissões nesta sessão, então as métricas do servidor ficam BLOQUEADAS.
- Proibido: enviar SMS ou WhatsApp reais, criar pedidos ou contas em produção, ou fazer cobranças.

## Formato obrigatório do parecer

Cada achado leva: ID (`R<n>-NNN`), título, categoria, severidade (Crítica/Alta/Média/Baixa) com justificativa, estado (CONFIRMADO / FORTE INDÍCIO / HIPÓTESE / NÃO REPRODUZIDO), arquivo:linha, reprodução segura, esperado × observado, evidência (comando e saída resumida e sanitizada), impacto, correção proposta e teste de aceite.

Além dos achados, o parecer lista o que foi inspecionado, o que foi testado (com o comando), o que não foi testado e as limitações. Nada de segredos ou dados pessoais reais no texto.
