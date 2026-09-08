ALTER TABLE "tareas_iniciativa" ADD COLUMN "prioridad" VARCHAR(20) NOT NULL DEFAULT 'Normal';
ALTER TABLE "tareas_iniciativa" ADD COLUMN "responsable_id" UUID;
ALTER TABLE "tareas_iniciativa" ADD COLUMN "recordatorio_at" TIMESTAMP(3);
ALTER TABLE "tareas_iniciativa" ADD COLUMN "adjuntos" JSONB NOT NULL DEFAULT '[]';
CREATE INDEX "tareas_iniciativa_responsable_id_estado_idx" ON "tareas_iniciativa"("responsable_id", "estado");
ALTER TABLE "tareas_iniciativa" ADD CONSTRAINT "tareas_iniciativa_responsable_id_fkey" FOREIGN KEY ("responsable_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
