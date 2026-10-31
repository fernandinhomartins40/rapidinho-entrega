# Matriz de permissões

Cada célula é um teste em runtime: entrar com o perfil, executar a ação (pela
tela **e** chamando a server action/rota diretamente) e anotar o observado.
"Outro dono" significa usar o id de um registro de outra loja ou outro usuário.

Legenda do esperado: **S** permitido · **N** negado (mensagem de permissão ou
redirect, nada gravado) · **P** permitido só no que é dele · **—** não se aplica.
Na coluna "Obs." anote `ok` ou o id do achado no REGISTRO.md.

## Perfis de teste

| Perfil          | Papel (`UserRole` / `StoreStaffRole`) | Usuário do seed                          |
| --------------- | ------------------------------------- | ---------------------------------------- |
| Visitante       | sem sessão                            | —                                        |
| Cliente A       | `CUSTOMER`                            | (44) 99999-0002                          |
| Cliente B       | `CUSTOMER`                            | (44) 99800-0001                          |
| Dono loja 1     | `STORE_OWNER` / `OWNER`               | (44) 99000-0000                          |
| Dono loja 2     | `STORE_OWNER` / `OWNER`               | (44) 99000-0001                          |
| Gerente loja 1  | `STORE_STAFF` / `MANAGER`             | (44) 99800-0002                          |
| Operador loja 1 | `STORE_STAFF` / `OPERATOR`            | (44) 99800-0003                          |
| Entregador A    | `COURIER`                             | (44) 99991-1001                          |
| Entregador B    | `COURIER`                             | (44) 99991-1002                          |
| Admin           | `ADMIN`                               | (44) 99800-0004                          |
| Super admin     | `SUPER_ADMIN`                         | (44) 99999-0001 (painel: e-mail e senha) |
| Bloqueado       | `CUSTOMER`, `status` = `BLOCKED`      | (44) 99800-0005                          |

Os perfis 99800-000x são criados pelo `pnpm db:seed:e2e` (rode depois do
`pnpm db:seed`). Loja 1 = a do lojista (44) 99000-0000.

## Guardas existentes (ponto de partida)

| Guarda                           | Onde                                     | Libera                                     |
| -------------------------------- | ---------------------------------------- | ------------------------------------------ |
| `runAction`                      | apps/web/src/lib/action.ts               | qualquer um, inclusive visitante           |
| `runAuthedAction`                | apps/web/src/lib/action.ts               | qualquer usuário logado ativo              |
| `runStoreAction`                 | apps/admin/src/lib/store-action.ts       | qualquer membro ativo da loja + admin      |
| `runStoreOwnerAction`            | apps/admin/src/lib/store-action.ts       | `OWNER` + admin                            |
| `runAdminAction`                 | apps/admin/src/lib/admin-action.ts       | `ADMIN` e `SUPER_ADMIN`                    |
| `requireSuperAdmin`              | packages/auth/src/guards.ts              | `SUPER_ADMIN`                              |
| `comEntregador`/`requireCourier` | apps/admin/src/app/entregador/actions.ts | entregador com cadastro aprovado           |
| layout `/admin`                  | apps/admin/src/app/admin/layout.tsx      | admin da plataforma                        |
| layout `/loja`                   | apps/admin/src/app/loja/layout.tsx       | membro da loja (qualquer `StoreStaffRole`) |

Pontos de atenção já vistos no código: o layout de `/loja` libera qualquer
membro, e algumas páginas só escondem o botão para quem não é dono
(`podeEditar`, `podeContratar`). A **leitura** dessas páginas — em especial
`/loja/financeiro` — precisa ser testada com o Operador (ver R3-005).

## Cliente (apps/web)

