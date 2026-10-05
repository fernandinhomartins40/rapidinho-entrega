-- Pausa com prazo do sabor de pizza ("acabou hoje"), separada da exclusão
-- lógica feita por isAvailable. Coluna nova e nula: nenhum dado existente muda.
ALTER TABLE "pizza_flavors" ADD COLUMN "pausedUntil" TIMESTAMP(3);
