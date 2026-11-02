# Plano mestre da auditoria

Auditor-Chefe, 2026-11-02. A ordem segue o protocolo:

1. vulnerabilidade;
2. receita e isolamento;
3. perda de dados;
4. jornada essencial;
5. regressão;
6. gargalo medido;
7. produto.

A evidência detalhada de cada linha está em `ACHADOS_CONSOLIDADOS.md` e no parecer de origem.

## Executado (lotes 1 a 5)

| ID | Categoria | Problema comprovado | Evidência | Impacto | Prob. | Prior. | Correção | Teste de aceite | Estado |
|---|---|---|---|---|---|---|---|---|---|
| A1 | Segurança | Força bruta no OTP sob concorrência | R1-001 em runtime | Tomada de conta | Alta | P0 | Reserva atômica da tentativa (`otp.ts`) | 30 palpites paralelos + o certo = 0 logins | CORRIGIDO 4395f01, revalidado |
| A2 | Segurança / custo | IP forjável; limite do nginx global | R1-002 em runtime; R5-009 na configuração | Limites anulados; SMS pago | Alta | P0 | realip + `X-Real-IP`; limite por IP na action | Em produção, o IP real aparece em `otp_codes.requestIp` | CORRIGIDO 4395f01; produção a confirmar |
| A9 | Segurança | Token do gateway para qualquer lojista | R4-001 no código | Forjar SMS recebido | Média | P0 | Só SUPER_ADMIN | Lojista recebe 401 | CORRIGIDO 6f3ebdf |
| A8 | Isolamento | Funcionário vê o financeiro | R1-003 em runtime | Vazamento interno | Alta | P0 | Bloqueio na página | Operador vê "Só o dono…" | CORRIGIDO 4395f01 |
| M6 | Isolamento | Aceite de corrida de outra cidade ou loja | R3-012 no código | Corrida indevida | Baixa | P1 | Filtro no aceite | Id de outra cidade é recusado | CORRIGIDO 4395f01 |
| A3 | Receita | Pix na chave da loja invisível | R3-001 no código | Pedido pago perdido | Alta | P0 | "Pix para conferir" + `confirmarPixDaLoja` | Pedido PIE565883 → RECEIVED/PAID | CORRIGIDO 4395f01, revalidado |
| A4/A5 | Receita / dados | Webhook perde confirmação; disputas de status | R3-003, R3-004, R3-005 | Pago sem pedido; cancelado entregue | Média | P0 | Transação + updates condicionais | Revisão de código | CORRIGIDO 4395f01 |
| A12/A13 | Receita / jornada | Pix e cartão oferecidos sem poder ser pagos | R3-008, R3-013, C9 | Pedido travado | Alta | P0 | Só oferecer o que pode ser pago | O checkout sem gateway não mostra Pix da plataforma nem cartão | CORRIGIDO 4395f01, 30a21ee |
| A6 | Jornada | Fotos não carregam em produção | R5-001 por GET em produção | Cardápio sem foto | Alta | P0 | Host fixo + bucket no `proxy_pass` | `curl -I https://…/uploads/public/…` = 200 | CORRIGIDO 4395f01; produção a confirmar |
| A11 | Jornada | Dono sem senha preso fora do painel | R3-009, R2-005, R4-011 | Loja parada | Alta | P0 | Senha provisória na tela da loja; orientação no login | Card aparece para dono sem senha | CORRIGIDO 4395f01, 6f3ebdf |
| A10 | Custo | SMS para entregador pendente | R4-002 em runtime | SMS pago perdido | Média | P1 | `courier.status = ACTIVE` | Pendente não recebe código | CORRIGIDO 6f3ebdf |
| A14-A17 | Jornada | App na landing; opção não clicável; cadastro apaga campos; becos sem saída | R2-001…R2-007 | Desistência | Alta | P1 | Ver os commits | Revalidado por GET e Playwright | CORRIGIDO 6f3ebdf |
| A18 | Jornada | WebView sem upload e sem download | R2-016 no código | Receita e exportação | Média | P1 | APK 1.1 | Teste em aparelho | CORRIGIDO c5a6c06; aparelho a testar |
| M1-M3 | LGPD | Endereço mantido; termos não gravados; exportação sem registro | R1-004…R1-007 | Prova e minimização | Alta | P1 | `JsonNull`; `registrarAceiteDosTermos`; `DataRequest EXPORT` | 2 `consent_records`; 1 `data_request` | CORRIGIDO, revalidado |
| M4 | Infra | Segredos na linha de comando | R5-004 na configuração | Vazamento na VPS | Média | P1 | stdin + `%q` | Simulação local | CORRIGIDO 4395f01 |
| M5 | Dados | Redis descartaria jobs | R5-008 | Perda de jobs | Baixa | P1 | `noeviction` | Configuração | CORRIGIDO 4395f01 |
| M7-M20 | Vários | Ver `ACHADOS_CONSOLIDADOS.md` | — | — | — | P2 | — | — | CORRIGIDOS |

## Pendente: depende de decisão, acesso ou custo

| ID | Problema | Por que não foi feito agora | Quem decide | Próximo passo |
|---|---|---|---|---|
| A7 | Imagem do MinIO inexistente em registro público | Mudança de armazenamento com dados de produção | Dono / infra | (a) espelhar a imagem em cache na VPS para o GHCR; ou (b) migrar para outro S3 compatível, com backup e cópia dos objetos |
| A19 | Comissão do plano grátis e impulsionamento sem cobrança | Regra comercial | Dono | Definir como cobrar (fatura mensal, Pix) e o que o financeiro deve mostrar |
| A20 | Repasses nunca gerados | Modelo de repasse | Dono | Decidir se a plataforma recebe e repassa, ou se cada loja recebe direto |
| A21 | Estorno quando a loja cancela pedido pago | Depende do gateway real | Dono | Junto com P2 em `OPORTUNIDADES_PRODUTO.md` |
| A22 | Rollback, dump antes da migration, backup externo | Exige SSH à VPS (negado) e armazenamento externo (custo) | Dono / infra | Liberar acesso; escolher o destino do backup |
| A23 | Deploy como root por senha | Exige a VPS | Infra | Usuário de deploy com chave, `known_hosts` fixo |
| M26 | Alertas e monitor de disponibilidade | Serviço novo | Dono | Monitor externo gratuito do `/api/health` |
| P1-P3 | Notificação com app fechado, pagamento online, Play Store | Custo e conta de terceiros | Dono | Ver `OPORTUNIDADES_PRODUTO.md` |

## Pendente técnico, sem bloqueio (próxima rodada)

- **Corridas e idempotência:** cupom sob concorrência (M21); estorno parcial e idempotência do refund (M24).
- **Desempenho:** notificações fora das actions (M22); cache da vitrine (M27).
- **Funcionalidades:** criar funcionário da loja (M23 / P5); envio de documentos (M25); localização do entregador (P4).
- **Testes:** de integração do login (A24); e2e menos frágil (M30).
- **Uso:** busca com sinônimos (M31); layout do painel no celular (M32).
- **Repositório:** `.gitattributes` para o CRLF (R4-012).
