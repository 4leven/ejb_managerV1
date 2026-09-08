ALTER TYPE "Cargo" ADD VALUE IF NOT EXISTS 'Jefe';
ALTER TYPE "Cargo" ADD VALUE IF NOT EXISTS 'Administracion';
ALTER TABLE iniciativas ADD COLUMN IF NOT EXISTS creador_id UUID;
ALTER TABLE objetivos_negocio ADD COLUMN IF NOT EXISTS creador_id UUID;
ALTER TABLE objetivos_negocio ADD COLUMN IF NOT EXISTS area_id UUID;
ALTER TABLE mensajes ADD COLUMN IF NOT EXISTS eliminado_at TIMESTAMP(3);
-- Recover ownership only from a real creation audit, never from assignment.
UPDATE iniciativas i SET creador_id = a.creador_id FROM (
 SELECT DISTINCT ON (datos->>'entidadId') datos->>'entidadId' AS entity_id, creador_id
 FROM registros_portal WHERE tipo='auditoria' AND datos->>'accion'='Crear' AND datos->>'entidad'='Iniciativa'
 ORDER BY datos->>'entidadId', created_at ASC
) a WHERE i.id::text=a.entity_id AND i.creador_id IS NULL;
