-- El sistema solicitado parte sin datos operativos.
TRUNCATE TABLE "iniciativas", "usuarios", "objetivos_negocio" RESTART IDENTITY CASCADE;

CREATE TYPE "Cargo" AS ENUM ('Gerente', 'Asistente', 'Trabajador');

ALTER TABLE "usuarios"
  DROP COLUMN "nombre",
  ADD COLUMN "nombres" VARCHAR(100) NOT NULL,
  ADD COLUMN "apellidos" VARCHAR(100) NOT NULL,
  ADD COLUMN "password_hash" VARCHAR(255) NOT NULL,
  ADD COLUMN "cargo" "Cargo" NOT NULL;
