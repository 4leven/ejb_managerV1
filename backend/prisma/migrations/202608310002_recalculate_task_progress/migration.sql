UPDATE "iniciativas" AS initiative
SET "porcentaje_avance" = CASE
  WHEN totals.total = 0 THEN 0
  ELSE ROUND((totals.completed::numeric / totals.total::numeric) * 100)::integer
END
FROM (
  SELECT i.id, COUNT(t.id) AS total, COUNT(t.id) FILTER (WHERE t.completada = TRUE) AS completed
  FROM "iniciativas" i
  LEFT JOIN "tareas_iniciativa" t ON t."iniciativa_id" = i.id
  GROUP BY i.id
) AS totals
WHERE initiative.id = totals.id;
