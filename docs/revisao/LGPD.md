# LGPD — verificações técnicas

Não há checklist oficial da ANPD específico para desenvolvimento de software.
Esta lista traduz os artigos da Lei 13.709/2018 e o _Guia orientativo de
segurança da informação para agentes de tratamento de pequeno porte_ (ANPD, 2021) em itens verificáveis neste código. Cada item recebe: **atende**,
**atende parcialmente**, **não atende** ou **não se aplica**, com evidência
(arquivo:linha e, quando der, teste em runtime).

Isto não substitui parecer jurídico. Pontos que dependem de decisão do
controlador (base legal, prazos de retenção, texto da política) vão para
"Decisões pendentes" no REGISTRO.md.

## Dados tratados (mapa inicial — confirmar no schema)

| Titular    | Dados                                                        | Finalidade            | Base legal provável (art. 7º)                            |
| ---------- | ------------------------------------------------------------ | --------------------- | -------------------------------------------------------- |
| Cliente    | nome, telefone, e-mail, endereços, pedidos, avaliações, push | executar o pedido     | execução de contrato (V)                                 |
| Cliente    | receita médica (farmácia)                                    | dispensar medicamento | **dado sensível de saúde — art. 11**                     |
| Cliente    | campanhas de marketing                                       | promoção              | consentimento (I) ou legítimo interesse (IX) com opt-out |
| Lojista    | nome, telefone, CPF/CNPJ, dados bancários/Pix, documentos    | cadastro e repasse    | contrato (V), obrigação legal (II)                       |
| Entregador | nome, telefone, CPF, veículo, documentos, localização        | cadastro e corrida    | contrato (V)                                             |
| Todos      | IP, user agent, logs de auditoria                            | segurança, prova      | legítimo interesse (IX), Marco Civil art. 15             |

## Verificações

### Transparência e consentimento (arts. 6º VI, 8º, 9º)

| #   | Verificação                                                                        | Onde olhar                                                                       | Situação inicial        |
| --- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ----------------------- |
| T1  | Política de privacidade e termos acessíveis antes do cadastro, com versão          | `/privacidade`, `/termos`, `/entrar`                                             | a verificar             |
| T2  | O aceite do **cliente** é gravado com data e versão (prova do art. 8º §2º)         | `entrar/actions.ts:35` diz "termos vêm no checkout"; checkout não grava          | **não atende** (R3-001) |
| T3  | `ConsentRecord` (histórico de versão, IP) é usado                                  | nenhum código grava ou lê                                                        | **não atende** (R3-001) |
| T4  | Aceite é dado pelo próprio titular — nunca por terceiro em nome dele               | `loja/entregadores/actions.ts:65` grava aceite do entregador convidado pela loja | **não atende** (R3-007) |
| T5  | Marketing (campanhas) só para quem consentiu ou com opt-out claro em cada mensagem | `admin/notificacoes/actions.ts`, worker de campanhas                             | a verificar (R3-008)    |
| T6  | Mudança de versão dos termos pede novo aceite                                      | —                                                                                | a verificar             |

### Direitos do titular (art. 18)

| #   | Verificação                                                                                   | Onde olhar                                   | Situação inicial                                                                                             |
| --- | --------------------------------------------------------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| D1  | Confirmação e acesso: exportação inclui **todos** os dados pessoais do titular                | `conta/dados/actions.ts` `exportarMeusDados` | parcial: conferir favoritos, push, carrinho, receitas, sessões em grupo, `CityInterest`, logs de notificação |
| D2  | Portabilidade: formato estruturado (JSON) e legível                                           | idem                                         | a verificar                                                                                                  |
| D3  | Exportação registra `DataRequest` `EXPORT` (prova de atendimento)                             | enum `DataRequestType.EXPORT` nunca usado    | **não atende**                                                                                               |
| D4  | Eliminação: excluir conta anonimiza o que precisa ficar (pedido fiscal) e apaga o resto       | `excluirMinhaConta`                          | a verificar em runtime: receitas no MinIO, sessões, push, OTP, favoritos                                     |
| D5  | Depois de excluir, login com o mesmo telefone cria conta nova limpa, sem herdar nada          | runtime                                      | a verificar                                                                                                  |
| D6  | Lojista e entregador também conseguem exercer os direitos (hoje só há tela no app do cliente) | `/conta/dados` só no web                     | a verificar                                                                                                  |
| D7  | Alguém na plataforma vê e conclui os `DataRequest` dentro do prazo                            | nenhuma tela lê `DataRequest`                | **não atende** (R3-001b)                                                                                     |
| D8  | Correção de dados: o titular edita nome, telefone, e-mail, endereço                           | `/conta`                                     | a verificar                                                                                                  |