| Ação                                       | Visit.  | Cli. A | Cli. A em dado do B | Dono | Entreg. | Admin | Obs. |
| ------------------------------------------ | ------- | ------ | ------------------- | ---- | ------- | ----- | ---- |
| Ver cidade, loja, produto, busca           | S       | S      | —                   | S    | S       | S     |      |
| Adicionar ao carrinho                      | N→login | S      | —                   | S    | S       | S     |      |
| Alterar/remover item do carrinho           | N       | P      | N                   | P    | P       | P     |      |
| Finalizar pedido (preço vem do banco)      | N       | S      | —                   | S    | S       | S     |      |
| Usar endereço de outro usuário no checkout | —       | —      | N                   | —    | —       | —     |      |
| Usar receita (upload) de outro usuário     | —       | —      | N                   | —    | —       | —     |      |
| Ver pedido / acompanhar                    | N       | P      | N                   | —    | —       | S     |      |
| Avaliar pedido (só entregue, uma vez)      | N       | P      | N                   | —    | —       | —     |      |
| Responder troca de item                    | N       | P      | N                   | —    | —       | —     |      |
| Pedir novamente                            | N       | P      | N                   | —    | —       | —     |      |
| Endereços: criar, editar, padrão, excluir  | N       | P      | N                   | P    | P       | P     |      |
| Favoritar loja                             | N       | S      | —                   | S    | S       | S     |      |
| Exportar meus dados                        | N       | P      | N                   | P    | P       | P     |      |
| Excluir minha conta                        | N       | P      | N                   | ?    | ?       | N     |      |
| Cadastrar loja (`/cadastro-loja`)          | ?       | S      | —                   | ?    | ?       | ?     |      |
| Cadastrar-se como entregador               | ?       | S      | —                   | ?    | ?       | ?     |      |
| Sessão em grupo "Fome" (criar, votar)      | S       | S      | —                   | S    | S       | S     |      |
| Inscrever push                             | N       | S      | —                   | S    | S       | S     |      |
| Upload (`/api/uploads`)                    | N       | P      | —                   | P    | P       | P     |      |

`?` = regra não está clara no código; registrar em "Decisões pendentes".
"Excluir minha conta" de quem é dono de loja ou entregador com corrida em
andamento é um caso a definir (o que acontece com a loja?).

## Loja (apps/admin, `/loja`)

| Ação                                       | Dono 1 | Dono 1 em loja 2 | Gerente | Operador | Cliente | Admin | Super | Obs.   |
| ------------------------------------------ | ------ | ---------------- | ------- | -------- | ------- | ----- | ----- | ------ |
| Ver visão geral, pedidos                   | S      | N                | S       | S        | N       | S     | S     |        |
| Aceitar, avançar, cancelar pedido          | S      | N                | S       | S        | N       | S     | S     |        |
| Separação (mercado/pesagem)                | S      | N                | S       | S        | N       | S     | S     |        |
| Pausar produtos do pedido                  | S      | N                | S       | S        | N       | S     | S     |        |
| Produtos, categorias, complementos, pizzas | S      | N                | S       | ?        | N       | S     | S     |        |
| Importar planilha                          | S      | N                | S       | ?        | N       | S     | S     |        |
| Horários, pausar/retomar loja, feriados    | S      | N                | S       | ?        | N       | S     | S     |        |
| Regras e zonas de entrega                  | S      | N                | S       | ?        | N       | S     | S     |        |
| Cupons da loja                             | S      | N                | S       | ?        | N       | S     | S     |        |
| Responder avaliação                        | S      | N                | S       | S        | N       | S     | S     |        |
| Chamar entregador / cancelar corrida       | S      | N                | S       | S        | N       | S     | S     |        |
| **Ver financeiro**                         | S      | N                | ?       | **N?**   | N       | S     | S     | R3-005 |
| Configurações (perfil, pagamento, imagens) | S      | N                | N       | N        | N       | S     | S     |        |
| Convidar/alternar entregador próprio       | S      | N                | N       | N        | N       | S     | S     |        |
| Contratar plano / impulsionamento          | S      | N                | N       | N        | N       | S     | S     |        |
| Loja `SUSPENDED`: qualquer ação            | N      | —                | N       | N        | —       | S     | S     |        |

