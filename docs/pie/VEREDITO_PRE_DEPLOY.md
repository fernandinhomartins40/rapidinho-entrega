# Veredito pré-deploy

Auditor-Chefe, 2026-11-02.

## 1. Veredito inicial (commit `d65c0e5`, antes das correções)

**REPROVADO.**

Havia bloqueadores confirmados no escopo, conforme o critério do protocolo (§2.4):

1. **Vulnerabilidade crítica explorável:** força bruta no código de login (R1-001), provada em runtime com tomada de conta.
2. **Limites de abuso anulados:** IP forjável (R1-002), com abuso direto do crédito de SMS pago.
3. **Perda de receita e de pedido pago:** Pix na chave da loja invisível para a loja (R3-001); webhook que perde a confirmação em falha parcial (R3-003).
4. **Falha essencial em produção:** fotos não carregam (R5-001, observado por GET público).
5. **Jornada essencial quebrada para um perfil inteiro:** lojista sem senha fora do painel (R3-009, R2-005); app nativo abrindo na propaganda (R2-001); complemento obrigatório que não marcava pelo nome (R2-002).
6. **Acesso indevido a dados:** funcionário vendo o financeiro (R1-003); token do gateway liberado a qualquer lojista (R4-001).

Pareceres de origem:

| Revisor | Recomendação |
|---|---|
| R1 | REPROVAR |
| R2 | APROVADO COM RESSALVAS, condicionado às correções de prioridade alta |
| R3 | REPROVAR para pagamento online e faturamento |
| R4 | Não pronto para liberar |
| R5 | DESFAVORÁVEL à operação |

## 2. Veredito pós-correção (commit `aef53aa`, main local)

### Veredito geral

**APROVADO PARA DEPLOY, com ressalvas.** A aprovação vale para o código corrigido. Os itens que só se comprovam em produção ficam **NÃO COMPROVADOS** até a verificação pós-deploy da seção 3. A prontidão de **recuperação da infraestrutura** está **REPROVADA** e depende de decisões do dono.

Fundamento:

- Todos os bloqueadores do veredito inicial foram corrigidos e revalidados em runtime: A1, A2 (no app), A3, A4, A6 (configuração), A8, A9, A11, A14 e A15.
- Um verificador independente tentou reprová-los. 9 de 11 vetores resistiram de primeira; os 2 reabertos foram corrigidos e revalidados.
- Typecheck 9/9, lint 9/9, 195 testes unitários e as 16 jornadas e2e passaram.
- Não sobrou bloqueador confirmado no código, dentro do escopo.

A aprovação **não** significa segurança absoluta nem conformidade jurídica com a LGPD.

### Por área

| Área | Veredito | Motivo |
|---|---|---|
| Segurança do código (autenticação, autorização, isolamento) | APROVADO | Crítico e altos corrigidos; revalidação adversarial independente |
| Jornadas essenciais (pedir, pagar em dinheiro ou Pix da loja, acompanhar, cancelar, operar a loja, aprovar loja) | APROVADO | E2E 16/16 + Playwright dirigido |
| Receita | APROVADO COM RESSALVA | Pagamentos protegidos. A cobrança da comissão do plano grátis, do impulsionamento e dos repasses **nunca acontece** (A19, A20): regra comercial pendente, sem regressão |
| LGPD (controles técnicos) | APROVADO COM RESSALVA | Aceite com versão, exportação registrada, exclusão completa. Falta a tela de atendimento do titular e a revisão jurídica |
| Produção: fotos (A6) e IP real (A2, parte do nginx) | NÃO COMPROVADO | Corrigido na configuração; só se prova depois do deploy |
| Recuperação e continuidade (A7 MinIO, A22 backup externo e rollback, A23 acesso) | REPROVADO | Riscos altos sem correção possível nesta sessão (SSH negado, decisão de infraestrutura e custo) |
| Completude como produto de delivery | NÃO COMPROVADO para larga escala | Núcleo completo e funcional. Faltam notificação com app fechado, pagamento online e Play Store (`OPORTUNIDADES_PRODUTO.md`) |

## 3. Verificação obrigatória depois do deploy (somente leitura)

1. `curl -I https://rapidinhoentrega.com.br/uploads/public/<chave de uma imagem real>` deve dar **200** com `Cache-Control: public, max-age=31536000, immutable` (A6).
2. Depois de um login real, `otp_codes.requestIp` deve mostrar IPs públicos distintos, e não o gateway do Docker (A2).
3. Abrir o site no celular com o APK 1.1: abre direto nas lojas; foto da receita sobe; "Exportar meus dados" baixa (A14, A18).
4. Painel: um lojista sem senha aparece com o cartão "Acesso do dono ao painel" na tela da loja (A11).
