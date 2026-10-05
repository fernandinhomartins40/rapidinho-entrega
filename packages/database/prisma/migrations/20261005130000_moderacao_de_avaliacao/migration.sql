-- Moderação de avaliações: comentário ocultado pela plataforma deixa de aparecer
-- na página pública da loja. Coluna nova e nula: nenhum dado existente muda.
ALTER TABLE "reviews" ADD COLUMN "hiddenAt" TIMESTAMP(3);
