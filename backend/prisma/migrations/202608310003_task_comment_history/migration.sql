CREATE TABLE "tarea_comentarios" (
  "id" UUID NOT NULL,
  "tarea_id" UUID NOT NULL,
  "usuario_id" UUID NOT NULL,
  "contenido" VARCHAR(600) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tarea_comentarios_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "tarea_comentarios_tarea_id_created_at_idx" ON "tarea_comentarios"("tarea_id", "created_at");
ALTER TABLE "tarea_comentarios" ADD CONSTRAINT "tarea_comentarios_tarea_id_fkey" FOREIGN KEY ("tarea_id") REFERENCES "tareas_iniciativa"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tarea_comentarios" ADD CONSTRAINT "tarea_comentarios_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
INSERT INTO "tarea_comentarios" ("id","tarea_id","usuario_id","contenido","created_at")
SELECT gen_random_uuid(),t.id,p."usuario_id",t.comentario,COALESCE(t."updated_at",CURRENT_TIMESTAMP)
FROM "tareas_iniciativa" t
JOIN LATERAL (SELECT "usuario_id" FROM "progresos" WHERE "iniciativa_id"=t."iniciativa_id" ORDER BY "created_at" DESC LIMIT 1) p ON TRUE
WHERE t.comentario IS NOT NULL AND t.comentario <> '';
