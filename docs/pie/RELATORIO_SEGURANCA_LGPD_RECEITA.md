# Relatório de segurança, LGPD e proteção de receita

Auditor-Chefe, 2026-11-02. Fonte primária: `BANCA_R1_SEGURANCA.md`, complementada por R3, R4 e R5. Escopo: código em `d65c0e5` e correções até `d2d425e`; runtime local (web :3200, painel :3201). Produção: só GET público. Este relatório **não** declara conformidade jurídica com a LGPD nem segurança absoluta.

## 1. Identidade, sessão e autenticação

| Controle | Antes (d65c0e5) | Agora | Prova |
|---|---|---|---|
| Limite de tentativas do código SMS | Furável por concorrência: 30 palpites paralelos entraram na conta (R1-001) | Tentativa reservada atomicamente antes de comparar; consumo condicional | 3 execuções: 0 logins, `attempts=5`; o login legítimo continua funcionando |
| IP para os limites | Primeiro `X-Forwarded-For`, controlado pelo cliente (R1-002) | `X-Real-IP` reescrito pelo nginx, com realip só de redes privadas | Código e `nginx -t`. Precisa ser confirmado em produção |
| Limite de pedido de código por IP | Ausente na action (R4-003) | 30 a cada 15 min por IP; o teto é folgado por causa do CGNAT do interior | Código |
| Rotas duplicadas `/api/auth/otp/*` | Sem consumidor e fora da regra "só no app" (R3-018) | Removidas | `git rm` em 4395f01 |
| SMS só para entregador ativo | Ia também para cadastro pendente (R4-002) | Confere `courier.status = ACTIVE` | Código; o R4 reproduziu o defeito antes |
| Login por SMS de telefone fixo | Aceito, com SMS pago perdido (R2-013) | Só celular | Teste unitário |
| Token do gateway de SMS | Liberado a qualquer lojista com senha (R4-001) | Só SUPER_ADMIN | Código |
| Troca de senha | Não derrubava outras sessões (R4-009) | Revoga as outras sessões, mantém a atual | Código |
| Senha provisória | Revoga todas as sessões | Igual; também na tela da loja | R4 RT |
| Redirecionamento aberto `/entrar` | `307` para site externo com sessão (R4-008) | Só caminho interno | Runtime: `Location: /` |
| Regra "só no app" (user-agent) | Forjável por desenho | Igual. Não é barreira de segurança; o que protege o custo são os limites por telefone e IP | `app-nativo.ts` |
| Sessão de 400 dias | Renovação deslizante | Igual. O cookie renovado sem sessão válida não dá acesso (a sessão é conferida no banco) | R3-028 |

## 2. Autorização e isolamento

Testado por R1 em runtime, sem achado:

- isolamento entre lojas nas server actions (o `storeId` vem do vínculo, nunca do formulário);
- pedido de outro cliente;
- elevação de papel no painel;
- "modo lojista" do super admin (validado no banco, expira em 1 h);
- uploads sem sessão (401);
- `/api/sms/*` sem token (401).

Achados e situação:

- **Funcionário vendo o financeiro (R1-003):** corrigido.
- **Aceite de corrida fora da cidade ou da loja (R3-012):** corrigido.
- **Busca de usuários sem filtro (R4-006):** corrigido; era um risco operacional de agir na pessoa errada.

## 3. Receita e pagamentos

| Fluxo | Situação |
|---|---|
| Total calculado no servidor; quantidade e produto validados | Sem achado (R1) |
| Webhook: assinatura HMAC, replay e dedupe | Sem achado no que R1 testou. A perda de confirmação em falha parcial (R3-003) foi **corrigida** |
| Disputa entre a expiração do Pix e o webhook | **Corrigida** (updates condicionais) |
| Pix na chave da loja sem confirmação | **Corrigido** (botão "Recebi o Pix", auditado como `order.pix_confirmed`) |
| Pix e cartão oferecidos sem poder ser pagos | **Corrigido** (Pix só com chave ou gateway real; cartão escondido) |
| Cupom: regra correta; limite de uso sob concorrência | Regra sem achado. A concorrência (R3-011) é FORTE INDÍCIO e está **pendente** |
| Comissão do plano grátis nunca faturada; impulsionamento sem cobrança | **Pendente: decisão comercial** (R3-006, R3-007). Hoje é perda de receita, não fraude de terceiros |
| Repasses nunca gerados | **Pendente: modelo de repasse** (R3-010) |
| Custo de SMS (abuso) | Mitigado: limites por telefone e por IP real, só celular, só entregador ativo. Recomenda-se um teto diário global (pendente) |

## 4. Injeção, configuração e cadeia de suprimentos

R1 verificou sem achado:

- CSP com nonce e `strict-dynamic`;
- headers do nginx e do Next;
- XSS nos campos livres testados;
- canal do realtime com token assinado;
- Sentry com remoção de e-mail, telefone e IP;
- importação de produtos por arquivo, não por URL, portanto sem vetor de SSRF.

Configuração:

- **Segredos do deploy:** saíram da linha de comando do ssh (R5-004, corrigido).
- **Deploy como root por senha, sem verificar a chave do host (R5-003):** pendente, porque exige acesso à VPS.
- **`/uploads`:** passou a enviar `X-Content-Type-Options: nosniff` e a ocultar `Set-Cookie`.

## 5. LGPD (controles técnicos)

| Item | Situação |
|---|---|
| Prova da ciência dos termos e da privacidade | **Corrigido:** gravada no login (cliente e entregador) em `consent_records`, com versão (`VERSAO_DOS_TERMOS`) e IP. A loja não aceita mais em nome do entregador |
| Exportação (acesso) | Funciona; agora registra `DataRequest EXPORT` e baixa também dentro do app |
| Exclusão | Anonimiza; agora apaga também o endereço dos pedidos (`Prisma.JsonNull`) |
| Tela de atendimento dos pedidos do titular no admin | Pendente |
| Consentimento de marketing nas campanhas (antigo R3-008) | Não reavaliado nesta rodada; segue pendente da rodada 3 |
| Retenção de OTP e de sessões | A limpeza existe no código e nunca é agendada (R3-025): pendente |
| Dados pessoais nos relatórios desta auditoria | Nenhum segredo nem dado real foi escrito. Os telefones citados são sintéticos de teste |

**Para o encarregado ou o jurídico** (fora do alcance técnico):

- base legal por finalidade;
- prazos de retenção;
- texto dos termos e da política;
- canal do titular.

## 6. O que não foi testado

- Produção além de GET público, porque o SSH foi negado.
- O APK num aparelho real.
- Carga e concorrência real no cupom e na separação.
- O consentimento de marketing nas campanhas.
