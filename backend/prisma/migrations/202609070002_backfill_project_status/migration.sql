-- Si existen tareas, el avance se calcula con las tareas completadas. Para los
-- proyectos sin tareas se conserva la ultima actualizacion manual registrada.
UPDATE "iniciativas" AS initiative
SET "porcentaje_avance" = CASE
  WHEN EXISTS (
    SELECT 1
    FROM "tareas_iniciativa" AS task
    WHERE task."iniciativa_id" = initiative."id"
      AND task."deleted_at" IS NULL
  ) THEN (
    SELECT ROUND(
      100.0 * COUNT(*) FILTER (WHERE task."completada") / NULLIF(COUNT(*), 0)
    )::INTEGER
    FROM "tareas_iniciativa" AS task
    WHERE task."iniciativa_id" = initiative."id"
      AND task."deleted_at" IS NULL
  )
  ELSE COALESCE(
    (
      SELECT progress."porcentaje"
      FROM "progresos" AS progress
      WHERE progress."iniciativa_id" = initiative."id"
      ORDER BY progress."created_at" DESC
      LIMIT 1
    ),
    initiative."porcentaje_avance"
  )
END;

UPDATE "iniciativas"
SET "estado" = CASE
  WHEN "porcentaje_avance" >= 100 THEN 'Finalizado'::"Estado"
  WHEN "porcentaje_avance" > 0 THEN 'En_desarrollo'::"Estado"
  WHEN "estado" IN ('En_desarrollo', 'Finalizado') THEN 'Pendiente'::"Estado"
  ELSE "estado"
END;
