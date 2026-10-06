-- Senha opcional: hoje só o operador do app gateway de SMS entra com ela.
ALTER TABLE "users" ADD COLUMN "passwordHash" TEXT;