As linhas com `?` para Gerente/Operador dependem de decisão: hoje o código
usa `runStoreAction` (todos os membros). Registrar a regra decidida aqui.

## Entregador (`/entregador`)

| Ação                                                | Entreg. A  | A em corrida do B | Entreg. pendente/suspenso | Cliente | Dono | Obs.   |
| --------------------------------------------------- | ---------- | ----------------- | ------------------------- | ------- | ---- | ------ |
| Ver corridas disponíveis                            | S          | —                 | N                         | N       | N    |        |
| Aceitar corrida (corrida livre)                     | S          | N (já aceita)     | N                         | N       | N    |        |
| Aceitar a mesma corrida em paralelo (2 abas, A e B) | só 1 vence | —                 | —                         | —       | —    |        |
| Avançar corrida (retirado, entregue)                | P          | N                 | N                         | N       | N    |        |
| Corrida avulsa (aceitar/avançar)                    | P          | N                 | N                         | N       | N    |        |
| Alterar disponibilidade                             | S          | —                 | N                         | N       | N    |        |
| Enviar localização                                  | P          | —                 | N                         | N       | N    | R3-003 |

## Plataforma (`/admin`)

| Ação                                                | Admin | Super | Dono | Cliente | Obs.   |
| --------------------------------------------------- | ----- | ----- | ---- | ------- | ------ |
| Ver painel, lojas, pedidos, auditoria               | S     | S     | N    | N       |        |
| Aprovar/recusar loja; suspender                     | S     | S     | N    | N       |        |
| Aprovar/suspender entregador                        | S     | S     | N    | N       |        |
| Cidades, banners, cupons, planos, pacotes           | S     | S     | N    | N       |        |
| Campanha de notificação                             | S     | S     | N    | N       |        |
| Cancelar pedido pela plataforma                     | S     | S     | N    | N       |        |
| Moderar avaliação                                   | S     | S     | N    | N       |        |
| Bloquear usuário                                    | S     | S     | N    | N       |        |
| Alterar papel para `CUSTOMER`…`COURIER`             | S     | S     | N    | N       |        |
| Alterar papel para `ADMIN`/`SUPER_ADMIN`            | N     | S     | N    | N       |        |
| Admin alterar o próprio papel / bloquear a si mesmo | N     | N     | —    | —       |        |
| Entrar como lojista (impersonation)                 | N     | S     | N    | N       |        |
| Sair do modo lojista                                | —     | S     | —    | —       | R3-002 |
| Página `/admin/sms`                                 | N     | S     | N    | N       |        |
| Trocar a própria senha                              | S     | S     | —    | —       |        |
| Toda ação acima grava `AuditLog`                    | S     | S     | —    | —       |        |

## Rotas de API

| Rota                              | Proteção esperada                                   | Teste                                       | Obs. |
| --------------------------------- | --------------------------------------------------- | ------------------------------------------- | ---- |
| `POST /api/auth/otp/request`      | rate limit por telefone e IP                        | 4º pedido em 15 min é recusado              |      |
| `POST /api/auth/otp/verify`       | tentativas máximas, código expira                   | código errado N vezes bloqueia; reuso falha |      |
| `POST /api/webhooks/pagamento`    | assinatura do provedor, idempotência                | sem assinatura → 401; replay não duplica    |      |
| `POST /api/uploads` (web e admin) | sessão, tipo MIME real, tamanho, contexto permitido | SVG/HTML disfarçado de imagem é recusado    |      |
| `POST /api/push`                  | sessão                                              | sem sessão → 401                            |      |
| `/api/sms/*`                      | token do app gateway                                | sem token → 401; token de outro → 401       |      |
| `GET /api/health`                 | público, sem dado sensível                          | resposta não vaza versão/segredo            |      |
