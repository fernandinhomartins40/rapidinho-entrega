# Protocolo de revisão e correção de ponta a ponta

> Rodada 3. As rodadas 1 e 2 estão em `docs/IMPLEMENTATION_REPORT.md` e no
> histórico do git. Esta rodada é mais ampla: cobre o sistema inteiro, todos os
> perfis, e só aceita como resolvido o que foi **reproduzido, corrigido e
> validado com a aplicação rodando**.

Este documento é para os agentes (e pessoas) que vão executar a revisão. Ele
diz o que examinar, em que ordem, como provar que algo funciona e o que conta
como terminado. Os anexos detalham cada frente:

| Arquivo                                            | Para quê                                                  |
| -------------------------------------------------- | --------------------------------------------------------- |
| [MATRIZ-DE-PERMISSOES.md](MATRIZ-DE-PERMISSOES.md) | Quem pode o quê; cada célula é testada em runtime         |
| [JORNADAS.md](JORNADAS.md)                         | Tarefas reais de cada perfil, com contagem de passos e UX |
| [LGPD.md](LGPD.md)                                 | Requisitos da LGPD traduzidos em verificações de código   |
| [REGISTRO.md](REGISTRO.md)                         | Livro de achados: um por linha, com evidência e estado    |
| `scripts/auditoria/*.mjs`                          | Varreduras automáticas que alimentam a fila de revisão    |

## 1. Princípios

1. **Interface não é prova.** Um toast de "Salvo!" não diz nada. Algo só
   funciona quando o dado foi gravado, relido de outra sessão, propagado para
   quem precisa saber (outra tela, tempo real, worker, notificação) e sobrevive
   a um recarregamento.
2. **Toda server action e rota de API é um endpoint público.** Esconder o botão
   não é autorização. Cada uma é testada chamada diretamente, com a sessão do
   perfil errado e com o id de um registro de outro dono (OWASP Next.js Security
   Cheat Sheet; CVE-2025-29927 mostrou que middleware sozinho não protege).
3. **Reproduzir antes de corrigir.** Nenhuma correção entra sem antes existir um
   teste (unitário ou e2e) ou um roteiro de reprodução que **falha** por causa
   do problema. Depois da correção o mesmo teste passa. Sem isso, o achado não
   pode ser fechado.
4. **Fio completo.** Cada funcionalidade é seguida pelas camadas:
   `tela → ação/rota → validação (Zod) → regra de domínio (packages/shared) →
banco (Prisma) → evento (Redis/Socket.io) → fila (BullMQ/worker) → aviso
(push/WhatsApp/e-mail) → tela de quem recebe`. Um elo faltando é um achado,
   mesmo que cada pedaço isolado "funcione".
5. **Simples para quem não é técnico.** O público é cliente, lojista e motoboy
   do interior. Uma tarefa principal deve caber em até três passos quando isso
   fizer sentido (ver JORNADAS.md para como contar passos). Menos campos pesa
   mais que menos telas: a pesquisa do Baymard Institute mostra que o número de
   campos afeta a usabilidade bem mais que o número de etapas.
6. **Mudança mínima, no estilo do código.** Corrigir o defeito, não reescrever o
   módulo. Seguir as convenções do repositório (português nos nomes, wrappers
   `run*Action`, regras em `packages/shared`, comentários explicando o porquê).
7. **Relatar o que aconteceu de fato.** Teste que falhou é relatado com a
   saída. Etapa pulada é dita. Limitação de ambiente (sem Mercado Pago real, sem
   celular para o gateway SMS) vira pendência explícita, nunca "validado".

## 2. Severidade

| Nível  | Critério                                                                                             | Exemplo                                                   |
| ------ | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| **S0** | Vazamento de dado pessoal, acesso a dado de outro tenant, escalada de papel, perda de dinheiro       | Lojista lê pedido de outra loja; cliente muda preço       |
| **S1** | Fluxo principal quebrado ou dado não gravado/gravado errado; não conformidade LGPD direta            | Pedido não chega à loja; exclusão de conta não apaga dado |
| **S2** | Funcionalidade pela metade, integração desconectada, erro sem tratamento, inconsistência entre telas | Botão sem efeito; evento publicado que ninguém escuta     |
| **S3** | Atrito de UX, passo desnecessário, texto confuso, tela que poderia ser unificada                     | Três telas para configurar a entrega                      |

