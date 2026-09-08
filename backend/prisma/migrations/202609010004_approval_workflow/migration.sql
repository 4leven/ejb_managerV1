ALTER TYPE "TipoEntidad" ADD VALUE IF NOT EXISTS 'Requerimiento';
ALTER TYPE "TipoEntidad" ADD VALUE IF NOT EXISTS 'Documento';

ALTER TABLE "objetivos_negocio"
  ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "deleted_by_id" UUID;

ALTER TABLE "solicitudes_cambio"
  ADD COLUMN IF NOT EXISTS "snapshot" JSONB,
  ADD COLUMN IF NOT EXISTS "etapas" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS "etapa_actual" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "decisiones" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS "motivo_resolucion" VARCHAR(500);

CREATE INDEX IF NOT EXISTS "idx_solicitudes_solicitante_fecha"
  ON "solicitudes_cambio"("solicitante_id", "created_at");
