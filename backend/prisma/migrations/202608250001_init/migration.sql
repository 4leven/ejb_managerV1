-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('Admin', 'Comite', 'Usuario');

-- CreateEnum
CREATE TYPE "Esfuerzo" AS ENUM ('Bajo', 'Medio', 'Alto');

-- CreateEnum
CREATE TYPE "Estado" AS ENUM ('Backlog', 'En_evaluacion', 'Priorizado', 'En_desarrollo');

-- CreateTable
CREATE TABLE "areas" (
    "id" UUID NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "color_hex" VARCHAR(7) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "areas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "objetivos_negocio" (
    "id" UUID NOT NULL,
    "nombre" VARCHAR(150) NOT NULL,
    "descripcion" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "objetivos_negocio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios" (
    "id" UUID NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "email" VARCHAR(150) NOT NULL,
    "area_id" UUID NOT NULL,
    "rol" "Rol" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "iniciativas" (
    "id" UUID NOT NULL,
    "codigo" VARCHAR(10) NOT NULL,
    "titulo" VARCHAR(200) NOT NULL,
    "descripcion" TEXT NOT NULL,
    "area_id" UUID NOT NULL,
    "objetivo_id" UUID,
    "impacto" INTEGER NOT NULL,
    "esfuerzo" "Esfuerzo" NOT NULL,
    "score" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "estado" "Estado" NOT NULL DEFAULT 'Backlog',
    "responsable_id" UUID,
    "porcentaje_avance" INTEGER NOT NULL DEFAULT 0,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_actualizacion" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "iniciativas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "areas_nombre_key" ON "areas"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE UNIQUE INDEX "iniciativas_codigo_key" ON "iniciativas"("codigo");

-- CreateIndex
CREATE INDEX "idx_iniciativas_estado" ON "iniciativas"("estado");

-- CreateIndex
CREATE INDEX "idx_iniciativas_area" ON "iniciativas"("area_id");

-- CreateIndex
CREATE INDEX "idx_iniciativas_score" ON "iniciativas"("score" DESC);

-- CreateIndex
CREATE INDEX "idx_iniciativas_responsable" ON "iniciativas"("responsable_id");

-- Reglas de integridad que Prisma no expresa directamente en el schema.
ALTER TABLE "iniciativas"
  ADD CONSTRAINT "iniciativas_impacto_check" CHECK ("impacto" BETWEEN 1 AND 10),
  ADD CONSTRAINT "iniciativas_avance_check" CHECK ("porcentaje_avance" BETWEEN 0 AND 100),
  ADD CONSTRAINT "iniciativas_responsable_priorizado_check"
    CHECK ("estado" <> 'Priorizado' OR "responsable_id" IS NOT NULL);

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "areas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "iniciativas" ADD CONSTRAINT "iniciativas_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "areas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "iniciativas" ADD CONSTRAINT "iniciativas_objetivo_id_fkey" FOREIGN KEY ("objetivo_id") REFERENCES "objetivos_negocio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "iniciativas" ADD CONSTRAINT "iniciativas_responsable_id_fkey" FOREIGN KEY ("responsable_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
