CREATE TYPE "EstadoSolicitud" AS ENUM ('Pendiente','Aprobada','Rechazada');
CREATE TYPE "AccionSolicitud" AS ENUM ('Editar','Eliminar');
CREATE TYPE "TipoEntidad" AS ENUM ('Iniciativa','Objetivo');

ALTER TABLE "usuarios"
  ADD COLUMN "dark_mode" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "foto_perfil" TEXT,
  ADD COLUMN "reset_token_hash" VARCHAR(64),
  ADD COLUMN "reset_expires" TIMESTAMP(3);

ALTER TABLE "iniciativas"
  ADD COLUMN "fecha_inicio" DATE,
  ADD COLUMN "fecha_fin" DATE;

CREATE TABLE "mensajes" (
  "id" UUID NOT NULL,
  "remitente_id" UUID NOT NULL,
  "destinatario_id" UUID NOT NULL,
  "contenido" VARCHAR(2000) NOT NULL,
  "leido_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "mensajes_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "idx_mensajes_conversacion" ON "mensajes"("remitente_id","destinatario_id","created_at");
CREATE INDEX "idx_mensajes_no_leidos" ON "mensajes"("destinatario_id","leido_at");
ALTER TABLE "mensajes" ADD CONSTRAINT "mensajes_remitente_id_fkey" FOREIGN KEY ("remitente_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mensajes" ADD CONSTRAINT "mensajes_destinatario_id_fkey" FOREIGN KEY ("destinatario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "solicitudes_cambio" (
  "id" UUID NOT NULL,
  "tipo_entidad" "TipoEntidad" NOT NULL,
  "entidad_id" UUID NOT NULL,
  "accion" "AccionSolicitud" NOT NULL,
  "payload" JSONB,
  "motivo" VARCHAR(500) NOT NULL,
  "estado" "EstadoSolicitud" NOT NULL DEFAULT 'Pendiente',
  "solicitante_id" UUID NOT NULL,
  "aprobador_id" UUID,
  "area_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolved_at" TIMESTAMP(3),
  CONSTRAINT "solicitudes_cambio_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "idx_solicitudes_area_estado" ON "solicitudes_cambio"("area_id","estado");
ALTER TABLE "solicitudes_cambio" ADD CONSTRAINT "solicitudes_solicitante_fkey" FOREIGN KEY ("solicitante_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "solicitudes_cambio" ADD CONSTRAINT "solicitudes_aprobador_fkey" FOREIGN KEY ("aprobador_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "solicitudes_cambio" ADD CONSTRAINT "solicitudes_area_fkey" FOREIGN KEY ("area_id") REFERENCES "areas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "areas" ("id","nombre","color_hex","created_at") VALUES
  (gen_random_uuid(),'Administración','#B7791F',CURRENT_TIMESTAMP),
  (gen_random_uuid(),'Innovación y Producto','#D97706',CURRENT_TIMESTAMP)
ON CONFLICT ("nombre") DO NOTHING;
