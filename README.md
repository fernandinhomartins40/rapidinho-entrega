# Rapidinho Entrega

Plataforma de delivery multi-cidade para o interior — mercados, farmácias e
restaurantes. A operação começa em **Palmital/PR** e a arquitetura é
multi-cidade e multi-tenant desde o primeiro commit.

## Subindo tudo com um comando

Pré-requisitos: Docker e Docker Compose.

```bash
cp .env.example .env
# Troque as senhas e gere o AUTH_SECRET:
#   openssl rand -base64 32

docker compose up -d
```

Isso sobe seis serviços: `nginx`, `web`, `admin`, `postgres`, `redis` e
`minio` — com **uma única porta externa** (80). O Nginx roteia internamente.

Depois de subir, aplique as migrations e a carga inicial:

```bash
docker compose exec web pnpm --filter @rapidinho/database exec prisma migrate deploy
docker compose exec web pnpm db:seed
```

| Endereço                | O que é                                  |
| ----------------------- | ---------------------------------------- |
| http://localhost        | App do cliente (PWA)                     |
| http://localhost/painel | Painel do lojista e do super admin       |
| http://localhost:9001   | Console do MinIO (só em desenvolvimento) |

Em produção o roteamento é por domínio: `rapidinhoentrega.com.br` para o app
do cliente e `painel.rapidinhoentrega.com.br` para o painel. Ajuste
`WEB_DOMAIN` e `ADMIN_DOMAIN` no `.env` e use
`docker compose -f docker-compose.yml up -d`, que ignora o override de
desenvolvimento (em produção o banco não publica porta no host).

## Desenvolvimento local (sem containers para os apps)

```bash
pnpm install
docker compose up -d postgres redis minio   # só a infraestrutura
pnpm db:migrate
pnpm db:seed
pnpm dev
```

O app do cliente sobe em `localhost:3000` e o painel em `localhost:3001`.

Em desenvolvimento o código de acesso (OTP) **não é enviado por WhatsApp**:
ele aparece no log do servidor e também na resposta da API, para agilizar o
teste. Usuários da carga inicial:

| Telefone               | Papel              |
| ---------------------- | ------------------ |
| (44) 99999-0001        | Super admin        |
| (44) 99999-0002        | Cliente            |
| (44) 99000-0000 … 0009 | Donos das 10 lojas |
| (44) 99991-1001 / 1002 | Entregadores       |

## Estrutura

```
apps/
  web        PWA do cliente final          (porta interna 3000)
  admin      Painel do lojista + super admin (porta interna 3001)
packages/
  database   Prisma schema, migrations e seeds
  shared     Regras de domínio, schemas Zod, contratos de serviço
  services   Implementações: storage, imagens, WhatsApp, rate limit
  auth       Auth.js, sessão em banco, OTP e guardas multi-tenant
  ui         Design system e o <ImageUploader />
  config     eslint, tsconfig e tailwind compartilhados
docker/
  nginx      Reverse proxy (porta única, WebSocket, gzip)
```

A lógica de negócio vive em `packages/shared`, sem dependência de banco ou de
framework — é o que permite um app React Native futuro consumir a mesma regra
sem duplicar nada.

## Comandos

| Comando           | O que faz                                  |
| ----------------- | ------------------------------------------ |
| `pnpm dev`        | Sobe os dois apps em modo desenvolvimento  |
| `pnpm build`      | Build de produção                          |
| `pnpm lint`       | ESLint em todo o monorepo                  |
| `pnpm typecheck`  | Checagem de tipos (strict, sem `any`)      |
| `pnpm test`       | Testes de unidade (Vitest)                 |
| `pnpm db:migrate` | Cria e aplica migration em desenvolvimento |
| `pnpm db:seed`    | Carga inicial (idempotente)                |
| `pnpm db:studio`  | Prisma Studio                              |

## Decisões técnicas

Estão em [`ARCHITECTURE.md`](./ARCHITECTURE.md) — inclusive por que a sessão
fica em banco, por que o gateway de pagamento é uma interface e por que
categoria de loja é dado e não código.

## Configuração

Tudo passa pelo `.env` (veja `.env.example`, que é documentado campo a campo).
As variáveis são validadas com Zod no boot: um deploy com configuração
faltando quebra na subida, não na primeira cobrança de um cliente.

Provedores externos são trocáveis por variável de ambiente, sem mexer em
código:

- `PAYMENT_PROVIDER`: `mercadopago` | `asaas` | `fake`
- `WHATSAPP_PROVIDER`: `evolution` | `cloud` | `fake`
- `OTP_PROVIDER`: `whatsapp` | `sms` | `console`

`fake` e `console` existem para desenvolvimento sem credencial e sem custo —
e são recusados em produção pela validação de ambiente.
