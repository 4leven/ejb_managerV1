ALTER TYPE "Estado" RENAME VALUE 'Backlog' TO 'Pendiente';
ALTER TABLE "usuarios" ADD COLUMN "portal_color" VARCHAR(7) NOT NULL DEFAULT '#0B2347';

CREATE TABLE "progresos" (
  "id" UUID NOT NULL,
  "iniciativa_id" UUID NOT NULL,
  "usuario_id" UUID NOT NULL,
  "porcentaje" INTEGER NOT NULL,
  "comentario" VARCHAR(500) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "progresos_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "progresos_porcentaje_check" CHECK ("porcentaje" BETWEEN 0 AND 100)
);
CREATE INDEX "idx_progresos_iniciativa" ON "progresos"("iniciativa_id");
ALTER TABLE "progresos" ADD CONSTRAINT "progresos_iniciativa_id_fkey" FOREIGN KEY ("iniciativa_id") REFERENCES "iniciativas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "progresos" ADD CONSTRAINT "progresos_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