S0 e S1 bloqueiam a entrega. S2 deve ser corrigido nesta rodada salvo
justificativa registrada. S3 é corrigido quando o custo é baixo; o resto vira
proposta priorizada em REGISTRO.md.

## 3. Fases

As fases são sequenciais. Dentro de uma fase, frentes independentes podem rodar
em paralelo (seção 5).

### Fase 0 — Ambiente e linha de base

Objetivo: a aplicação inteira rodando localmente, com dados conhecidos, e um
retrato do estado atual antes de qualquer mudança.

1. Trabalhar sempre na `main` — **nunca criar branch**. Lembrete: cada push na
   `main` dispara o deploy, por isso os commits ficam locais até o responsável
   autorizar o push.
2. `cp .env.example .env` e ajustar para desenvolvimento: `OTP_PROVIDER=console`
   (ou o valor de dev documentado no `.env.example`), provedores de pagamento e
   WhatsApp em modo fake/sandbox. **Nunca** usar credencial real de produção.
3. Infraestrutura: `docker compose up -d postgres redis minio`. Se já existir
   outro Postgres na 5432 (há um `simvio-dev-db-1` nesta máquina), mudar a porta
   publicada no override local, não derrubar o container alheio.
4. `pnpm install`, `pnpm db:generate`, `pnpm db:migrate`, `pnpm db:seed` (e
   `pnpm db:seed:e2e` para os testes).
5. Subir `pnpm dev` (web 3000, admin 3001) **e também** `realtime` e `worker`
   (`pnpm --filter @rapidinho/realtime dev`, `pnpm --filter @rapidinho/worker dev`).
   Sem os quatro processos, metade dos fios não pode ser testada.
6. Linha de base, salvando a saída em `docs/revisao/evidencias/fase0/`:
   `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`,
   `pnpm audit --prod`, `node scripts/auditoria/mapa-de-acoes.mjs --json`,
   `node scripts/auditoria/fantasmas.mjs --json`.
7. Conferir `/api/health` dos dois apps e a conexão do Socket.io.

**Saída:** ambiente de pé, falhas pré-existentes listadas no REGISTRO.md como
achados (não "consertadas por fora").

### Fase 1 — Inventário e varredura estática

Objetivo: saber tudo o que existe e onde as camadas não se encontram.

1. **Inventário de superfície**: todas as páginas (`page.tsx`), server actions
   (`"use server"`), rotas de API (`route.ts`), jobs do worker, eventos de tempo
   real e modelos Prisma. O `mapa-de-acoes.mjs` gera a base; complete à mão.
2. **Funcionalidades fantasma** (`fantasmas.mjs`): modelos que ninguém grava ou
   lê, filas sem worker, eventos sem ouvinte, ações que nenhuma tela chama,
   valores de enum nunca usados. Cada item vira linha no REGISTRO.md com
   veredito: _bug_, _pela metade_, _código morto_ ou _falso positivo_ (com o
   motivo).
3. **Botões e formulários órfãos**: para cada tela, listar cada controle
   interativo e a ação que ele dispara. Controle sem ação, ação que ignora um
   campo do formulário, campo do schema Zod que a tela nunca envia.
4. **Contratos entre camadas**: o schema Zod da ação bate com o modelo Prisma e
   com o formulário? Unidades (centavos × reais, gramas × kg), fuso
   (`America/Sao_Paulo`), nulos e defaults.
5. **Varredura de segurança automatizada**:
   - `semgrep --config p/owasp-top-ten --config p/typescript --config p/react --config p/nextjs`
   - `gitleaks detect` (segredos no histórico)
   - `pnpm audit --prod` ou `osv-scanner -r .` (dependências)
   - `trivy fs .` e, se houver imagens, `trivy image` (containers e configs)
   - o comando `/security-review` do Claude Code sobre o diff da rodada
     Ferramenta indisponível é registrada como pendência, não ignorada.
