CREATE TABLE "huddles" (
  "id" UUID NOT NULL,
  "sala_id" VARCHAR(80) NOT NULL,
  "contexto" VARCHAR(20) NOT NULL,
  "contexto_id" VARCHAR(80) NOT NULL,
  "iniciado_por_id" UUID NOT NULL,
  "estado" VARCHAR(20) NOT NULL DEFAULT 'activa',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finalizada_at" TIMESTAMP(3),
  CONSTRAINT "huddles_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "huddles_sala_id_key" ON "huddles"("sala_id");
CREATE INDEX "huddles_contexto_contexto_id_estado_idx" ON "huddles"("contexto", "contexto_id", "estado");
ALTER TABLE "huddles" ADD CONSTRAINT "huddles_iniciado_por_id_fkey" FOREIGN KEY ("iniciado_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
