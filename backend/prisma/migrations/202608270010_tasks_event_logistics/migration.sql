CREATE TABLE "tareas_iniciativa" (
  "id" UUID NOT NULL,
  "iniciativa_id" UUID NOT NULL,
  "titulo" VARCHAR(220) NOT NULL,
  "estado" VARCHAR(30) NOT NULL DEFAULT 'Pendiente',
  "completada" BOOLEAN NOT NULL DEFAULT false,
  "comentario" VARCHAR(600),
  "completada_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "tareas_iniciativa_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "tareas_iniciativa_iniciativa_id_fkey" FOREIGN KEY ("iniciativa_id") REFERENCES "iniciativas"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "tareas_iniciativa_iniciativa_id_estado_idx" ON "tareas_iniciativa"("iniciativa_id", "estado");
ALTER TABLE "eventos" ADD COLUMN "software" VARCHAR(120), ADD COLUMN "plataforma" VARCHAR(30), ADD COLUMN "empresa" VARCHAR(160), ADD COLUMN "sala" VARCHAR(60), ADD COLUMN "comentarios" VARCHAR(800);