6. **Revisão manual de autorização**: cada linha marcada `!!` no mapa de ações.
   Confirmar no código se o id vindo da entrada é sempre filtrado pelo dono
   (`storeId`, `userId`, `courierId`) antes de qualquer leitura ou escrita.

**Saída:** REGISTRO.md com todos os achados estáticos, cada um com arquivo e
linha, severidade proposta e hipótese de como reproduzir.

### Fase 2 — Validação em runtime por perfil

Objetivo: executar de verdade cada jornada de JORNADAS.md e cada célula da
MATRIZ-DE-PERMISSOES.md.

Para **cada jornada**:

1. Executar no navegador (Playwright, viewport de celular, como o
   `playwright.config.ts` já define) com o usuário do seed daquele perfil.
2. A cada passo, verificar o fio completo: o que a tela mostra, o que foi
   gravado no banco (consulta SQL ou Prisma de verificação), o que foi
   publicado no Redis, o job criado no BullMQ, o aviso emitido (em dev, no log).
3. Abrir uma **segunda sessão** do outro perfil envolvido (ex.: lojista enquanto
   o cliente pede) e confirmar que a mudança chega sem recarregar quando a
   tela promete tempo real.
4. Recarregar a página e confirmar que o estado persistiu.
5. Repetir os caminhos de erro: campo inválido, rede lenta (3G simulado), clique
   duplo no botão de enviar, voltar no navegador, sessão expirada no meio,
   loja fechando durante o checkout, produto esgotado no carrinho.
6. Registrar contagem de passos, campos e pontos de dúvida para a frente de
   produto.

Para **cada célula da matriz**: chamar a ação/rota com cada perfil, inclusive
diretamente (fora da UI), e com o id de um registro de outra loja/usuário.
Resultado esperado × observado vai na própria matriz.

Os testes e2e escritos aqui ficam em `e2e/tests/` e passam a fazer parte da
suíte. Use os padrões de `e2e/tests/apoio.ts` e o estado de sessão por papel do
`global-setup.ts` (não contornar o rate limit de OTP baixando o limite).

**Saída:** cada jornada marcada _ok_, _falha_ (com achado) ou _bloqueada_ (com
motivo); matriz preenchida; evidências (trace, screenshot, consulta) em
`docs/revisao/evidencias/fase2/`.

### Fase 3 — LGPD e segurança aplicada

Executar LGPD.md item a item, com prova em runtime onde couber (exportar os
dados e conferir o conteúdo; excluir a conta e conferir o banco; tentar logar
de novo). Revisar cabeçalhos HTTP, cookies, rate limit, upload (tipo, tamanho,
conteúdo), webhooks (assinatura, idempotência, replay), logs (sem telefone,
CPF, token ou código OTP em produção) e auditoria das ações de admin. Usar o
OWASP ASVS 5.0 nível 2 como referência para os capítulos de autenticação,
sessão, controle de acesso, validação, dados sensíveis e logs.

### Fase 4 — Correção

Para cada achado aberto, em ordem de severidade:

1. Escrever o teste que reproduz (falha).
2. Corrigir com a menor mudança coerente.
3. Rodar o teste (passa), a suíte do pacote afetado e o typecheck.
4. Validar em runtime o fluxo afetado e o fluxo vizinho que pode ter quebrado.
5. Commit local na `main`, um achado por commit, mensagem no padrão do
   repositório (`fix(area): ...`) citando o id do achado (ex.: `R3-014`).
6. Atualizar a linha no REGISTRO.md: estado, commit, como foi validado.

Achado de produto (S3) que muda fluxo ou une telas: implementar só depois de
registrar a proposta em JORNADAS.md com o antes/depois em passos e campos.
Mudança de regra de negócio que não está clara no código ou nos documentos
**não é decidida pelo agente**: vira pergunta em REGISTRO.md, seção
"Decisões pendentes".

### Fase 5 — Verificação independente

Um agente que **não** fez a correção reexecuta, para cada achado fechado, o
roteiro de reprodução original e a jornada inteira afetada. Se falhar, o
achado volta para aberto. Ao final, rodar a suíte completa:
`pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e`, mais as duas
varreduras, e comparar com a linha de base da Fase 0.