### Minimização, necessidade e retenção (art. 6º III, art. 15, 16)

| #   | Verificação                                                                                          | Situação inicial      |
| --- | ---------------------------------------------------------------------------------------------------- | --------------------- |
| M1  | Telefone/endereço do cliente aparece para a loja e o entregador **só** durante o pedido ativo        | a verificar           |
| M2  | O entregador vê só o necessário (nome, endereço, telefone mascarado ou temporário?)                  | a verificar           |
| M3  | Receitas médicas: acesso restrito à loja do pedido; URL não pública; prazo de descarte               | a verificar (art. 11) |
| M4  | `OtpCode`, `Session` expiradas, `NotificationLog`, `AuditLog`: há rotina de limpeza e prazo definido | a verificar           |
| M5  | Localização do entregador: só durante corrida, não guardada além do necessário                       | R3-003                |
| M6  | Exportação e telas de admin não expõem dado além do necessário (CPF completo, etc.)                  | a verificar           |

### Segurança (art. 46, Guia ANPD)

| #   | Verificação                                                                                                           | Situação inicial                                                                                                        |
| --- | --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| S1  | Controle de acesso por perfil e por tenant (MATRIZ-DE-PERMISSOES.md 100% verde)                                       | a verificar                                                                                                             |
| S2  | Senha do super admin com hash forte; política mínima; troca da senha provisória obrigatória                           | a verificar (`packages/auth/src/senha.ts`)                                                                              |
| S3  | OTP: expira, tentativas limitadas, rate limit por telefone e IP, código nunca em log/resposta fora de `development`   | `otp/request/route.ts:61` usa `NODE_ENV === 'development'`: conferir que a imagem de produção nunca roda com esse valor |
| S4  | Cookies `HttpOnly`, `Secure` em produção, `SameSite`; sessão revogada ao bloquear usuário                             | a verificar                                                                                                             |
| S5  | Cabeçalhos: CSP, `X-Frame-Options`/`frame-ancestors`, HSTS no Nginx                                                   | a verificar (`docker/nginx`, `next.config.mjs`)                                                                         |
| S6  | Logs sem telefone completo, CPF, token, OTP, conteúdo de receita                                                      | a verificar (`packages/services/src/logger.ts`)                                                                         |
| S7  | Segredos fora do repositório e do histórico (`gitleaks`)                                                              | a verificar                                                                                                             |
| S8  | Backups do Postgres cifrados ou em local de acesso restrito; restauração testada                                      | a verificar (`scripts/backup-postgres.sh`)                                                                              |
| S9  | Uploads: tipo verificado pelo conteúdo, tamanho máximo, sem SVG executável, bucket privado para documentos e receitas | a verificar                                                                                                             |
| S10 | Webhook de pagamento com assinatura verificada e idempotência                                                         | a verificar                                                                                                             |
| S11 | Ações administrativas e impersonation auditadas com quem, quando, IP e motivo                                         | parcial: auditoria existe; encerrar impersonation não tem botão (R3-002)                                                |
| S12 | Dependências sem vulnerabilidade alta/crítica conhecida (`pnpm audit --prod`, `osv-scanner`)                          | a verificar                                                                                                             |

### Incidentes e governança (arts. 37, 41, 48)

| #   | Verificação                                                            | Situação inicial                                       |
| --- | ---------------------------------------------------------------------- | ------------------------------------------------------ |
| G1  | Canal do encarregado (DPO) publicado na política de privacidade        | a verificar                                            |
| G2  | Sentry/observabilidade não envia dado pessoal (scrubbing configurado)  | a verificar (`packages/services/src/observability.ts`) |
| G3  | Registro das operações de tratamento (art. 37) — o mapa acima, mantido | rascunho neste arquivo                                 |
| G4  | Procedimento de comunicação de incidente à ANPD e titulares (art. 48)  | documento, fora do código: pendência do controlador    |
