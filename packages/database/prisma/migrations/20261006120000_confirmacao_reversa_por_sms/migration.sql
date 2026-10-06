-- Confirmação reversa por SMS: o cliente envia o código do telefone dele e o
-- gateway (app Android da operação) avisa o servidor. Colunas novas e nulas:
-- os códigos existentes continuam valendo como antes.
ALTER TABLE "otp_codes" ADD COLUMN "browserTokenHash" TEXT,
ADD COLUMN "confirmedAt" TIMESTAMP(3);
