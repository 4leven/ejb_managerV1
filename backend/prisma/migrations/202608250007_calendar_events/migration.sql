CREATE TABLE "eventos" (
  "id" UUID NOT NULL, "titulo" VARCHAR(180) NOT NULL, "descripcion" VARCHAR(800),
  "inicio" TIMESTAMP(3) NOT NULL, "fin" TIMESTAMP(3) NOT NULL,
  "icono" VARCHAR(12) NOT NULL DEFAULT '📅', "color_hex" VARCHAR(7) NOT NULL DEFAULT '#2F6FED',
  "prioridad" VARCHAR(20) NOT NULL DEFAULT 'Normal', "estado" VARCHAR(30) NOT NULL DEFAULT 'Programado',
  "area_id" UUID NOT NULL, "creador_id" UUID NOT NULL, "asignado_id" UUID, "iniciativa_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "eventos_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "eventos_area_id_inicio_idx" ON "eventos"("area_id", "inicio");
CREATE INDEX "eventos_asignado_id_inicio_idx" ON "eventos"("asignado_id", "inicio");
ALTER TABLE "eventos" ADD CONSTRAINT "eventos_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "areas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "eventos" ADD CONSTRAINT "eventos_creador_id_fkey" FOREIGN KEY ("creador_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "eventos" ADD CONSTRAINT "eventos_asignado_id_fkey" FOREIGN KEY ("asignado_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "eventos" ADD CONSTRAINT "eventos_iniciativa_id_fkey" FOREIGN KEY ("iniciativa_id") REFERENCES "iniciativas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
