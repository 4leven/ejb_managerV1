ALTER TABLE "iniciativas" ADD COLUMN "cliente" VARCHAR(160);
ALTER TABLE "tareas_iniciativa" ADD COLUMN "fecha_inicio" DATE;
ALTER TABLE "tareas_iniciativa" ADD COLUMN "fecha_fin" DATE;
CREATE INDEX "idx_iniciativas_cliente" ON "iniciativas"("cliente");