### Fase 6 — Relatório de entrega

Atualizar `docs/IMPLEMENTATION_REPORT.md` (rodada 3) com: o que foi analisado,
o que foi corrigido (achado → commit → evidência), o que foi validado e como,
o antes/depois das jornadas em passos, e as pendências com motivo e próximo
passo. Nada de "tudo certo" genérico: cada afirmação aponta para uma evidência.

## 4. Definição de pronto

Um achado está **fechado** quando todos estes itens são verdadeiros:

- [ ] Há teste automatizado ou roteiro de reprodução que falhava e agora passa.
- [ ] O fluxo foi executado em runtime depois da correção, com evidência salva.
- [ ] O dado foi conferido no banco e relido de outra sessão/recarga.
- [ ] Perfis vizinhos foram conferidos (quem recebe o evento, quem não deveria ver).
- [ ] `pnpm typecheck` e os testes do pacote passam.
- [ ] O verificador independente (Fase 5) confirmou.

A **rodada** está pronta quando: nenhum S0/S1 aberto; todo S2 fechado ou
justificado; todas as jornadas _ok_ ou com pendência explicada; matriz de
permissões 100% preenchida; LGPD.md sem item "não atende" sem plano; suíte
completa verde; relatório escrito.

## 5. Como os agentes se dividem

Os agentes estão em `.claude/agents/`. A skill
`.claude/skills/revisao-ponta-a-ponta/` conduz a rodada.

| Agente               | Fases | Faz                                                        | Não faz                         |
| -------------------- | ----- | ---------------------------------------------------------- | ------------------------------- |
| `revisor-seguranca`  | 1, 3  | Autorização, IDOR, LGPD, segredos, dependências            | Mudança de UX                   |
| `revisor-integracao` | 1, 2  | Fio completo, fantasmas, contratos entre camadas, jornadas | Decidir regra de negócio        |
| `revisor-produto`    | 2     | Passos, campos, telas a unir, textos, acessibilidade       | Corrigir bug de backend         |
| `corretor`           | 4     | Reproduz, corrige, valida, faz commit                      | Fechar o próprio achado         |
| `verificador`        | 5     | Reexecuta reprodução e jornada; reabre o que falhar        | Corrigir (só reabre e descreve) |

Regras de convivência:

- **Um único ambiente de runtime** (banco, Redis, servidores) é compartilhado.
  Antes de uma rodada de testes e2e que muda dados, rodar `pnpm db:seed:e2e`.
  Revisores das fases 1–3 só leem código e usam o navegador; quem escreve
  código é o `corretor`, um achado por vez.
- Tudo acontece na `main`, no mesmo diretório: nada de branch nem worktree.
  Por isso as correções são sequenciais, nunca paralelas.
- Ninguém faz `git push`, deploy, `prisma migrate reset` no banco errado,
  ou chama provedor real (pagamento, WhatsApp, SMS) sem autorização expressa.
- Migration nova só quando a correção exigir, com nome descritivo e conferida
  em banco limpo (`migrate reset` **no banco local de dev**) e em banco
  semeado.

## 6. Referências usadas para montar este protocolo

- OWASP Next.js Security Cheat Sheet — server actions como endpoints públicos,
  autorização na camada de dados, IDOR, origem.
- OWASP ASVS 5.0 (maio/2025) — requisitos verificáveis por nível; usamos L2.
- ANPD — Guia orientativo de segurança da informação para agentes de
  tratamento de pequeno porte (2021) e checklist; LGPD arts. 6º, 7º, 8º, 9º,
  18, 37, 46 e 48.
- Playwright Test Agents (planner, generator, healer, v1.56+) e Playwright MCP
  para explorar jornadas e gerar/curar testes e2e.
- Anthropic `claude-code-security-review` e o comando `/security-review`.
- Semgrep (p/owasp-top-ten), gitleaks, OSV-Scanner e Trivy na varredura.
- Nielsen (10 heurísticas) + percurso cognitivo por tarefa; Baymard Institute
  (campos pesam mais que etapas; média de 11,3 campos no checkout contra 8
  necessários).
