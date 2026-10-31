---
name: revisao-ponta-a-ponta
description: Conduz a rodada de revisão e correção de ponta a ponta do Rapidinho Entrega seguindo docs/revisao/PROTOCOLO.md - sobe o ambiente, roda as varreduras, distribui as frentes entre os agentes revisor-integracao, revisor-seguranca, revisor-produto, corretor e verificador, e fecha com o relatório. Use quando pedirem auditoria completa, revisão de ponta a ponta, rodada de correção ou para retomar uma rodada em andamento.
---

# Revisão de ponta a ponta

Você é o orquestrador. O procedimento completo está em
`docs/revisao/PROTOCOLO.md`; leia-o inteiro antes de agir. Este roteiro diz só
a ordem e quem faz o quê.

## Retomar ou começar

1. Trabalhe sempre na `main`; nunca crie branch nem worktree. Push na `main`
   dispara deploy, então commits ficam locais até o usuário autorizar.
2. Leia `docs/revisao/REGISTRO.md`: o estado de cada achado diz onde a rodada
   parou. Retome da primeira fase com trabalho pendente.

## Fase 0 — você mesmo faz

Siga o PROTOCOLO §3 Fase 0. Pontos desta máquina:

- Já existe um Postgres de outro projeto na 5432; publique o do Rapidinho em
  outra porta (ex.: 5433) num override local e ajuste o `DATABASE_URL`, sem
  mexer no container alheio.
- Crie no `packages/database/prisma/seed/e2e.ts` os perfis que faltam
  (Cliente B, Gerente, Operador, Admin, Bloqueado — ver MATRIZ-DE-PERMISSOES.md).
- Suba os quatro processos (web, admin, realtime, worker) em background e
  confirme `/api/health` e o Socket.io.
- Guarde a linha de base em `docs/revisao/evidencias/fase0/`.

Sem a Fase 0 completa, não despache nenhum agente de runtime.

## Fases 1 a 3 — despache em paralelo

As três frentes leem código e usam o navegador; não editam código de produção,
então podem rodar ao mesmo tempo:

- `revisor-integracao`: fantasmas, contratos, jornadas C*, L*, E*, A*, X*.
- `revisor-seguranca`: varreduras, matriz de permissões, rotas de API, LGPD.
- `revisor-produto`: passos, campos, heurísticas, hipóteses de produto.

Na mensagem para cada um, diga: a fase, as jornadas ou seções dele, as URLs e
portas do ambiente, onde salvar evidência e que o banco é compartilhado (rodar
`pnpm db:seed:e2e` antes de bateria que altera dados e avisar no retorno).
Quando voltarem, consolide o REGISTRO.md: deduplique, ajuste severidade,
separe "Decisões pendentes".

## Decisões de negócio

Antes da Fase 4, leve ao usuário as "Decisões pendentes" do REGISTRO.md numa
única pergunta agrupada. Achado que depende de decisão sem resposta fica
`pendente`; não é corrigido por suposição.

## Fase 4 — corretor, um achado por vez

Despache o `corretor` com a lista ordenada (S0, S1, S2, depois S3 baratos). Um
corretor por vez, na `main`. Não paralelize correções (worktree cria branch).

## Fase 5 — verificador

Despache o `verificador` sobre todos os achados `corrigido`. O que ele reabrir
volta para o corretor. Repita até não haver reaberturas ou até sobrar só o que
depende de decisão/ambiente.

## Fase 6 — você mesmo faz

Escreva a rodada 3 em `docs/IMPLEMENTATION_REPORT.md` (PROTOCOLO §3 Fase 6).
Ao usuário, entregue: números (achados por severidade: abertos, corrigidos,
verificados, pendentes), as correções principais, as jornadas antes/depois em
passos, e as pendências com motivo. Não faça `git push` nem deploy sem pedido
explícito.
